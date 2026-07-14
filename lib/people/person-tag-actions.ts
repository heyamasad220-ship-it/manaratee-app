"use server"

import { revalidatePath } from "next/cache"

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

export async function addPersonTag(contactId: string, tagId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

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

/** Replace all person discount tags with a single selection (or none). */
export async function setPersonDiscountTag(contactId: string, tagId: string | null) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const personId = await ensurePersonForContact(contactId)

  const { error: deleteError } = await supabase
    .from("person_tags")
    .delete()
    .eq("organization_id", organizationId)
    .eq("person_id", personId)

  if (deleteError) {
    throw new Error(deleteError.message)
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