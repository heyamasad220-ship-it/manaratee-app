"use server"

import { revalidatePath } from "next/cache"

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

export async function createDiscountTag(formData: FormData) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = String(formData.get("name") || "").trim()
  const description = String(formData.get("description") || "").trim()

  if (!name) {
    throw new Error("Tag name is required")
  }

  const { error } = await supabase.from("discount_tags").insert({
    organization_id: organizationId,
    name,
    description: description || null,
    active: true,
  })

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
    .update({ active })
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