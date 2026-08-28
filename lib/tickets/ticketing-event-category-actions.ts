"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { revalidateTicketingPaths } from "@/lib/tickets/revalidate-ticketing-paths"

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

async function assertCanManageTicketingCategories() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE,
    PERMISSIONS.TICKETING_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage ticketing categories.")
  }
}

type UpsertTicketingEventCategoryInput = {
  id?: string
  name: string
  is_active?: boolean
  sort_order?: number
}

export async function upsertTicketingEventCategory(
  input: UpsertTicketingEventCategoryInput
) {
  await assertCanManageTicketingCategories()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Category name is required.")
  }

  const slug = slugify(name)
  if (!slug) {
    throw new Error("Category name must contain letters or numbers.")
  }

  if (input.id) {
    const { error } = await supabase
      .from("ticketing_event_categories")
      .update({
        name,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .eq("id", input.id)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      if (error.code === "23505") {
        throw new Error("A category with this name already exists.")
      }
      throw new Error("Failed to update category")
    }
  } else {
    const { error } = await supabase.from("ticketing_event_categories").insert({
      organization_id: organizationId,
      name,
      slug,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 0,
    })

    if (error) {
      console.error(error)
      if (error.code === "23505") {
        throw new Error("A category with this name already exists.")
      }
      throw new Error("Failed to create category")
    }
  }

  revalidateTicketingPaths()
}

export async function deleteTicketingEventCategory(id: string) {
  await assertCanManageTicketingCategories()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("ticketing_event_categories")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to delete category")
  }

  revalidateTicketingPaths()
}

export async function setTicketedEventCategory(
  eventId: string,
  categoryId: string | null
) {
  await assertCanManageTicketingCategories()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (categoryId) {
    const { data: category, error: categoryError } = await supabase
      .from("ticketing_event_categories")
      .select("id")
      .eq("id", categoryId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (categoryError || !category) {
      throw new Error("Category not found.")
    }
  }

  const { error } = await supabase
    .from("internal_events")
    .update({ ticketing_category_id: categoryId })
    .eq("id", eventId)
    .eq("organization_id", organizationId)
    .eq("requires_ticketing", true)

  if (error) {
    console.error(error)
    throw new Error("Failed to update event category")
  }

  revalidateTicketingPaths()
}
