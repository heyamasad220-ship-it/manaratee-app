import type { SupabaseClient } from "@supabase/supabase-js"

import {
  deriveHouseholdFamilyName,
  shouldReplaceAutoHouseholdName,
} from "@/lib/contacts/family-name"
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
    contactId?: string | null
    personId?: string | null
    role: FamilyMemberRole
    personRelationshipId?: string | null
  }
) {
  const contactId = input.contactId?.trim() || null
  let personId = input.personId?.trim() || null

  if (!contactId && !personId) {
    throw new Error("Household member needs a contact or person identity.")
  }

  if (contactId && !personId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("person_id")
      .eq("organization_id", input.organizationId)
      .eq("id", contactId)
      .maybeSingle()
    personId = (contact?.person_id as string | null) ?? null
  }

  let existingId: string | null = null

  if (personId) {
    const { data: byPerson, error } = await supabase
      .from("family_members")
      .select("id, family_id")
      .eq("organization_id", input.organizationId)
      .eq("person_id", personId)
      .is("end_date", null)
      .maybeSingle()
    if (error) {
      throw new Error(error.message || "Could not load family membership.")
    }
    if (byPerson?.id) {
      if ((byPerson.family_id as string) !== input.familyId) {
        // Already in another household — keep one active membership; move here.
        const today = new Date().toISOString().slice(0, 10)
        const previousFamilyId = byPerson.family_id as string
        await supabase
          .from("family_members")
          .update({ end_date: today })
          .eq("id", byPerson.id)
        await deactivateFamilyIfEmpty(supabase, input.organizationId, previousFamilyId)
      } else {
        existingId = byPerson.id as string
      }
    }
  }

  if (!existingId && contactId) {
    const { data: byContact, error } = await supabase
      .from("family_members")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("family_id", input.familyId)
      .eq("contact_id", contactId)
      .is("end_date", null)
      .maybeSingle()
    if (error) {
      throw new Error(error.message || "Could not load family membership.")
    }
    existingId = (byContact?.id as string | null) ?? null
  }

  const payload = {
    organization_id: input.organizationId,
    family_id: input.familyId,
    contact_id: contactId,
    person_id: personId,
    role: input.role,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null as string | null,
    person_relationship_id: input.personRelationshipId ?? null,
  }

  if (existingId) {
    const { error } = await supabase
      .from("family_members")
      .update({
        role: input.role,
        end_date: null,
        contact_id: contactId,
        person_id: personId,
        person_relationship_id: input.personRelationshipId ?? null,
      })
      .eq("id", existingId)

    if (error) {
      throw new Error(error.message || "Could not update family membership.")
    }
    return existingId
  }

  const { data: inserted, error } = await supabase
    .from("family_members")
    .insert(payload)
    .select("id")
    .single()

  if (error) {
    throw new Error(error.message || "Could not add family membership.")
  }

  return inserted.id as string
}

/**
 * Ensure a household for this adult contact and sync all person_relationships
 * relatives into it (minors as person-only members; adults with contacts when present).
 * If a child already belongs to another household, this parent joins that household.
 */
export async function syncHouseholdFromParentContact(input: {
  supabase: SupabaseClient
  organizationId: string
  primaryContactId: string
  primaryName?: string | null
}) {
  const { supabase, organizationId, primaryContactId } = input

  const { data: primaryContact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name, person_id, email, phone")
    .eq("organization_id", organizationId)
    .eq("id", primaryContactId)
    .maybeSingle()

  if (contactError || !primaryContact) {
    throw new Error(contactError?.message || "Primary contact not found.")
  }

  const primaryPersonId = primaryContact.person_id as string | null
  if (!primaryPersonId) {
    // No people graph yet — still ensure a one-member household for giving.
    return ensureFamilyForPrimaryContact(
      supabase,
      organizationId,
      primaryContactId,
      input.primaryName || (primaryContact.full_name as string) || "Household"
    )
  }

  const { data: relationships, error: relError } = await supabase
    .from("person_relationships")
    .select("id, related_person_id, relationship_type")
    .eq("organization_id", organizationId)
    .eq("person_id", primaryPersonId)

  if (relError) {
    throw new Error(relError.message || "Could not load family relationships.")
  }

  const relatedPersonIds = (relationships || [])
    .map((row) => row.related_person_id as string)
    .filter(Boolean)

  // If any related person is already in a household, prefer joining that household
  // (so both parents share one family when they both have the same kids).
  let familyId: string | null = null
  for (const relatedPersonId of relatedPersonIds) {
    const { data: existingMember } = await supabase
      .from("family_members")
      .select("family_id, families:family_id ( id, status, primary_contact_id )")
      .eq("organization_id", organizationId)
      .eq("person_id", relatedPersonId)
      .is("end_date", null)
      .maybeSingle()

    const family = Array.isArray(existingMember?.families)
      ? existingMember?.families[0]
      : existingMember?.families

    if (family?.id && family.status === "active") {
      familyId = family.id as string
      break
    }
  }

  if (!familyId) {
    familyId = await ensureFamilyForPrimaryContact(
      supabase,
      organizationId,
      primaryContactId,
      input.primaryName || (primaryContact.full_name as string) || "Household"
    )
  } else {
    const existing = await findActiveFamilyForContact(
      supabase,
      organizationId,
      primaryContactId
    )
    if (existing?.id && existing.id !== familyId) {
      await endActiveMembershipsForContact(supabase, organizationId, primaryContactId, {
        exceptFamilyId: familyId,
      })
    }
  }

  const { data: familyRow } = await supabase
    .from("families")
    .select("primary_contact_id")
    .eq("organization_id", organizationId)
    .eq("id", familyId)
    .maybeSingle()

  const primaryRole =
    familyRow?.primary_contact_id === primaryContactId ? "head" : "spouse"

  await upsertActiveFamilyMember(supabase, {
    organizationId,
    familyId,
    contactId: primaryContactId,
    personId: primaryPersonId,
    role: primaryRole,
  })

  // Resolve contacts for related people (adults only).
  const contactByPersonId = new Map<string, string>()
  if (relatedPersonIds.length > 0) {
    const { data: relatedContacts } = await supabase
      .from("contacts")
      .select("id, person_id")
      .eq("organization_id", organizationId)
      .in("person_id", relatedPersonIds)

    for (const row of relatedContacts || []) {
      if (row.person_id) {
        contactByPersonId.set(row.person_id as string, row.id as string)
      }
    }
  }

  const { data: relatedPeople } = await supabase
    .from("people")
    .select("id, date_of_birth, last_name")
    .eq("organization_id", organizationId)
    .in("id", relatedPersonIds.length > 0 ? relatedPersonIds : ["00000000-0000-0000-0000-000000000000"])

  const ageByPersonId = new Map<string, number | null>()
  const childLastNames: string[] = []
  for (const person of relatedPeople || []) {
    ageByPersonId.set(person.id as string, calculateAgeYears(person.date_of_birth as string | null))
  }

  for (const relationship of relationships || []) {
    const relatedPersonId = relationship.related_person_id as string
    const relationshipType = (relationship.relationship_type as string) || "other"
    const age = ageByPersonId.get(relatedPersonId) ?? null
    const isMinor =
      relationshipType === "child" || (age !== null && age < 18)
    const relatedContactId = isMinor
      ? null
      : (contactByPersonId.get(relatedPersonId) ?? null)

    if (relationshipType === "child" || isMinor) {
      const person = relatedPeople?.find((row) => row.id === relatedPersonId)
      if (person?.last_name) {
        childLastNames.push(person.last_name as string)
      }
    }

    await upsertActiveFamilyMember(supabase, {
      organizationId,
      familyId,
      contactId: relatedContactId,
      personId: relatedPersonId,
      role: mapRelationshipToFamilyRole(relationshipType),
      personRelationshipId: relationship.id as string,
    })
  }

  await maybeRenameHouseholdToKidsLastName(supabase, {
    organizationId,
    familyId,
    parentFullName:
      input.primaryName || (primaryContact.full_name as string | null) || null,
    childLastNames,
  })

  // Spouses/partners often hold the kids under their own person graph — pull those
  // dependents into this household so both parents share one family roster.
  for (const relationship of relationships || []) {
    const relationshipType = String(relationship.relationship_type || "").toLowerCase()
    if (relationshipType !== "spouse" && relationshipType !== "partner") continue
    const relatedPersonId = relationship.related_person_id as string
    const relatedContactId = contactByPersonId.get(relatedPersonId)
    if (!relatedContactId) continue
    await importContactDependentsIntoHousehold({
      supabase,
      organizationId,
      familyId,
      sourceContactId: relatedContactId,
      mirrorToContactId: primaryContactId,
    })
  }

  return familyId
}

/**
 * Import a contact's child dependents into a household, and optionally mirror
 * those children onto another parent's person_relationships (so both Family panels list them).
 */
export async function importContactDependentsIntoHousehold(input: {
  supabase: SupabaseClient
  organizationId: string
  familyId: string
  sourceContactId: string
  mirrorToContactId?: string | null
}): Promise<{ importedChildPersonIds: string[] }> {
  const { supabase, organizationId, familyId, sourceContactId } = input
  const importedChildPersonIds: string[] = []

  const { data: sourceContact } = await supabase
    .from("contacts")
    .select("id, person_id")
    .eq("organization_id", organizationId)
    .eq("id", sourceContactId)
    .maybeSingle()

  const sourcePersonId = sourceContact?.person_id as string | null
  if (!sourcePersonId) return { importedChildPersonIds }

  let mirrorPersonId: string | null = null
  if (input.mirrorToContactId) {
    const { data: mirrorContact } = await supabase
      .from("contacts")
      .select("person_id")
      .eq("organization_id", organizationId)
      .eq("id", input.mirrorToContactId)
      .maybeSingle()
    mirrorPersonId = (mirrorContact?.person_id as string | null) ?? null
  }

  const { data: childRels, error: childRelError } = await supabase
    .from("person_relationships")
    .select("id, related_person_id, relationship_type")
    .eq("organization_id", organizationId)
    .eq("person_id", sourcePersonId)
    .eq("relationship_type", "child")

  if (childRelError) {
    throw new Error(childRelError.message || "Could not load dependents.")
  }

  const childPersonIds = (childRels || [])
    .map((row) => row.related_person_id as string)
    .filter(Boolean)

  if (childPersonIds.length === 0) return { importedChildPersonIds }

  const { data: childPeople } = await supabase
    .from("people")
    .select("id, date_of_birth")
    .eq("organization_id", organizationId)
    .in("id", childPersonIds)

  const { data: childContacts } = await supabase
    .from("contacts")
    .select("id, person_id")
    .eq("organization_id", organizationId)
    .in("person_id", childPersonIds)

  const contactByPersonId = new Map(
    (childContacts || []).map((row) => [row.person_id as string, row.id as string])
  )

  for (const child of childPeople || []) {
    const childPersonId = child.id as string
    const age = calculateAgeYears(child.date_of_birth as string | null)
    const isMinor = age === null || age < 18
    const childContactId = isMinor ? null : (contactByPersonId.get(childPersonId) ?? null)

    const sourceRel = (childRels || []).find(
      (row) => row.related_person_id === childPersonId
    )

    await upsertActiveFamilyMember(supabase, {
      organizationId,
      familyId,
      contactId: childContactId,
      personId: childPersonId,
      role: "child",
      personRelationshipId: (sourceRel?.id as string | null) ?? null,
    })
    importedChildPersonIds.push(childPersonId)

    if (mirrorPersonId && mirrorPersonId !== childPersonId) {
      await ensurePersonRelationship(supabase, {
        organizationId,
        personId: mirrorPersonId,
        relatedPersonId: childPersonId,
        relationshipType: "child",
      })
    }
  }

  return { importedChildPersonIds }
}

async function ensurePersonRelationship(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    personId: string
    relatedPersonId: string
    relationshipType: string
  }
): Promise<string> {
  const { data: existing } = await supabase
    .from("person_relationships")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("person_id", input.personId)
    .eq("related_person_id", input.relatedPersonId)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data, error } = await supabase
    .from("person_relationships")
    .insert({
      organization_id: input.organizationId,
      person_id: input.personId,
      related_person_id: input.relatedPersonId,
      relationship_type: input.relationshipType,
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Could not save person relationship.")
  }

  return data.id as string
}

async function maybeRenameHouseholdToKidsLastName(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    familyId: string
    parentFullName: string | null
    childLastNames: string[]
  }
) {
  if (input.childLastNames.length === 0) return

  const derived = deriveHouseholdFamilyName({
    childLastNames: input.childLastNames,
    parentFullName: input.parentFullName,
  })

  const { data: family } = await supabase
    .from("families")
    .select("name")
    .eq("organization_id", input.organizationId)
    .eq("id", input.familyId)
    .maybeSingle()

  const currentName = (family?.name as string | null) ?? null
  if (!currentName) return
  if (currentName === derived) return

  // Rename auto names like "Fadey Suleiman Family" / "Suleiman Family" → "Suleiman".
  // Leave custom names alone.
  if (
    !shouldReplaceAutoHouseholdName(currentName, derived, input.parentFullName)
  ) {
    return
  }

  await supabase
    .from("families")
    .update({ name: derived })
    .eq("organization_id", input.organizationId)
    .eq("id", input.familyId)
}

function calculateAgeYears(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null
  const today = new Date()
  const birth = new Date(`${dateOfBirth}T00:00:00`)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
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

  const childLastNames = await loadChildLastNamesForContact(
    supabase,
    organizationId,
    primaryContactId
  )
  const familyName = deriveHouseholdFamilyName({
    childLastNames,
    parentFullName: primaryName,
  })

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

async function loadChildLastNamesForContact(
  supabase: SupabaseClient,
  organizationId: string,
  primaryContactId: string
): Promise<string[]> {
  const { data: contact } = await supabase
    .from("contacts")
    .select("person_id")
    .eq("organization_id", organizationId)
    .eq("id", primaryContactId)
    .maybeSingle()

  const parentPersonId = contact?.person_id as string | null
  if (!parentPersonId) return []

  const { data: relationships } = await supabase
    .from("person_relationships")
    .select("related_person_id, relationship_type")
    .eq("organization_id", organizationId)
    .eq("person_id", parentPersonId)

  const childPersonIds = (relationships || [])
    .filter((row) => String(row.relationship_type || "").toLowerCase() === "child")
    .map((row) => row.related_person_id as string)
    .filter(Boolean)

  if (childPersonIds.length === 0) return []

  const { data: people } = await supabase
    .from("people")
    .select("last_name")
    .eq("organization_id", organizationId)
    .in("id", childPersonIds)

  return (people || [])
    .map((row) => (row.last_name as string | null) || "")
    .filter(Boolean)
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
    .select("id, family_id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .is("end_date", null)

  if (options?.exceptFamilyId) {
    query = query.neq("family_id", options.exceptFamilyId)
  }

  const { data: memberships, error: loadError } = await query
  if (loadError) {
    throw new Error(loadError.message || "Could not load family membership.")
  }

  const familyIds = [
    ...new Set((memberships || []).map((row) => row.family_id as string).filter(Boolean)),
  ]

  if ((memberships || []).length > 0) {
    const { error } = await supabase
      .from("family_members")
      .update({ end_date: today })
      .in(
        "id",
        (memberships || []).map((row) => row.id as string)
      )

    if (error) {
      throw new Error(error.message || "Could not end family membership.")
    }
  }

  for (const familyId of familyIds) {
    await deactivateFamilyIfEmpty(supabase, organizationId, familyId)
  }
}

/** Mark a household inactive when it has no remaining active members. */
export async function deactivateFamilyIfEmpty(
  supabase: SupabaseClient,
  organizationId: string,
  familyId: string
) {
  const { count, error: countError } = await supabase
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("family_id", familyId)
    .is("end_date", null)

  if (countError) {
    throw new Error(countError.message || "Could not count family members.")
  }

  if ((count ?? 0) > 0) return

  await supabase
    .from("families")
    .update({ status: "inactive" })
    .eq("id", familyId)
    .eq("organization_id", organizationId)
    .eq("status", "active")
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
    await deactivateFamilyIfEmpty(supabase, organizationId, family.id as string)
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
  /** Prefer membership row id when removing person-only minors. */
  memberId?: string | null
  memberContactId?: string | null
  memberPersonId?: string | null
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

  let membershipQuery = input.supabase
    .from("family_members")
    .select("id, contact_id, person_id")
    .eq("organization_id", input.organizationId)
    .eq("family_id", input.familyId)
    .is("end_date", null)

  if (input.memberId) {
    membershipQuery = membershipQuery.eq("id", input.memberId)
  } else if (input.memberContactId) {
    membershipQuery = membershipQuery.eq("contact_id", input.memberContactId)
  } else if (input.memberPersonId) {
    membershipQuery = membershipQuery.eq("person_id", input.memberPersonId)
  } else {
    throw new Error("Household member identity is required.")
  }

  const { data: activeMembership, error: membershipError } =
    await membershipQuery.maybeSingle()

  if (membershipError) {
    throw new Error(membershipError.message || "Could not load household membership.")
  }

  if (!activeMembership?.id) {
    throw new Error("This person is not an active member of the household.")
  }

  const memberContactId = (activeMembership.contact_id as string | null) ?? null
  const memberPersonId = (activeMembership.person_id as string | null) ?? null

  const { data: activeMembers, error: membersError } = await input.supabase
    .from("family_members")
    .select("id, contact_id, person_id")
    .eq("organization_id", input.organizationId)
    .eq("family_id", input.familyId)
    .is("end_date", null)

  if (membersError) {
    throw new Error(membersError.message || "Could not load household members.")
  }

  const otherMembers = (activeMembers || []).filter(
    (row) => (row.id as string) !== (activeMembership.id as string)
  )

  if (
    memberContactId &&
    family.primary_contact_id === memberContactId &&
    otherMembers.length > 0
  ) {
    throw new Error(
      "Change the primary contact / head before removing this member from the household."
    )
  }

  let removedPersonId = memberPersonId
  if (!removedPersonId && memberContactId) {
    const { data: removedContact } = await input.supabase
      .from("contacts")
      .select("person_id")
      .eq("organization_id", input.organizationId)
      .eq("id", memberContactId)
      .maybeSingle()
    removedPersonId = (removedContact?.person_id as string | null) ?? null
  }

  if (removedPersonId) {
    for (const member of otherMembers) {
      let otherPersonId = (member.person_id as string | null) ?? null
      if (!otherPersonId && member.contact_id) {
        const { data: otherContact } = await input.supabase
          .from("contacts")
          .select("person_id")
          .eq("organization_id", input.organizationId)
          .eq("id", member.contact_id as string)
          .maybeSingle()
        otherPersonId = (otherContact?.person_id as string | null) ?? null
      }
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
    .eq("id", activeMembership.id as string)

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
    removedContactId: memberContactId,
    remainingContactIds: otherMembers
      .map((row) => row.contact_id as string | null)
      .filter((id): id is string => Boolean(id)),
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
