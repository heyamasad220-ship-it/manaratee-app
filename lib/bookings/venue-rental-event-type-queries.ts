import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import type { VenueRentalEventType } from "./venue-rental-event-type-types"

export async function getVenueRentalEventTypes(options?: {
  activeOnly?: boolean
  organizationId?: string
}) {
  const supabase = await createClient()
  const organizationId =
    options?.organizationId || (await getSelectedOrganizationId())

  if (!organizationId) {
    return []
  }

  let query = supabase
    .from("venue_rental_event_types")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (options?.activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    throw new Error("Failed to load venue rental event types")
  }

  return (data || []) as VenueRentalEventType[]
}
