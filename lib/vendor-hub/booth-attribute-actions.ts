"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import type {
  BoothAttributeCategory,
  VendorHubBoothAttribute,
} from "@/lib/vendor-hub/booth-catalog-types"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

async function assertCanManageVendorHubBooths() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.VENDOR_HUB_MANAGE,
    PERMISSIONS.EVENTS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage booth settings.")
  }
}

function mapAttributeRow(row: Record<string, unknown>): VendorHubBoothAttribute {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    name: row.name as string,
    slug: row.slug as string,
    category: row.category as BoothAttributeCategory,
    description: (row.description as string | null) ?? null,
    is_active: row.is_active as boolean,
    sort_order: row.sort_order as number,
  }
}

export async function fetchVendorHubBoothAttributes(): Promise<VendorHubBoothAttribute[]> {
  await assertCanManageVendorHubBooths()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("vendor_hub_booth_attributes")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error("fetchVendorHubBoothAttributes:", error)
    throw new Error("Failed to load booth attributes.")
  }

  return (data ?? []).map((row) => mapAttributeRow(row))
}

export type UpsertBoothAttributeInput = {
  id?: string
  name: string
  category: BoothAttributeCategory
  description?: string | null
  is_active?: boolean
  sort_order?: number
}

export async function upsertVendorHubBoothAttribute(input: UpsertBoothAttributeInput) {
  await assertCanManageVendorHubBooths()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Attribute name is required.")
  }

  const slug = slugify(name)
  if (!slug) {
    throw new Error("Attribute name must contain letters or numbers.")
  }

  const payload = {
    organization_id: organizationId,
    name,
    slug,
    category: input.category,
    description: input.description?.trim() || null,
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ?? 0,
  }

  if (input.id) {
    const { error } = await supabase
      .from("vendor_hub_booth_attributes")
      .update({
        name,
        category: input.category,
        description: input.description?.trim() || null,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .eq("id", input.id)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      throw new Error("Failed to update booth attribute.")
    }
  } else {
    const { error } = await supabase.from("vendor_hub_booth_attributes").insert(payload)

    if (error) {
      console.error(error)
      if (error.code === "23505") {
        throw new Error("An attribute with this name already exists.")
      }
      throw new Error("Failed to create booth attribute.")
    }
  }

  revalidatePath(VENDOR_HUB_ROUTES.settings)
}

export async function deleteVendorHubBoothAttribute(id: string) {
  await assertCanManageVendorHubBooths()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("vendor_hub_booth_attributes")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to delete booth attribute.")
  }

  revalidatePath(VENDOR_HUB_ROUTES.settings)
}

export async function fetchBoothTypeAttributeIds(boothTypeId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendor_hub_booth_type_attributes")
    .select("attribute_id")
    .eq("booth_type_id", boothTypeId)

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error("fetchBoothTypeAttributeIds:", error)
    return []
  }

  return (data ?? []).map((row) => row.attribute_id as string)
}

export async function setBoothTypeAttributes(boothTypeId: string, attributeIds: string[]) {
  await assertCanManageVendorHubBooths()

  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from("vendor_hub_booth_type_attributes")
    .delete()
    .eq("booth_type_id", boothTypeId)

  if (deleteError && deleteError.code !== "42P01") {
    console.error(deleteError)
    throw new Error("Failed to update booth type attributes.")
  }

  if (attributeIds.length === 0) {
    revalidatePath(VENDOR_HUB_ROUTES.settings)
    return
  }

  const rows = attributeIds.map((attributeId) => ({
    booth_type_id: boothTypeId,
    attribute_id: attributeId,
  }))

  const { error: insertError } = await supabase
    .from("vendor_hub_booth_type_attributes")
    .insert(rows)

  if (insertError) {
    console.error(insertError)
    throw new Error("Failed to save booth type attributes.")
  }

  revalidatePath(VENDOR_HUB_ROUTES.settings)
}

export async function fetchBoothAttributeIdsForBooth(boothId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendor_hub_booth_attribute_links")
    .select("attribute_id")
    .eq("booth_id", boothId)

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    return []
  }

  return (data ?? []).map((row) => row.attribute_id as string)
}

export async function setBoothAttributeLinks(boothId: string, attributeIds: string[]) {
  await assertCanManageVendorHubBooths()

  const supabase = await createClient()

  await supabase.from("vendor_hub_booth_attribute_links").delete().eq("booth_id", boothId)

  if (attributeIds.length === 0) {
    return
  }

  const { error } = await supabase.from("vendor_hub_booth_attribute_links").insert(
    attributeIds.map((attributeId) => ({
      booth_id: boothId,
      attribute_id: attributeId,
    }))
  )

  if (error) {
    console.error(error)
    throw new Error("Failed to save booth attributes.")
  }
}
