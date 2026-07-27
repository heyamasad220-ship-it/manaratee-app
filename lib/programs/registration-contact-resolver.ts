import { createClient } from "@/lib/supabase/server"

export type CustomerContact = {
  id: string
  person_id: string | null
  full_name: string | null
  email: string | null
  phone: string | null
}

export type ContactLookupResult = {
  contactId: string | null
  warning: string | null
}

export async function lookupContactByPersonId(
  organizationId: string,
  personId: string
): Promise<ContactLookupResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("person_id", personId)
    .maybeSingle()

  if (error) {
    console.error("lookupContactByPersonId failed", {
      organizationId,
      personId,
      message: error.message,
    })
    return {
      contactId: null,
      warning: "Could not verify participant contact record.",
    }
  }

  if (!data?.id) {
    console.warn("Missing contact for person — migration required", {
      organizationId,
      personId,
    })
    return {
      contactId: null,
      warning:
        "This participant does not have a linked contact record yet. Ask your organization administrator to link or migrate contacts before registering.",
    }
  }

  return { contactId: data.id, warning: null }
}

export async function lookupContactsByPersonIds(
  organizationId: string,
  personIds: string[]
) {
  if (personIds.length === 0) {
    return new Map<string, string>()
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("id, person_id")
    .eq("organization_id", organizationId)
    .in("person_id", personIds)

  if (error) {
    console.error("lookupContactsByPersonIds failed", error.message)
    return new Map<string, string>()
  }

  const map = new Map<string, string>()
  for (const row of data || []) {
    if (row.person_id) {
      map.set(row.person_id as string, row.id as string)
    }
  }

  return map
}

export async function getCustomerContactForUser(
  organizationId: string,
  userId: string
): Promise<CustomerContact | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("id, person_id, full_name, email, phone")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as CustomerContact
}

export async function verifyParticipantPersonInRegistrantFamily(input: {
  organizationId: string
  registrantPersonId: string
  participantPersonId: string
}) {
  const supabase = await createClient()

  const { data: relationship, error: relationshipError } = await supabase
    .from("person_relationships")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("person_id", input.registrantPersonId)
    .eq("related_person_id", input.participantPersonId)
    .maybeSingle()

  if (relationshipError) {
    return false
  }

  return Boolean(relationship)
}

export async function verifyParticipantInRegistrantFamily(input: {
  organizationId: string
  registrantPersonId: string
  participantContactId: string
}) {
  const supabase = await createClient()

  const { data: participantContact, error: participantError } = await supabase
    .from("contacts")
    .select("id, person_id")
    .eq("organization_id", input.organizationId)
    .eq("id", input.participantContactId)
    .maybeSingle()

  if (participantError || !participantContact?.person_id) {
    return false
  }

  return verifyParticipantPersonInRegistrantFamily({
    organizationId: input.organizationId,
    registrantPersonId: input.registrantPersonId,
    participantPersonId: participantContact.person_id as string,
  })
}

export async function verifyContactInOrganization(
  organizationId: string,
  contactId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("id, person_id, full_name, email, phone")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}
