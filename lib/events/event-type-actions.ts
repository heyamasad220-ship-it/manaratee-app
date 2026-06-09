"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

type UpsertEventTypeInput = {
  id?: string
  name: string
  description?: string | null
  is_active?: boolean
  sort_order?: number
}

export async function upsertEventType(input: UpsertEventTypeInput) {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage event types.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Event type name is required.")
  }

  const slug = slugify(name)
  if (!slug) {
    throw new Error("Event type name must contain letters or numbers.")
  }

  const payload = {
    organization_id: organizationId,
    name,
    slug,
    description: input.description?.trim() || null,
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ?? 0,
  }

  if (input.id) {
    const { error } = await supabase
      .from("event_types")
      .update({
        name,
        description: input.description?.trim() || null,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .eq("id", input.id)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      throw new Error("Failed to update event type")
    }
  } else {
    const { error } = await supabase.from("event_types").insert(payload)

    if (error) {
      console.error(error)
      if (error.code === "23505") {
        throw new Error("An event type with this name already exists.")
      }
      throw new Error("Failed to create event type")
    }
  }

  revalidatePath("/event-management/settings")
  revalidatePath("/event-management/settings/event-types")
  revalidatePath("/event-management/overview")
}

export async function deleteEventType(id: string) {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage event types.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("event_types")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    if (error.code === "23503") {
      throw new Error("This event type is in use and cannot be deleted.")
    }
    throw new Error("Failed to delete event type")
  }

  revalidatePath("/event-management/settings")
  revalidatePath("/event-management/settings/event-types")
  revalidatePath("/event-management/overview")
}
