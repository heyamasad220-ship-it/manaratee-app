import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import type {
  InternalEvent,
  InternalEventWithRelations,
} from "./internal-event-types"

const EVENT_SELECT = `
  *,
  departments:department_id ( id, name, color ),
  event_types:event_type_id ( id, name ),
  venues:venue_id ( id, name ),
  internal_event_venues ( venue_id, venues:venue_id ( id, name ) )
`

const EVENT_SELECT_FALLBACK = `
  *,
  departments:department_id ( id, name, color ),
  event_types:event_type_id ( id, name ),
  venues:venue_id ( id, name )
`

export function mapInternalEventWithVenues(
  row: Record<string, unknown> | InternalEventWithRelations
): InternalEventWithRelations {
  const event = row as InternalEventWithRelations
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

function isMissingVenueJunctionError(error: { message?: string; code?: string }) {
  return (
    error.message?.includes("internal_event_venues") ||
    error.code === "42703" ||
    error.code === "PGRST200"
  )
}

export async function getInternalEventVenueIds(eventId: string): Promise<string[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("internal_event_venues")
    .select("venue_id")
    .eq("organization_id", organizationId)
    .eq("internal_event_id", eventId)

  if (error) {
    // Junction table may not exist until migration 211 is applied.
    console.error(error)
    return []
  }

  return (data || []).map((row) => row.venue_id as string).filter(Boolean)
}

export async function getInternalEvents() {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const primary = await supabase
    .from("internal_events")
    .select(EVENT_SELECT)
    .eq("organization_id", organizationId)
    .order("start_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (primary.error && isMissingVenueJunctionError(primary.error)) {
    const fallback = await supabase
      .from("internal_events")
      .select(EVENT_SELECT_FALLBACK)
      .eq("organization_id", organizationId)
      .order("start_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (fallback.error) {
      console.error(fallback.error)
      throw new Error("Failed to load events")
    }

    return (fallback.data || []).map((row) =>
      mapInternalEventWithVenues(row as Record<string, unknown>)
    )
  }

  if (primary.error) {
    console.error(primary.error)
    throw new Error("Failed to load events")
  }

  return (primary.data || []).map((row) =>
    mapInternalEventWithVenues(row as Record<string, unknown>)
  )
}

export async function getInternalEventById(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return null
  }

  const { data, error } = await supabase
    .from("internal_events")
    .select(EVENT_SELECT)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    console.error(error)
    return null
  }

  return data as InternalEventWithRelations | null
}

export async function getInternalEventRecordById(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return null
  }

  const { data, error } = await supabase
    .from("internal_events")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    console.error(error)
    return null
  }

  return data as InternalEvent | null
}

export async function getPendingInternalEventRequests() {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("internal_events")
    .select(EVENT_SELECT)
    .eq("organization_id", organizationId)
    .in("status", ["submitted", "awaiting_approval"])
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })

  if (error) {
    console.error(error)
    throw new Error("Failed to load pending event requests")
  }

  return (data || []) as InternalEventWithRelations[]
}
