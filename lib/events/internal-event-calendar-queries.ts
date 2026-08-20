import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import type { InternalEventWithRelations } from "./internal-event-types"

const EVENT_SELECT = `
  *,
  departments:department_id ( id, name, color ),
  event_types:event_type_id ( id, name ),
  venues:venue_id ( id, name ),
  internal_event_venues ( venue_id, venues:venue_id ( id, name ) )
`

function mapCalendarEvent(row: Record<string, unknown>): InternalEventWithRelations {
  const event = row as unknown as InternalEventWithRelations
  const junction = Array.isArray(event.internal_event_venues)
    ? event.internal_event_venues
    : []
  const venueNames = junction
    .map((item) => item.venues?.name?.trim() || "")
    .filter(Boolean)
  if (venueNames.length === 0 && event.venues?.name) {
    venueNames.push(event.venues.name)
  }

  return {
    ...event,
    venueNames,
    venue_ids:
      junction.length > 0
        ? junction.map((item) => item.venue_id).filter(Boolean)
        : event.venue_id
          ? [event.venue_id]
          : [],
  }
}

export async function getInternalEventsForCalendar(options: {
  rangeStart: string
  rangeEnd: string
  departmentId?: string | null
}): Promise<InternalEventWithRelations[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  let query = supabase
    .from("internal_events")
    .select(EVENT_SELECT)
    .eq("organization_id", organizationId)
    .not("start_at", "is", null)
    .gte("start_at", options.rangeStart)
    .lt("start_at", options.rangeEnd)
    .neq("status", "cancelled")
    .neq("status", "declined")
    .order("start_at", { ascending: true })

  if (options.departmentId) {
    query = query.eq("department_id", options.departmentId)
  }

  const { data, error } = await query

  if (error) {
    // Junction embed may fail if SQL 211 is not applied yet — retry without it.
    if (
      error.message?.includes("internal_event_venues") ||
      error.code === "42703" ||
      error.code === "PGRST200"
    ) {
      let fallback = supabase
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
        .not("start_at", "is", null)
        .gte("start_at", options.rangeStart)
        .lt("start_at", options.rangeEnd)
        .neq("status", "cancelled")
        .neq("status", "declined")
        .order("start_at", { ascending: true })

      if (options.departmentId) {
        fallback = fallback.eq("department_id", options.departmentId)
      }

      const retry = await fallback
      if (retry.error) {
        console.error(retry.error)
        throw new Error("Failed to load calendar events")
      }
      return ((retry.data || []) as Record<string, unknown>[]).map(mapCalendarEvent)
    }

    console.error(error)
    throw new Error("Failed to load calendar events")
  }

  return ((data || []) as Record<string, unknown>[]).map(mapCalendarEvent)
}
