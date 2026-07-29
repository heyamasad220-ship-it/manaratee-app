"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"

import {
  normalizeFacilityInventoryCategory,
  type FacilityInventoryCategory,
} from "./facility-inventory-types"

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

function buildInventorySlug(input: {
  name: string
  size?: string | null
  style?: string | null
  color?: string | null
}) {
  const parts = [input.name, input.size, input.style, input.color]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("-")
  return slugify(parts) || slugify(input.name)
}

function revalidateFacilityInventoryPaths() {
  revalidatePath("/facilities/inventory")
  revalidatePath("/facilities/settings/resources")
  revalidatePath("/facilities/resources")
  revalidatePath("/facilities/overview")
}

type UpsertFacilityInventoryItemInput = {
  id?: string
  name: string
  category?: FacilityInventoryCategory | string | null
  description?: string | null
  size?: string | null
  style?: string | null
  color?: string | null
  quantity?: number
  location?: string | null
  notes?: string | null
  purchased_at?: string | null
  unit_cost?: number | null
  is_active?: boolean
  sort_order?: number
}

async function assertCanManageFacilityInventory() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.BOOKINGS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage facility inventory.")
  }
}

function parseOptionalMoney(value: number | null | undefined) {
  if (value == null || value === ("" as unknown)) {
    return null
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Unit cost must be a non-negative number.")
  }
  return Math.round(value * 100) / 100
}

function parseOptionalDate(value: string | null | undefined) {
  const trimmed = value?.trim() || ""
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("Purchase date must be a valid date.")
  }
  return trimmed
}

export async function upsertFacilityInventoryItem(
  input: UpsertFacilityInventoryItemInput
) {
  await assertCanManageFacilityInventory()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Item name is required.")
  }

  const size = input.size?.trim() || null
  const style = input.style?.trim() || null
  const color = input.color?.trim() || null
  const slug = buildInventorySlug({ name, size, style, color })
  if (!slug) {
    throw new Error("Item name must contain letters or numbers.")
  }

  const quantity =
    typeof input.quantity === "number" && Number.isFinite(input.quantity)
      ? Math.max(0, Math.floor(input.quantity))
      : 1

  const unitCost = parseOptionalMoney(input.unit_cost)
  const purchasedAt = parseOptionalDate(input.purchased_at)
  const category = normalizeFacilityInventoryCategory(input.category)

  const payload = {
    organization_id: organizationId,
    name,
    slug,
    category,
    description: input.description?.trim() || null,
    size,
    style,
    color,
    quantity,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    purchased_at: purchasedAt,
    unit_cost: unitCost,
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ?? 0,
  }

  if (input.id) {
    const { error } = await supabase
      .from("facility_inventory_items")
      .update({
        name,
        slug,
        category: payload.category,
        description: payload.description,
        size: payload.size,
        style: payload.style,
        color: payload.color,
        quantity: payload.quantity,
        location: payload.location,
        notes: payload.notes,
        purchased_at: payload.purchased_at,
        unit_cost: payload.unit_cost,
        is_active: payload.is_active,
        sort_order: payload.sort_order,
      })
      .eq("id", input.id)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      if (error.code === "23505") {
        throw new Error(
          "An inventory item with this name and variant already exists."
        )
      }
      throw new Error("Failed to update inventory item")
    }
  } else {
    const { error } = await supabase.from("facility_inventory_items").insert(payload)

    if (error) {
      console.error(error)
      if (error.code === "23505") {
        throw new Error(
          "An inventory item with this name and variant already exists."
        )
      }
      throw new Error("Failed to create inventory item")
    }
  }

  revalidateFacilityInventoryPaths()
}

export async function deleteFacilityInventoryItem(id: string) {
  await assertCanManageFacilityInventory()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("facility_inventory_items")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to delete inventory item")
  }

  revalidateFacilityInventoryPaths()
}

export async function reorderFacilityInventoryItems(orderedIds: string[]) {
  await assertCanManageFacilityInventory()

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
    .from("facility_inventory_items")
    .select("id")
    .eq("organization_id", organizationId)

  if (loadError) {
    console.error(loadError)
    throw new Error("Failed to load inventory for reorder.")
  }

  const allowedIds = new Set((existing || []).map((row) => row.id as string))
  const orderedInOrg = uniqueIds.filter((id) => allowedIds.has(id))

  if (orderedInOrg.length !== allowedIds.size) {
    throw new Error("Inventory list is out of date. Refresh and try again.")
  }

  const updates = await Promise.all(
    orderedInOrg.map((id, index) =>
      supabase
        .from("facility_inventory_items")
        .update({ sort_order: (index + 1) * 10 })
        .eq("id", id)
        .eq("organization_id", organizationId)
    )
  )

  const failed = updates.find((result) => result.error)
  if (failed?.error) {
    console.error(failed.error)
    throw new Error("Failed to save inventory order.")
  }

  revalidateFacilityInventoryPaths()
}
