"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export type VendorHubLinkForInternalEvent = {
  vendorHubEventId: string
  name: string
  href: string
  boothsHref: string
  totalBooths: number | null
}

export async function getVendorHubLinkForInternalEvent(
  internalEventId: string
): Promise<VendorHubLinkForInternalEvent | null> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !internalEventId) return null

  const { data, error } = await supabase
    .from("vendor_hub_events")
    .select("id, name, total_booths")
    .eq("organization_id", organizationId)
    .eq("internal_event_id", internalEventId)
    .maybeSingle()

  if (error || !data) {
    if (error?.code === "42P01") return null
    return null
  }

  const vendorHubEventId = data.id as string
  return {
    vendorHubEventId,
    name: (data.name as string) || "Bazaar event",
    href: VENDOR_HUB_ROUTES.events.detail(vendorHubEventId),
    boothsHref: VENDOR_HUB_ROUTES.events.booths(vendorHubEventId),
    totalBooths: (data.total_booths as number | null) ?? null,
  }
}

export async function getVendorHubEventIdsByInternalEventIds(
  organizationId: string,
  internalEventIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(internalEventIds.filter(Boolean)))
  const result = new Map<string, string>()
  if (uniqueIds.length === 0) return result

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendor_hub_events")
    .select("id, internal_event_id")
    .eq("organization_id", organizationId)
    .in("internal_event_id", uniqueIds)

  if (error || !data) return result

  for (const row of data) {
    const internalId = row.internal_event_id as string | null
    const bazaarId = row.id as string | null
    if (internalId && bazaarId) {
      result.set(internalId, bazaarId)
    }
  }

  return result
}

/** Vendor Hub workspace URL when this internal_events row is a bazaar hold. */
export async function getBazaarWorkspaceHrefForInternalEvent(
  internalEventId: string
): Promise<string | null> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !internalEventId) return null

  const { data: event, error } = await supabase
    .from("internal_events")
    .select("id, source_module")
    .eq("id", internalEventId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !event) return null
  if ((event.source_module as string | null) !== "vendor_hub") return null

  const link = await getVendorHubLinkForInternalEvent(internalEventId)
  return link?.href ?? VENDOR_HUB_ROUTES.events.list
}
