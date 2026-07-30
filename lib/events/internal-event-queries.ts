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
  venues:venue_id ( id, name )
`

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

  const { data, error } = await supabase
    .from("internal_events")
    .select(EVENT_SELECT)
    .eq("organization_id", organizationId)
    .order("start_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) {
    console.error(error)
    throw new Error("Failed to load events")
  }

  return (data || []) as InternalEventWithRelations[]
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
