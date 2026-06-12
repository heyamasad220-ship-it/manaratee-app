import { createClient } from "@/lib/supabase/server"
import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"

import { getInternalEventStatusLabel } from "./internal-event-status"
import type { InternalEventWithRelations } from "./internal-event-types"

export async function getMyInternalEventRequests(
  userId: string,
  organizationId: string
): Promise<InternalEventWithRelations[]> {
  const { supabase } = await getCustomerPortalSupabase()

  const { data, error } = await supabase
    .from("internal_events")
    .select(
      `
      *,
      departments:department_id ( id, name, color ),
      event_types:event_type_id ( id, name ),
      venues:venue_id ( id, name )
    `
    )
    .eq("organization_id", organizationId)
    .eq("created_by", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error(error)
    throw new Error("Failed to load your event requests")
  }

  return (data || []) as InternalEventWithRelations[]
}

export function formatInternalEventRequestSummary(
  event: InternalEventWithRelations
) {
  const venueLabel = event.venues?.name || event.location_label || "Venue TBD"
  const dateLabel = event.start_at
    ? new Date(event.start_at).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Date TBD"

  return {
    venueLabel,
    dateLabel,
    statusLabel: getInternalEventStatusLabel(event.status),
  }
}
