"use server"

import { revalidatePath } from "next/cache"

import { ensureContactForPerson } from "@/lib/contacts/contact-actions"
import {
  isEntityContactType,
  normalizePhone,
} from "@/lib/contacts/contact-constants"
import { normalizeDateOfBirth } from "@/lib/dates/date-input-utils"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"

export type ContactFamilyMemberRow = {
  id: string
  contactId: string | null
  firstName: string
  lastName: string
  gender: string
  dateOfBirth: string
  relationship: string
  email: string
  phone: string
}

export type ContactPersonDetails = {
  dateOfBirth: string | null
  gender: string | null
}

import type { ContactPaymentMethodRow } from "@/lib/contacts/contact-payment-method-actions"

export type ContactProfileExtendedData = {
  personDetails: ContactPersonDetails | null
  familyMembers: ContactFamilyMemberRow[]
  paymentMethods: ContactPaymentMethodRow[]
}

async function getContactForOrg(contactId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data, error } = await supabase
    .from("contacts")
    .select("id, person_id, organization_id, full_name, email, phone, contact_type")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (error || !data) {
    throw new Error("Contact not found")
  }

  return { supabase, organizationId, contact: data }
}

async function ensureContactPersonId(
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

  const fullName = String(contact.full_name || "Contact").trim()
  const nameParts = fullName.split(" ").filter(Boolean)
  const firstName = nameParts[0] || "Contact"
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Record"

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
    throw new Error(personError?.message || "Could not create person record for contact.")
  }

  const { error: updateError } = await supabase
    .from("contacts")
    .update({ person_id: person.id })
    .eq("id", contact.id)
    .eq("organization_id", organizationId)

  if (updateError) {
    throw new Error(updateError.message || "Could not link contact to person record.")
  }

  return person.id as string
}

function mapFamilyMembers(
  rows: Array<{
    relationship_type: string | null
    people: {
      id: string
      first_name: string | null
      last_name: string | null
      gender: string | null
      date_of_birth: string | null
      email: string | null
      phone: string | null
    } | null
  }>
): ContactFamilyMemberRow[] {
  return rows
    .map((row) => {
      const person = row.people
      if (!person?.id) return null

      return {
        id: person.id,
        contactId: null,
        firstName: person.first_name || "",
        lastName: person.last_name || "",
        gender: person.gender || "",
        dateOfBirth: person.date_of_birth || "",
        relationship: (row.relationship_type as string) || "",
        email: person.email || "",
        phone: person.phone || "",
      }
    })
    .filter((member): member is ContactFamilyMemberRow => member !== null)
}

async function attachFamilyMemberContactIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  members: ContactFamilyMemberRow[]
): Promise<ContactFamilyMemberRow[]> {
  if (members.length === 0) {
    return members
  }

  const personIds = members.map((member) => member.id)
  const { data: contactRows, error } = await supabase
    .from("contacts")
    .select("id, person_id")
    .eq("organization_id", organizationId)
    .in("person_id", personIds)

  if (error) {
    console.warn("attachFamilyMemberContactIds:", error.message)
  }

  const contactIdByPersonId = new Map<string, string>()
  for (const row of contactRows || []) {
    if (row.person_id) {
      contactIdByPersonId.set(row.person_id as string, row.id as string)
    }
  }

  return Promise.all(
    members.map(async (member) => {
      let contactId = contactIdByPersonId.get(member.id) ?? null

      if (!contactId) {
        const ensured = await ensureContactForPerson({
          organizationId,
          personId: member.id,
        })
        contactId = ensured.contactId
      }

      return {
        ...member,
        contactId,
      }
    })
  )
}

export async function loadContactProfileExtendedData(
  contactId: string
): Promise<ContactProfileExtendedData> {
  const { supabase, organizationId, contact } = await getContactForOrg(contactId)

  let personDetails: ContactPersonDetails | null = null
  let familyMembers: ContactFamilyMemberRow[] = []

  if (contact.person_id) {
    const parentPersonId = contact.person_id as string

    const [personResult, familyResult] = await Promise.all([
      supabase
        .from("people")
        .select("date_of_birth, gender")
        .eq("organization_id", organizationId)
        .eq("id", parentPersonId)
        .maybeSingle(),
      supabase
        .from("person_relationships")
        .select(`
          relationship_type,
          people:related_person_id (
            id,
            first_name,
            last_name,
            gender,
            date_of_birth,
            email,
            phone
          )
        `)
        .eq("organization_id", organizationId)
        .eq("person_id", parentPersonId),
    ])

    if (personResult.data) {
      personDetails = {
        dateOfBirth: (personResult.data.date_of_birth as string | null) ?? null,
        gender: (personResult.data.gender as string | null) ?? null,
      }
    }

    if (!familyResult.error) {
      familyMembers = await attachFamilyMemberContactIds(
        supabase,
        organizationId,
        mapFamilyMembers((familyResult.data || []) as any[])
      )
    }
  }

  const { data: paymentMethodRows } = await supabase
    .from("contact_payment_methods")
    .select(
      "id, card_brand, last4, exp_month, exp_year, cardholder_name, is_default, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  const paymentMethods: ContactPaymentMethodRow[] = (paymentMethodRows || []).map((row) => ({
    id: row.id as string,
    cardBrand: (row.card_brand as string | null) ?? null,
    last4: row.last4 as string,
    expMonth: row.exp_month == null ? null : Number(row.exp_month),
    expYear: row.exp_year == null ? null : Number(row.exp_year),
    cardholderName: (row.cardholder_name as string | null) ?? null,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at as string,
  }))

  return {
    personDetails,
    familyMembers,
    paymentMethods,
  }
}

export async function updateContactPersonDetails(input: {
  contactId: string
  dateOfBirth?: string | null
  gender?: string | null
}) {
  const { supabase, organizationId, contact } = await getContactForOrg(input.contactId)

  if (contact.contact_type !== "individual") {
    throw new Error("Person details apply to individual contacts only.")
  }

  const personId = await ensureContactPersonId(supabase, organizationId, contact)
  const dateOfBirth = normalizeDateOfBirth(input.dateOfBirth, { required: false })

  const { error } = await supabase
    .from("people")
    .update({
      date_of_birth: dateOfBirth,
      gender: input.gender?.trim() || null,
    })
    .eq("organization_id", organizationId)
    .eq("id", personId)

  if (error) {
    throw new Error(error.message || "Could not update person details.")
  }

  revalidatePath(`/contacts/${input.contactId}`)
}

export async function addContactFamilyMember(input: {
  contactId: string
  firstName: string
  lastName: string
  gender?: string | null
  dateOfBirth?: string | null
  email?: string | null
  phone?: string | null
  relationship: string
}) {
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const relationship = input.relationship.trim()
  const email = input.email?.trim().toLowerCase() || null
  const phone = normalizePhone(input.phone) || null

  if (!firstName || !lastName) {
    throw new Error("First and last name are required.")
  }

  if (!relationship) {
    throw new Error("Relationship is required.")
  }

  const { supabase, organizationId, contact } = await getContactForOrg(input.contactId)

  if (isEntityContactType(contact.contact_type)) {
    throw new Error("Family members can only be added to individual contacts.")
  }

  const parentPersonId = await ensureContactPersonId(supabase, organizationId, contact)
  const dateOfBirth = normalizeDateOfBirth(input.dateOfBirth, { required: false })

  const { data: createdPerson, error: personError } = await supabase
    .from("people")
    .insert({
      organization_id: organizationId,
      first_name: firstName,
      last_name: lastName,
      gender: input.gender?.trim() || null,
      date_of_birth: dateOfBirth,
      email,
      phone,
      person_type: "participant",
    })
    .select("id")
    .single()

  if (personError || !createdPerson) {
    throw new Error(personError?.message || "Could not create family member.")
  }

  const { error: relationshipError } = await supabase.from("person_relationships").insert({
    organization_id: organizationId,
    person_id: parentPersonId,
    related_person_id: createdPerson.id,
    relationship_type: relationship,
  })

  if (relationshipError) {
    throw new Error(relationshipError.message || "Could not save family relationship.")
  }

  const { contactId: familyMemberContactId } = await ensureContactForPerson({
    organizationId,
    personId: createdPerson.id as string,
  })

  if (email || phone) {
    const { error: contactUpdateError } = await supabase
      .from("contacts")
      .update({
        email,
        phone,
      })
      .eq("organization_id", organizationId)
      .eq("id", familyMemberContactId)

    if (contactUpdateError) {
      throw new Error(contactUpdateError.message || "Could not save family member contact details.")
    }
  }

  revalidatePath(`/contacts/${input.contactId}`)
  revalidatePath(`/contacts/${familyMemberContactId}`)
  revalidatePath("/customer/profile")

  return { personId: createdPerson.id as string }
}

export async function removeContactFamilyMember(input: {
  contactId: string
  relatedPersonId: string
}) {
  const relatedPersonId = input.relatedPersonId.trim()
  const { supabase, organizationId, contact } = await getContactForOrg(input.contactId)

  if (!contact.person_id) {
    throw new Error("Contact has no linked person record.")
  }

  const { error } = await supabase
    .from("person_relationships")
    .delete()
    .eq("organization_id", organizationId)
    .eq("person_id", contact.person_id)
    .eq("related_person_id", relatedPersonId)

  if (error) {
    throw new Error(error.message || "Could not remove family member.")
  }

  revalidatePath(`/contacts/${input.contactId}`)
  revalidatePath("/customer/profile")

  return { success: true }
}
