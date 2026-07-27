"use server"

import { revalidatePath } from "next/cache"

import type { DiscountTag, DiscountTagInput } from "@/lib/discount-tags/discount-tag-types"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { MEMBERSHIP_BENEFITS_PATH } from "@/lib/memberships/membership-module-label"
import { CONTACTS_SETTINGS_PATH } from "@/lib/contacts/contact-module-label"

function revalidateDiscountTagPaths() {
  revalidatePath(MEMBERSHIP_BENEFITS_PATH)
  revalidatePath(CONTACTS_SETTINGS_PATH)
  revalidatePath("/workforce/settings/discount-tags")
  revalidatePath("/workforce/settings")
  revalidatePath("/membership/benefits")
  revalidatePath("/discount-tags")
}

function parsePercentOff(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const num = typeof value === "number" ? value : Number(String(value).trim())
  if (!Number.isFinite(num)) {
    throw new Error("Discount amount must be a number between 0 and 100.")
  }
  if (num < 0 || num > 100) {
    throw new Error("Discount amount must be between 0 and 100.")
  }
  return Math.round(num * 100) / 100
}

function normalizeTagInput(input: DiscountTagInput) {
  const name = String(input.name || "").trim()
  if (!name) {
    throw new Error("Tag name is required")
  }

  const autoApply = Boolean(input.autoApply)
  const percentOff = parsePercentOff(input.percentOff ?? null)

  if (autoApply && (percentOff === null || percentOff <= 0)) {
    throw new Error("Enter a discount amount (greater than 0) when auto-apply is on.")
  }

  const appliesToPrograms = input.appliesToPrograms !== false
  const appliesToVenueRentals = input.appliesToVenueRentals !== false
  const appliesToTicketing = Boolean(input.appliesToTicketing)

  if (
    autoApply &&
    !appliesToPrograms &&
    !appliesToVenueRentals &&
    !appliesToTicketing
  ) {
    throw new Error("Select at least one module when auto-apply is on.")
  }

  return {
    name,
    description: String(input.description || "").trim() || null,
    percent_off: percentOff,
    auto_apply: autoApply,
    applies_to_programs: appliesToPrograms,
    applies_to_venue_rentals: appliesToVenueRentals,
    applies_to_ticketing: appliesToTicketing,
    active: input.active !== false,
  }
}

export async function createDiscountTagFromInput(input: DiscountTagInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const payload = normalizeTagInput(input)

  const { error } = await supabase.from("discount_tags").insert({
    organization_id: organizationId,
    ...payload,
  })

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidateDiscountTagPaths()
}

/** @deprecated Prefer createDiscountTagFromInput — kept for legacy form posts. */
export async function createDiscountTag(formData: FormData) {
  await createDiscountTagFromInput({
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || ""),
    percentOff: formData.get("percent_off")
      ? Number(formData.get("percent_off"))
      : null,
    autoApply: String(formData.get("auto_apply") || "") === "true",
    appliesToPrograms: String(formData.get("applies_to_programs") || "true") !== "false",
    appliesToVenueRentals:
      String(formData.get("applies_to_venue_rentals") || "true") !== "false",
    appliesToTicketing: String(formData.get("applies_to_ticketing") || "") === "true",
  })
}

export async function updateDiscountTagFromInput(
  id: string,
  input: DiscountTagInput
) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!id) {
    throw new Error("Tag id is required")
  }

  const payload = normalizeTagInput(input)

  const { error } = await supabase
    .from("discount_tags")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidateDiscountTagPaths()
}

export async function toggleDiscountTagFromForm(formData: FormData) {
  const id = String(formData.get("id") || "")
  const active = String(formData.get("active") || "false") === "true"

  if (!id) return

  await toggleDiscountTagActive(id, active)
}

export async function deleteDiscountTagFromForm(formData: FormData) {
  const id = String(formData.get("id") || "")

  if (!id) return

  await deleteDiscountTag(id)
}

export async function toggleDiscountTagActive(id: string, active: boolean) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("discount_tags")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidateDiscountTagPaths()
}

export async function deleteDiscountTag(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("discount_tags")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error(error.message)
  }

  revalidateDiscountTagPaths()
}

export type { DiscountTag }
