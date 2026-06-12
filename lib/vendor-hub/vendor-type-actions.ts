"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { getVendorHubVendorTypes } from "@/lib/vendor-hub/vendor-type-queries"

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

type UpsertVendorHubVendorTypeInput = {
  id?: string
  name: string
  description?: string | null
  default_fee?: number | null
  is_active?: boolean
  sort_order?: number
}

async function assertCanManageVendorTypes() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.VENDOR_HUB_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage vendor types.")
  }
}

export async function upsertVendorHubVendorType(input: UpsertVendorHubVendorTypeInput) {
  await assertCanManageVendorTypes()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Vendor type name is required.")
  }

  const slug = slugify(name)
  if (!slug) {
    throw new Error("Vendor type name must contain letters or numbers.")
  }

  const payload = {
    organization_id: organizationId,
    name,
    slug,
    description: input.description?.trim() || null,
    default_fee: input.default_fee ?? null,
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ?? 0,
  }

  if (input.id) {
    const { error } = await supabase
      .from("vendor_hub_vendor_types")
      .update({
        name,
        description: input.description?.trim() || null,
        default_fee: input.default_fee ?? null,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .eq("id", input.id)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      throw new Error("Failed to update vendor type")
    }
  } else {
    const { error } = await supabase.from("vendor_hub_vendor_types").insert(payload)

    if (error) {
      console.error(error)
      if (error.code === "23505") {
        throw new Error("A vendor type with this name already exists.")
      }
      throw new Error("Failed to create vendor type")
    }
  }

  revalidatePath("/vendor-hub/settings")
  revalidatePath("/event-management/request")
  revalidatePath("/event-management/create")
}

export async function deleteVendorHubVendorType(id: string) {
  await assertCanManageVendorTypes()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("vendor_hub_vendor_types")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to delete vendor type")
  }

  revalidatePath("/vendor-hub/settings")
  revalidatePath("/event-management/request")
  revalidatePath("/event-management/create")
}

export async function fetchVendorHubVendorTypesForSettings() {
  return getVendorHubVendorTypes()
}
