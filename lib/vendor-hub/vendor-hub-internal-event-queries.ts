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
