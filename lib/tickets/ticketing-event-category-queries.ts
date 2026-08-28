"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type { TicketingEventCategory } from "./ticketing-event-category-types"

export async function getTicketingEventCategories(options?: {
  activeOnly?: boolean
}): Promise<TicketingEventCategory[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  let query = supabase
    .from("ticketing_event_categories")
    .select("id, organization_id, name, slug, sort_order, is_active")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (options?.activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === "42P01" || error.code === "42703") return []
    console.error(error)
    throw new Error("Failed to load ticketing categories")
  }

  return (data || []) as TicketingEventCategory[]
}
