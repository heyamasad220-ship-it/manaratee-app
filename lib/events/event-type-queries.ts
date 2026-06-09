import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

import type { EventType } from "./event-type-types"

export async function getEventTypes(options?: { activeOnly?: boolean }) {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return []
  }

  let query = supabase
    .from("event_types")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (options?.activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query

  if (error) {
    console.error(error)
    throw new Error("Failed to load event types")
  }

  return (data || []) as EventType[]
}

export async function getEventTypeById(id: string) {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return null
  }

  const { data, error } = await supabase
    .from("event_types")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    console.error(error)
    return null
  }

  return data as EventType | null
}
