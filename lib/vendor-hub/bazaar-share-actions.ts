"use server"

import { revalidatePath } from "next/cache"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  buildBazaarShareUrl,
  createBazaarShareToken,
} from "@/lib/vendor-hub/bazaar-share-url"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

async function getEventForOrg(eventId: string) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  // Service role after requireVendorHubManage — avoids slow vendor_hub_events RLS
  // (permissive vendor SELECT policy scanning large participation/payment tables).
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from("vendor_hub_events")
    .select("id, public_share_token, organization_id")
    .eq("id", eventId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || "Bazaar event not found")
  }

  if (!data) {
    throw new Error("Bazaar event not found")
  }

  return { supabase, organizationId, event: data }
}

function revalidateSharePaths(eventId: string, shareToken?: string | null) {
  revalidatePath(VENDOR_HUB_ROUTES.events.detail(eventId))
  if (shareToken) {
    revalidatePath(`/bazaar/${shareToken}`)
  }
}

export async function ensureBazaarShareToken(eventId: string) {
  await requireVendorHubManage()

  const { supabase, organizationId, event } = await getEventForOrg(eventId)

  if (event.public_share_token) {
    return {
      shareToken: event.public_share_token as string,
      shareUrl: buildBazaarShareUrl(event.public_share_token as string),
    }
  }

  const shareToken = createBazaarShareToken()

  const { error } = await supabase
    .from("vendor_hub_events")
    .update({ public_share_token: shareToken })
    .eq("id", eventId)
    .eq("organization_id", organizationId)

  if (error) {
    if (error.code === "42703") {
      throw new Error(
        "Public share links require migration 085_vendor_hub_flyer_and_share.sql in Supabase."
      )
    }
    throw new Error(error.message)
  }

  revalidateSharePaths(eventId, shareToken)

  return {
    shareToken,
    shareUrl: buildBazaarShareUrl(shareToken),
  }
}

export async function regenerateBazaarShareToken(eventId: string) {
  await requireVendorHubManage()

  const { supabase, organizationId, event } = await getEventForOrg(eventId)
  const previousToken = event.public_share_token as string | null
  const shareToken = createBazaarShareToken()

  const { error } = await supabase
    .from("vendor_hub_events")
    .update({ public_share_token: shareToken })
    .eq("id", eventId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidateSharePaths(eventId, shareToken)
  if (previousToken) {
    revalidatePath(`/bazaar/${previousToken}`)
  }

  return {
    shareToken,
    shareUrl: buildBazaarShareUrl(shareToken),
  }
}

export async function getBazaarShareLink(eventId: string) {
  return ensureBazaarShareToken(eventId)
}
