"use server"

import { revalidatePath } from "next/cache"

import { ensureContactForPerson } from "@/lib/contacts/contact-actions"
import { normalizeDateOfBirth } from "@/lib/dates/date-input-utils"
import { getCustomerPortalClients } from "@/lib/auth/customer-portal-session"
import { createClient } from "@/lib/supabase/server"

export type CustomerFamilyMemberRow = {
  id: string
  firstName: string
  lastName: string
  gender: string
  dateOfBirth: string
  relationship: string
}

async function getAuthenticatedCustomerContact(organizationId: string) {
  const clients = await getCustomerPortalClients()

  if (!clients) {
    throw new Error("You must be signed in to manage family members.")
  }

  const { data: contact, error: contactError } = await clients.dataClient
    .from("contacts")
    .select("id, person_id, organization_id, full_name, email, phone")
    .eq("auth_user_id", clients.effectiveUserId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (contactError || !contact) {
    throw new Error("Customer contact record not found for this organization.")
  }

  return {
    supabase: clients.actionClient,
    dataClient: clients.dataClient,
    userId: clients.effectiveUserId,
    contact,
  }
}

export async function loadCustomerFamilyMembers(input: {
  organizationId: string
  parentPersonId: string
}): Promise<CustomerFamilyMemberRow[]> {
  const clients = await getCustomerPortalClients()
  if (!clients) {
    return []
  }

  const { data, error } = await clients.dataClient
    .from("person_relationships")
    .select(`
      id,
      relationship_type,
      related_person_id,
      people:related_person_id (
        id,
        first_name,
        last_name,
        gender,
        date_of_birth
      )
    `)
    .eq("person_id", input.parentPersonId)

  if (error) {
    console.error("loadCustomerFamilyMembers:", error)
    return []
  }

  return (
    data?.map((row) => {
      const person = row.people as {
        id: string
        first_name: string | null
        last_name: string | null
        gender: string | null
        date_of_birth: string | null
      } | null

      return {
        id: person?.id ?? "",
        firstName: person?.first_name || "",
        lastName: person?.last_name || "",
        gender: person?.gender || "",
        dateOfBirth: person?.date_of_birth || "",
        relationship: (row.relationship_type as string) || "",
      }
    }) ?? []
  ).filter((member) => member.id)
}

export type AddCustomerFamilyMemberInput = {
  organizationId: string
  parentPersonId: string
  firstName: string
  lastName: string
  gender?: string | null
  dateOfBirth?: string | null
  relationship: string
}

async function ensureParentPersonId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  contact: {
    id: string
    person_id: string | null
    full_name: string | null
    email: string | null
    phone: string | null
  }
) {
  if (contact.person_id) {
    return contact.person_id as string
  }

  const fullName = String(contact.full_name || "Customer").trim()
  const nameParts = fullName.split(" ").filter(Boolean)
  const firstName = nameParts[0] || "Customer"
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Account"

  const { data: person, error: personError } = await supabase
    .from("people")
    .insert({
      organization_id: organizationId,
      first_name: firstName,
      last_name: lastName,
      email: contact.email || null,
      phone: contact.phone || null,
      person_type: "contact",
    })
    .select("id")
    .single()

  if (personError || !person) {
    throw new Error(personError?.message || "Could not create profile person record.")
  }

  const { error: updateError } = await supabase
    .from("contacts")
    .update({ person_id: person.id })
    .eq("id", contact.id)
    .eq("organization_id", organizationId)

  if (updateError) {
    throw new Error(updateError.message || "Could not link profile to person record.")
  }

  return person.id as string
}

export async function addCustomerFamilyMember(input: AddCustomerFamilyMemberInput) {
  const organizationId = input.organizationId.trim()
  const parentPersonId = input.parentPersonId.trim()
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const relationship = input.relationship.trim()

  if (!organizationId || !parentPersonId) {
    throw new Error("Missing organization context.")
  }

  if (!firstName || !lastName) {
    throw new Error("First and last name are required.")
  }

  if (!relationship) {
    throw new Error("Relationship is required.")
  }

  const dateOfBirth = normalizeDateOfBirth(input.dateOfBirth)

  const { supabase, contact } = await getAuthenticatedCustomerContact(organizationId)
  const resolvedParentPersonId = await ensureParentPersonId(
    supabase,
    organizationId,
    contact
  )

  if (resolvedParentPersonId !== parentPersonId) {
    throw new Error("Family members can only be added to your own profile.")
  }

  const { data: createdPerson, error: personError } = await supabase
    .from("people")
    .insert({
      organization_id: organizationId,
      first_name: firstName,
      last_name: lastName,
      gender: input.gender?.trim() || null,
      date_of_birth: dateOfBirth,
      person_type: "participant",
    })
    .select("id")
    .single()

  if (personError || !createdPerson) {
    throw new Error(personError?.message || "Could not create family member.")
  }

  const { error: relationshipError } = await supabase
    .from("person_relationships")
    .insert({
      organization_id: organizationId,
      person_id: resolvedParentPersonId,
      related_person_id: createdPerson.id,
      relationship_type: relationship,
    })

  if (relationshipError) {
    throw new Error(relationshipError.message || "Could not save family relationship.")
  }

  const { contactId } = await ensureContactForPerson({
    organizationId,
    personId: createdPerson.id as string,
  })

  revalidatePath("/customer/profile")
  revalidatePath("/customer/programs")

  return {
    personId: createdPerson.id as string,
    contactId,
  }
}

export async function removeCustomerFamilyMember(input: {
  organizationId: string
  parentPersonId: string
  relatedPersonId: string
}) {
  const organizationId = input.organizationId.trim()
  const parentPersonId = input.parentPersonId.trim()
  const relatedPersonId = input.relatedPersonId.trim()

  const { supabase, contact } = await getAuthenticatedCustomerContact(organizationId)
  const resolvedParentPersonId = await ensureParentPersonId(
    supabase,
    organizationId,
    contact
  )

  if (resolvedParentPersonId !== parentPersonId) {
    throw new Error("You can only remove family members from your own profile.")
  }

  const { error } = await supabase
    .from("person_relationships")
    .delete()
    .eq("organization_id", organizationId)
    .eq("person_id", resolvedParentPersonId)
    .eq("related_person_id", relatedPersonId)

  if (error) {
    throw new Error(error.message || "Could not remove family member.")
  }

  revalidatePath("/customer/profile")
  revalidatePath("/customer/programs")

  return { success: true }
}
