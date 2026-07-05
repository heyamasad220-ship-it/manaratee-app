import type { SupabaseClient } from "@supabase/supabase-js"

import type { FamilyMemberRole } from "@/lib/contacts/family-types"

export function mapRelationshipToFamilyRole(relationshipType: string): FamilyMemberRole {
  switch (relationshipType.trim().toLowerCase()) {
    case "spouse":
      return "spouse"
    case "child":
      return "child"
    case "parent":
      return "parent"
    case "sibling":
      return "sibling"
    case "guardian":
      return "guardian"
    case "head":
      return "head"
    default:
      return "other"
  }
}

export async function findActiveFamilyForContact(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string
) {
  const { data: asPrimary, error: primaryError } = await supabase
    .from("families")
    .select("id, name, status, primary_contact_id")
    .eq("organization_id", organizationId)
    .eq("primary_contact_id", contactId)
    .eq("status", "active")
    .maybeSingle()

  if (primaryError) {
    throw new Error(primaryError.message || "Could not load family record.")
  }

  if (asPrimary?.id) {
    return {
      id: asPrimary.id as string,
      name: asPrimary.name as string,
      status: asPrimary.status as string,
      primaryContactId: (asPrimary.primary_contact_id as string | null) ?? null,
      isPrimary: true,
    }
  }

  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select(
      `
      family_id,
      role,
      families:family_id (
        id,
        name,
        status,
        primary_contact_id
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .is("end_date", null)
    .maybeSingle()

  if (membershipError) {
    throw new Error(membershipError.message || "Could not load family membership.")
  }

  const family = Array.isArray(membership?.families)
    ? membership?.families[0]
    : membership?.families

  if (!family?.id || family.status !== "active") {
    return null
  }

  return {
    id: family.id as string,
    name: family.name as string,
    status: family.status as string,
    primaryContactId: (family.primary_contact_id as string | null) ?? null,
    isPrimary: family.primary_contact_id === contactId,
    memberRole: (membership?.role as string | null) ?? null,
  }
}

async function upsertActiveFamilyMember(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    familyId: string
    contactId: string
    role: FamilyMemberRole
    personRelationshipId?: string | null
  }
) {
  const { data: existing, error: loadError } = await supabase
    .from("family_members")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("family_id", input.familyId)
    .eq("contact_id", input.contactId)
    .is("end_date", null)
    .maybeSingle()

  if (loadError) {
    throw new Error(loadError.message || "Could not load family membership.")
  }

  const payload = {
    organization_id: input.organizationId,
    family_id: input.familyId,
    contact_id: input.contactId,
    role: input.role,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
    person_relationship_id: input.personRelationshipId ?? null,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("family_members")
      .update({ role: input.role, end_date: null })
      .eq("id", existing.id)

    if (error) {
      throw new Error(error.message || "Could not update family membership.")
    }
    return
  }

  const { error } = await supabase.from("family_members").insert(payload)

  if (error) {
    throw new Error(error.message || "Could not add family membership.")
  }
}

export async function ensureFamilyForPrimaryContact(
  supabase: SupabaseClient,
  organizationId: string,
  primaryContactId: string,
  primaryName: string
) {
  const existing = await findActiveFamilyForContact(supabase, organizationId, primaryContactId)
  if (existing?.id) {
    if (existing.isPrimary) {
      await upsertActiveFamilyMember(supabase, {
        organizationId,
        familyId: existing.id,
        contactId: primaryContactId,
        role: "head",
      })
    }
    return existing.id
  }

  const familyName = `${primaryName.trim() || "Household"} Family`

  const { data: created, error: createError } = await supabase
    .from("families")
    .insert({
      organization_id: organizationId,
      name: familyName,
      status: "active",
      primary_contact_id: primaryContactId,
    })
    .select("id")
    .single()

  if (createError || !created) {
    throw new Error(createError?.message || "Could not create family record.")
  }

  const familyId = created.id as string

  await upsertActiveFamilyMember(supabase, {
    organizationId,
    familyId,
    contactId: primaryContactId,
    role: "head",
  })

  return familyId
}

export async function endActiveMembershipsForContact(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string,
  options?: { exceptFamilyId?: string }
) {
  const today = new Date().toISOString().slice(0, 10)

  let query = supabase
    .from("family_members")
    .update({ end_date: today })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .is("end_date", null)

  if (options?.exceptFamilyId) {
    query = query.neq("family_id", options.exceptFamilyId)
  }

  const { error } = await query

  if (error) {
    throw new Error(error.message || "Could not end family membership.")
  }
}

export async function deactivateEmptyPrimaryFamilies(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string
) {
  const { data: families, error } = await supabase
    .from("families")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("primary_contact_id", contactId)
    .eq("status", "active")

  if (error) {
    throw new Error(error.message || "Could not load prior family records.")
  }

  for (const family of families || []) {
    const { count, error: countError } = await supabase
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("family_id", family.id)
      .is("end_date", null)

    if (countError) {
      throw new Error(countError.message || "Could not count family members.")
    }

    if ((count ?? 0) === 0) {
      await supabase
        .from("families")
        .update({ status: "inactive" })
        .eq("id", family.id)
        .eq("organization_id", organizationId)
    }
  }
}

export async function assertCanMoveContactFromPrimaryFamily(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string,
  targetFamilyId: string
) {
  const { data: primaryFamilies, error } = await supabase
    .from("families")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("primary_contact_id", contactId)
    .eq("status", "active")
    .neq("id", targetFamilyId)

  if (error) {
    throw new Error(error.message || "Could not verify existing household.")
  }

  for (const family of primaryFamilies || []) {
    const { data: otherMembers, error: membersError } = await supabase
      .from("family_members")
      .select("id, contact_id")
      .eq("organization_id", organizationId)
      .eq("family_id", family.id)
      .is("end_date", null)
      .neq("contact_id", contactId)

    if (membersError) {
      throw new Error(membersError.message || "Could not verify household members.")
    }

    if ((otherMembers || []).length > 0) {
      throw new Error(
        `${family.name} still has other active members. Change the household head or move those members before linking this contact elsewhere.`
      )
    }
  }
}

export async function syncFamilyMemberAdded(input: {
  supabase: SupabaseClient
  organizationId: string
  primaryContactId: string
  primaryName: string
  memberContactId: string
  relationshipType: string
  personRelationshipId?: string | null
}) {
  const familyId = await ensureFamilyForPrimaryContact(
    input.supabase,
    input.organizationId,
    input.primaryContactId,
    input.primaryName
  )

  await upsertActiveFamilyMember(input.supabase, {
    organizationId: input.organizationId,
    familyId,
    contactId: input.memberContactId,
    role: mapRelationshipToFamilyRole(input.relationshipType),
    personRelationshipId: input.personRelationshipId,
  })

  return familyId
}

export async function endFamilyMembership(input: {
  supabase: SupabaseClient
  organizationId: string
  primaryContactId: string
  memberContactId: string
}) {
  const family = await findActiveFamilyForContact(
    input.supabase,
    input.organizationId,
    input.primaryContactId
  )

  if (!family?.id) return

  await removeMemberFromHousehold({
    supabase: input.supabase,
    organizationId: input.organizationId,
    familyId: family.id,
    memberContactId: input.memberContactId,
  })
}

async function deletePersonRelationshipsBetween(
  supabase: SupabaseClient,
  organizationId: string,
  personIdA: string,
  personIdB: string
) {
  const { error: forwardError } = await supabase
    .from("person_relationships")
    .delete()
    .eq("organization_id", organizationId)
    .eq("person_id", personIdA)
    .eq("related_person_id", personIdB)

  if (forwardError) {
    throw new Error(forwardError.message || "Could not remove family relationship.")
  }

  const { error: reverseError } = await supabase
    .from("person_relationships")
    .delete()
    .eq("organization_id", organizationId)
    .eq("person_id", personIdB)
    .eq("related_person_id", personIdA)

  if (reverseError) {
    throw new Error(reverseError.message || "Could not remove family relationship.")
  }
}

export async function removeMemberFromHousehold(input: {
  supabase: SupabaseClient
  organizationId: string
  familyId: string
  memberContactId: string
}) {
  const { data: family, error: familyError } = await input.supabase
    .from("families")
    .select("id, primary_contact_id, status")
    .eq("organization_id", input.organizationId)
    .eq("id", input.familyId)
    .maybeSingle()

  if (familyError || !family) {
    throw new Error(familyError?.message || "Household not found.")
  }

  const { data: activeMembership, error: membershipError } = await input.supabase
    .from("family_members")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("family_id", input.familyId)
    .eq("contact_id", input.memberContactId)
    .is("end_date", null)
    .maybeSingle()

  if (membershipError) {
    throw new Error(membershipError.message || "Could not load household membership.")
  }

  if (!activeMembership?.id) {
    throw new Error("This contact is not an active member of the household.")
  }

  const { data: activeMembers, error: membersError } = await input.supabase
    .from("family_members")
    .select(
      `
      contact_id,
      contact:contact_id ( person_id )
    `
    )
    .eq("organization_id", input.organizationId)
    .eq("family_id", input.familyId)
    .is("end_date", null)

  if (membersError) {
    throw new Error(membersError.message || "Could not load household members.")
  }

  const otherMembers = (activeMembers || []).filter(
    (row) => (row.contact_id as string) !== input.memberContactId
  )

  if (
    family.primary_contact_id === input.memberContactId &&
    otherMembers.length > 0
  ) {
    throw new Error(
      "Change the primary contact / head before removing this member from the household."
    )
  }

  const { data: removedContact, error: removedContactError } = await input.supabase
    .from("contacts")
    .select("person_id")
    .eq("organization_id", input.organizationId)
    .eq("id", input.memberContactId)
    .maybeSingle()

  if (removedContactError) {
    throw new Error(removedContactError.message || "Could not load member contact.")
  }

  const removedPersonId = (removedContact?.person_id as string | null) ?? null

  if (removedPersonId) {
    for (const member of otherMembers) {
      const contact = Array.isArray(member.contact) ? member.contact[0] : member.contact
      const otherPersonId = (contact?.person_id as string | null) ?? null
      if (!otherPersonId) continue

      await deletePersonRelationshipsBetween(
        input.supabase,
        input.organizationId,
        removedPersonId,
        otherPersonId
      )
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const { error: endError } = await input.supabase
    .from("family_members")
    .update({ end_date: today })
    .eq("organization_id", input.organizationId)
    .eq("family_id", input.familyId)
    .eq("contact_id", input.memberContactId)
    .is("end_date", null)

  if (endError) {
    throw new Error(endError.message || "Could not remove household member.")
  }

  if (otherMembers.length === 0) {
    await input.supabase
      .from("families")
      .update({ status: "inactive" })
      .eq("organization_id", input.organizationId)
      .eq("id", input.familyId)
  }

  return {
    familyId: input.familyId,
    removedContactId: input.memberContactId,
    remainingContactIds: otherMembers.map((row) => row.contact_id as string),
  }
}

export async function findFamilyIdForPrimaryContact(
  supabase: SupabaseClient,
  organizationId: string,
  primaryContactId: string
) {
  const family = await findActiveFamilyForContact(supabase, organizationId, primaryContactId)
  return family?.isPrimary ? family.id : null
}

export { upsertActiveFamilyMember }
