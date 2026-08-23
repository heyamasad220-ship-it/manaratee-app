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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeDiscountTagId(tagId: string | null | undefined): string | null {
  const trimmed = tagId?.trim() || ""
  if (!trimmed) return null
  return UUID_RE.test(trimmed) ? trimmed : null
}

function revalidatePersonTagPaths(contactId: string) {
  revalidatePath(`/contacts/${contactId}`)
  revalidatePath(`/directory/${contactId}`)
}

async function assertTagIsManuallyAssignable(
  organizationId: string,
  tagId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: tag, error } = await supabase
    .from("discount_tags")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("id", tagId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message }
  }
  if (!tag) {
    return { ok: false, error: "Discount tag not found" }
  }

  if (isSystemManagedDiscountTagName(tag.name as string)) {
    return { ok: false, error: systemManagedDiscountTagAssignError(tag.name as string) }
  }

  return { ok: true }
}

export async function addPersonTag(contactId: string, tagId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const normalizedTagId = normalizeDiscountTagId(tagId)
  if (!normalizedTagId) {
    throw new Error("Discount tag not found")
  }

  const allowed = await assertTagIsManuallyAssignable(organizationId, normalizedTagId)
  if (!allowed.ok) {
    throw new Error(allowed.error)
  }
  const personId = await ensurePersonForContact(contactId)

  const { error } = await supabase.from("person_tags").insert({
    organization_id: organizationId,
    person_id: personId,
    tag_id: normalizedTagId,
  })

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(error.message)
  }

  revalidatePersonTagPaths(contactId)
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

  revalidatePersonTagPaths(contactId)
}

/**
 * Replace manually assignable discount tags with a single selection (or none).
 * Preserves system-managed tags (FTE / Employee / Member / Volunteer).
 */
export async function setPersonDiscountTag(
  contactId: string,
  tagId: string | null
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { success: false, error: "No organization selected" }
  }

  const trimmed = tagId?.trim() ?? ""
  // Radix Select can emit "" when the Edit dialog opens; ignore that so we
  // neither throw nor clear existing tags.
  if (tagId != null && trimmed !== "__none__" && !normalizeDiscountTagId(trimmed)) {
    return { success: true }
  }

  const normalizedTagId =
    tagId == null || trimmed === "" || trimmed === "__none__"
      ? null
      : normalizeDiscountTagId(trimmed)

  if (normalizedTagId) {
    const allowed = await assertTagIsManuallyAssignable(organizationId, normalizedTagId)
    if (!allowed.ok) {
      return { success: false, error: allowed.error }
    }
  }

  try {
    const personId = await ensurePersonForContact(contactId)

    const { data: existingRows, error: existingError } = await supabase
      .from("person_tags")
      .select("tag_id, discount_tags:tag_id ( id, name )")
      .eq("organization_id", organizationId)
      .eq("person_id", personId)

    if (existingError) {
      return { success: false, error: existingError.message }
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
        return { success: false, error: deleteError.message }
      }
    }

    if (!normalizedTagId) {
      revalidatePersonTagPaths(contactId)
      return { success: true }
    }

    const { error: insertError } = await supabase.from("person_tags").insert({
      organization_id: organizationId,
      person_id: personId,
      tag_id: normalizedTagId,
    })

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    revalidatePersonTagPaths(contactId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update discount tag",
    }
  }
}
