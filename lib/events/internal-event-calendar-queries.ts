import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import type { InternalEventWithRelations } from "./internal-event-types"

const EVENT_SELECT = `
  *,
  departments:department_id ( id, name, color ),
  event_types:event_type_id ( id, name ),
  venues:venue_id ( id, name )
`

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
    console.error(error)
    throw new Error("Failed to load calendar events")
  }

  return (data || []) as InternalEventWithRelations[]
}
