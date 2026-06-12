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

type UpsertRoomSetupStyleInput = {
  id?: string
  name: string
  description?: string | null
  is_active?: boolean
  sort_order?: number
}

export async function upsertRoomSetupStyle(input: UpsertRoomSetupStyleInput) {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage setup styles.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Setup style name is required.")
  }

  const slug = slugify(name)
  if (!slug) {
    throw new Error("Setup style name must contain letters or numbers.")
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
      .from("room_setup_styles")
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
      throw new Error("Failed to update setup style")
    }
  } else {
    const { error } = await supabase.from("room_setup_styles").insert(payload)

    if (error) {
      console.error(error)
      if (error.code === "23505") {
        throw new Error("A setup style with this name already exists.")
      }
      throw new Error("Failed to create setup style")
    }
  }

  revalidatePath("/event-management/settings/setup-styles")
  revalidatePath("/event-management/request")
  revalidatePath("/event-management/create")
}

export async function deleteRoomSetupStyle(id: string) {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage setup styles.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("room_setup_styles")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to delete setup style")
  }

  revalidatePath("/event-management/settings/setup-styles")
  revalidatePath("/event-management/request")
  revalidatePath("/event-management/create")
}
