"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

async function assertCanManage() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.VENDOR_HUB_MANAGE,
    PERMISSIONS.EVENTS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage booth settings.")
  }
}

export type DefaultBoothTypeRow = {
  id: string
  organization_id: string | null
  event_id: string | null
  name: string
  size: string | null
  price: number | null
  color: string | null
  description: string | null
  is_active: boolean | null
  sort_order: number | null
  capacity: number | null
  location: string | null
}

/** Org default booth types (event_id is null). Requires script 234. */
export async function fetchDefaultBoothTypes(): Promise<DefaultBoothTypeRow[]> {
  await assertCanManage()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendor_hub_booth_types")
    .select("*")
    .eq("organization_id", organizationId)
    .is("event_id", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("fetchDefaultBoothTypes:", error.message)
    throw new Error(
      error.message.includes("organization_id") || error.code === "42703"
        ? "Run scripts/234_vendor_hub_default_booth_types.sql in Supabase to enable default booth types."
        : "Failed to load default booth types."
    )
  }

  return (data || []) as DefaultBoothTypeRow[]
}

export async function fetchEventBoothTypes(eventId: string): Promise<DefaultBoothTypeRow[]> {
  await assertCanManage()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendor_hub_booth_types")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("fetchEventBoothTypes:", error.message)
    throw new Error("Failed to load event booth types.")
  }

  return (data || []) as DefaultBoothTypeRow[]
}

/**
 * Copy org default booth types (and their attribute links) onto an event.
 * Skips when the event already has booth types unless `replaceExisting` is true.
 */
export async function copyDefaultBoothTypesToEvent(input: {
  eventId: string
  replaceExisting?: boolean
}) {
  await assertCanManage()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected.")
  }

  const supabase = await createClient()
  const eventId = input.eventId.trim()

  const { data: event, error: eventError } = await supabase
    .from("vendor_hub_events")
    .select("id")
    .eq("id", eventId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (eventError || !event) {
    throw new Error("Event not found.")
  }

  const { data: existing } = await supabase
    .from("vendor_hub_booth_types")
    .select("id")
    .eq("event_id", eventId)

  if ((existing || []).length > 0 && !input.replaceExisting) {
    throw new Error(
      "This event already has booth types. Delete them first, or choose replace when copying defaults."
    )
  }

  if (input.replaceExisting && (existing || []).length > 0) {
    const { error: deleteError } = await supabase
      .from("vendor_hub_booth_types")
      .delete()
      .eq("event_id", eventId)
    if (deleteError) {
      throw new Error(deleteError.message || "Could not clear existing booth types.")
    }
  }

  const defaults = await fetchDefaultBoothTypes()
  if (defaults.length === 0) {
    throw new Error("No default booth types configured. Add them under Vendor Hub → Settings → Booths.")
  }

  const defaultIds = defaults.map((row) => row.id)
  const { data: attributeLinks } = await supabase
    .from("vendor_hub_booth_type_attributes")
    .select("booth_type_id, attribute_id")
    .in("booth_type_id", defaultIds)

  const attrsByDefault = new Map<string, string[]>()
  for (const link of attributeLinks || []) {
    const typeId = link.booth_type_id as string
    const attributeId = link.attribute_id as string
    const list = attrsByDefault.get(typeId) || []
    list.push(attributeId)
    attrsByDefault.set(typeId, list)
  }

  let copied = 0
  for (const [index, row] of defaults.entries()) {
    const { data: created, error: insertError } = await supabase
      .from("vendor_hub_booth_types")
      .insert({
        organization_id: organizationId,
        event_id: eventId,
        name: row.name,
        size: row.size,
        price: row.price ?? 0,
        color: row.color ?? "#2563eb",
        description: row.description,
        capacity: row.capacity ?? 0,
        location: row.location,
        is_active: row.is_active !== false,
        sort_order: row.sort_order ?? index,
      })
      .select("id")
      .single()

    if (insertError || !created) {
      console.error(insertError)
      throw new Error(`Failed to copy booth type "${row.name}".`)
    }

    const attributeIds = attrsByDefault.get(row.id) || []
    if (attributeIds.length > 0) {
      await supabase.from("vendor_hub_booth_type_attributes").insert(
        attributeIds.map((attributeId) => ({
          booth_type_id: created.id,
          attribute_id: attributeId,
        }))
      )
    }
    copied += 1
  }

  revalidatePath(VENDOR_HUB_ROUTES.events.detail(eventId))
  revalidatePath(VENDOR_HUB_ROUTES.events.booths(eventId))
  revalidatePath(VENDOR_HUB_ROUTES.events.settings(eventId))
  revalidatePath(VENDOR_HUB_ROUTES.settings)

  return { success: true as const, copied }
}
