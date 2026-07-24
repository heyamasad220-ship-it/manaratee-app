"use server"

import { revalidatePath } from "next/cache"

import {
  isSystemManagedDiscountTagName,
  systemManagedDiscountTagAssignError,
} from "@/lib/discount-tags/discount-tag-assignment"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export async function ensurePersonForContact(
  contactId: string,
  organizationIdInput?: string | null
) {
  const supabase = await createClient()
  const organizationId = organizationIdInput ?? (await getSelectedOrganizationId())

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, person_id, full_name, email, phone, contact_type")
    .eq("id", contactId)
    .single()

  if (contactError || !contact) {
    throw new Error(contactError?.message || "Contact not found")
  }

  if (contact.person_id) {
    return contact.person_id as string
  }

  const fullName = String(contact.full_name || "").trim()
  const nameParts = fullName.split(" ").filter(Boolean)

  const firstName = nameParts[0] || "Unknown"
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Contact"

  const personType =
    contact.contact_type === "individual" ? "contact" : "contact"

  const { data: person, error: personError } = await supabase
    .from("people")
    .insert({
      organization_id: organizationId,
      first_name: firstName,
      last_name: lastName,
      email: contact.email || null,
      phone: contact.phone || null,
      person_type: personType,
    })
    .select("id")
    .single()

  if (personError || !person) {
    throw new Error(personError?.message || "Could not create person")
  }

  const { error: updateError } = await supabase
    .from("contacts")
    .update({
      person_id: person.id,
    })
    .eq("id", contactId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return person.id as string
}

async function assertTagIsManuallyAssignable(
  organizationId: string,
  tagId: string
) {
  const supabase = await createClient()
  const { data: tag, error } = await supabase
    .from("discount_tags")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("id", tagId)
    .maybeSingle()

  if (error || !tag) {
    throw new Error(error?.message || "Discount tag not found")
  }

  if (isSystemManagedDiscountTagName(tag.name as string)) {
    throw new Error(systemManagedDiscountTagAssignError(tag.name as string))
  }

  return tag
}

export async function addPersonTag(contactId: string, tagId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  await assertTagIsManuallyAssignable(organizationId, tagId)
  const personId = await ensurePersonForContact(contactId)

  const { error } = await supabase.from("person_tags").insert({
    organization_id: organizationId,
    person_id: personId,
    tag_id: tagId,
  })

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(error.message)
  }

  revalidatePath(`/contacts/${contactId}`)
}

export async function removePersonTag(contactId: string, tagId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: tag } = await supabase
    .from("discount_tags")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("id", tagId)
    .maybeSingle()

  if (tag && isSystemManagedDiscountTagName(tag.name as string)) {
    throw new Error(
      systemManagedDiscountTagAssignError(tag.name as string) +
        " Remove the workforce or membership status instead."
    )
  }

  const personId = await ensurePersonForContact(contactId)

  const { error } = await supabase
    .from("person_tags")
    .delete()
    .eq("organization_id", organizationId)
    .eq("person_id", personId)
    .eq("tag_id", tagId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/contacts/${contactId}`)
}

/**
 * Replace manually assignable discount tags with a single selection (or none).
 * Preserves system-managed tags (FTE / Employee / Member / Volunteer).
 */
export async function setPersonDiscountTag(
  contactId: string,
  tagId: string | null
) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (tagId) {
    await assertTagIsManuallyAssignable(organizationId, tagId)
  }

  const personId = await ensurePersonForContact(contactId)

  const { data: existingRows, error: existingError } = await supabase
    .from("person_tags")
    .select("tag_id, discount_tags:tag_id ( id, name )")
    .eq("organization_id", organizationId)
    .eq("person_id", personId)

  if (existingError) {
    throw new Error(existingError.message)
  }

  const manualTagIdsToRemove: string[] = []
  for (const row of existingRows || []) {
    const tagRel = row.discount_tags as
      | { id?: string; name?: string }
      | { id?: string; name?: string }[]
      | null
    const tag = Array.isArray(tagRel) ? tagRel[0] : tagRel
    const name = tag?.name || ""
    if (isSystemManagedDiscountTagName(name)) continue
    if (row.tag_id) manualTagIdsToRemove.push(row.tag_id as string)
  }

  if (manualTagIdsToRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("person_tags")
      .delete()
      .eq("organization_id", organizationId)
      .eq("person_id", personId)
      .in("tag_id", manualTagIdsToRemove)

    if (deleteError) {
      throw new Error(deleteError.message)
    }
  }

  if (!tagId) {
    revalidatePath(`/contacts/${contactId}`)
    return
  }

  const { error: insertError } = await supabase.from("person_tags").insert({
    organization_id: organizationId,
    person_id: personId,
    tag_id: tagId,
  })

  if (insertError) {
    throw new Error(insertError.message)
  }

  revalidatePath(`/contacts/${contactId}`)
}
