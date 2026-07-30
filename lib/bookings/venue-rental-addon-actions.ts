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

type UpsertRentalAddonInput = {
  id?: string
  name: string
  description?: string | null
  defaultPrice: number
  isActive?: boolean
  sortOrder?: number
}

async function assertCanManageRentalAddons() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  if (!canManage) {
    throw new Error("You do not have permission to manage rental add-ons.")
  }
}

function revalidateAddonPaths() {
  revalidatePath("/bookings/settings/addons")
  revalidatePath("/bookings/settings")
  revalidatePath("/bookings/requests")
  revalidatePath("/customer/rentals/new")
}

export async function upsertRentalAddon(input: UpsertRentalAddonInput) {
  await assertCanManageRentalAddons()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Add-on name is required.")
  }

  const slug = slugify(name)
  if (!slug) {
    throw new Error("Add-on name must contain letters or numbers.")
  }

  const defaultPrice = Number(input.defaultPrice)
  if (!Number.isFinite(defaultPrice) || defaultPrice < 0) {
    throw new Error("Enter a valid price of $0 or more.")
  }

  const payload = {
    organization_id: organizationId,
    name,
    slug,
    description: input.description?.trim() || null,
    default_price: Math.round(defaultPrice * 100) / 100,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  }

  if (input.id) {
    const { error } = await supabase
      .from("rental_addons")
      .update({
        name: payload.name,
        description: payload.description,
        default_price: payload.default_price,
        is_active: payload.is_active,
        sort_order: payload.sort_order,
      })
      .eq("id", input.id)
      .eq("organization_id", organizationId)

    if (error) {
      throw new Error(error.message || "Failed to update add-on")
    }
  } else {
    const { error } = await supabase.from("rental_addons").insert(payload)

    if (error) {
      if (error.code === "23505") {
        throw new Error("An add-on with this name already exists.")
      }
      throw new Error(error.message || "Failed to create add-on")
    }
  }

  revalidateAddonPaths()
}

export async function deleteRentalAddon(addonId: string) {
  await assertCanManageRentalAddons()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { count } = await supabase
    .from("rental_selected_addons")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("rental_addon_id", addonId)

  if ((count || 0) > 0) {
    const { error } = await supabase
      .from("rental_addons")
      .update({ is_active: false })
      .eq("id", addonId)
      .eq("organization_id", organizationId)

    if (error) {
      throw new Error(error.message || "Failed to deactivate add-on")
    }

    revalidateAddonPaths()
    return { deactivated: true as const }
  }

  const { error } = await supabase
    .from("rental_addons")
    .delete()
    .eq("id", addonId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to delete add-on")
  }

  revalidateAddonPaths()
  return { deactivated: false as const }
}

export async function reorderRentalAddons(orderedIds: string[]) {
  await assertCanManageRentalAddons()

  const uniqueIds = Array.from(new Set(orderedIds.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: existing, error: loadError } = await supabase
    .from("rental_addons")
    .select("id")
    .eq("organization_id", organizationId)

  if (loadError) {
    console.error(loadError)
    throw new Error("Failed to load add-ons for reorder.")
  }

  const allowedIds = new Set((existing || []).map((row) => row.id as string))
  const orderedInOrg = uniqueIds.filter((id) => allowedIds.has(id))

  if (orderedInOrg.length !== allowedIds.size) {
    throw new Error("Add-on list is out of date. Refresh and try again.")
  }

  const updates = await Promise.all(
    orderedInOrg.map((id, index) =>
      supabase
        .from("rental_addons")
        .update({ sort_order: (index + 1) * 10 })
        .eq("id", id)
        .eq("organization_id", organizationId)
    )
  )

  const failed = updates.find((result) => result.error)
  if (failed?.error) {
    console.error(failed.error)
    throw new Error(failed.error.message || "Failed to reorder add-ons")
  }

  revalidateAddonPaths()
}
