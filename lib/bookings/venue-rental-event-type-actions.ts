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

type UpsertVenueRentalEventTypeInput = {
  id?: string
  name: string
  description?: string | null
  is_active?: boolean
  sort_order?: number
}

async function assertCanManageVenueRentalEventTypes() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  if (!canManage) {
    throw new Error("You do not have permission to manage venue rental event types.")
  }
}

export async function upsertVenueRentalEventType(
  input: UpsertVenueRentalEventTypeInput
) {
  await assertCanManageVenueRentalEventTypes()

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
      .from("venue_rental_event_types")
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
    const { error } = await supabase
      .from("venue_rental_event_types")
      .insert(payload)

    if (error) {
      console.error(error)
      if (error.code === "23505") {
        throw new Error("An event type with this name already exists.")
      }
      throw new Error("Failed to create event type")
    }
  }

  revalidateVenueRentalEventTypePaths()
}

export async function deleteVenueRentalEventType(id: string) {
  await assertCanManageVenueRentalEventTypes()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("venue_rental_event_types")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to delete event type")
  }

  revalidateVenueRentalEventTypePaths()
}

function revalidateVenueRentalEventTypePaths() {
  revalidatePath("/bookings/settings/event-types")
  revalidatePath("/bookings/settings")
  revalidatePath("/bookings/overview")
  revalidatePath("/customer/rentals")
  revalidatePath("/customer/rentals/new")
}
