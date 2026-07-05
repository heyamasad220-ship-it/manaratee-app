"use server"

import { revalidatePath } from "next/cache"

import {
  assertCanMoveContactFromPrimaryFamily,
  deactivateEmptyPrimaryFamilies,
  endActiveMembershipsForContact,
  ensureFamilyForPrimaryContact,
  findActiveFamilyForContact,
  mapRelationshipToFamilyRole,
  removeMemberFromHousehold,
  upsertActiveFamilyMember,
} from "@/lib/contacts/family-sync"
import { requireContactsManageAccess, requireContactsViewAccess } from "@/lib/contacts/group-member-access"
import { isEntityContactType } from "@/lib/contacts/contact-constants"

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

async function getIndividualContact(
  supabase: Awaited<ReturnType<typeof requireContactsManageAccess>>["supabase"],
  organizationId: string,
  contactId: string
) {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, full_name, contact_type, person_id")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (error || !data) {
    throw new Error(error?.message || "Contact not found.")
  }

  if (isEntityContactType(data.contact_type)) {
    throw new Error("Only individual contacts can belong to a household.")
  }

  return data
}

async function syncPersonRelationship(
  supabase: Awaited<ReturnType<typeof requireContactsManageAccess>>["supabase"],
  organizationId: string,
  anchorPersonId: string,
  memberPersonId: string,
  relationshipType: string
) {
  const { data: existing } = await supabase
    .from("person_relationships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("person_id", anchorPersonId)
    .eq("related_person_id", memberPersonId)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data, error } = await supabase
    .from("person_relationships")
    .insert({
      organization_id: organizationId,
      person_id: anchorPersonId,
      related_person_id: memberPersonId,
      relationship_type: relationshipType,
    })
    .select("id")
    .single()

  if (error) {
    throw new Error(error.message || "Could not save person relationship.")
  }

  return data.id as string
}

export async function getFamilyForContactAction(contactId: string) {
  const access = await requireContactsViewAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const family = await findActiveFamilyForContact(
      access.supabase,
      access.organizationId,
      contactId
    )

    if (!family) {
      return { success: true as const, family: null }
    }

    return {
      success: true as const,
      family: {
        id: family.id,
        name: family.name,
        primaryContactId: family.primaryContactId,
        isPrimary: family.isPrimary,
        memberRole: family.memberRole ?? null,
      },
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load household.",
    }
  }
}

export async function getFamilySettingsAction(familyId: string) {
  const access = await requireContactsViewAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: family, error } = await access.supabase
    .from("families")
    .select("id, name, status, primary_contact_id")
    .eq("organization_id", access.organizationId)
    .eq("id", familyId)
    .maybeSingle()

  if (error) return { success: false as const, error: error.message }
  if (!family) return { success: false as const, error: "Household not found." }

  const { data: members, error: membersError } = await access.supabase
    .from("family_members")
    .select(
      `
      id,
      contact_id,
      role,
      contact:contact_id ( full_name )
    `
    )
    .eq("organization_id", access.organizationId)
    .eq("family_id", familyId)
    .is("end_date", null)
    .order("role", { ascending: true })

  if (membersError) return { success: false as const, error: membersError.message }

  return {
    success: true as const,
    settings: {
      id: family.id as string,
      name: family.name as string,
      status: family.status as string,
      primaryContactId: (family.primary_contact_id as string | null) ?? null,
      members: (members || []).map((row) => {
        const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact
        return {
          id: row.id as string,
          contactId: row.contact_id as string,
          role: row.role as string,
          fullName: (contact?.full_name as string | null) ?? "Unnamed",
        }
      }),
    },
  }
}

export async function updateFamilySettingsAction(input: {
  familyId: string
  name?: string
  primaryContactId?: string
}) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  const familyId = input.familyId.trim()
  const name = input.name?.trim()

  if (!familyId) {
    return { success: false as const, error: "Household is required." }
  }

  if (name !== undefined && !name) {
    return { success: false as const, error: "Household name cannot be empty." }
  }

  try {
    const { data: family, error: familyError } = await access.supabase
      .from("families")
      .select("id, primary_contact_id")
      .eq("organization_id", access.organizationId)
      .eq("id", familyId)
      .eq("status", "active")
      .maybeSingle()

    if (familyError || !family) {
      return { success: false as const, error: "Household not found." }
    }

    const updates: Record<string, string> = {}
    if (name) updates.name = name

    if (input.primaryContactId) {
      const { data: membership, error: membershipError } = await access.supabase
        .from("family_members")
        .select("id, role")
        .eq("organization_id", access.organizationId)
        .eq("family_id", familyId)
        .eq("contact_id", input.primaryContactId)
        .is("end_date", null)
        .maybeSingle()

      if (membershipError || !membership) {
        return {
          success: false as const,
          error: "The selected head must be an active member of this household.",
        }
      }

      updates.primary_contact_id = input.primaryContactId

      const previousPrimaryId = family.primary_contact_id as string | null

      await access.supabase
        .from("family_members")
        .update({ role: "head" })
        .eq("organization_id", access.organizationId)
        .eq("family_id", familyId)
        .eq("contact_id", input.primaryContactId)
        .is("end_date", null)

      if (previousPrimaryId && previousPrimaryId !== input.primaryContactId) {
        const { data: previousMembership } = await access.supabase
          .from("family_members")
          .select("role")
          .eq("organization_id", access.organizationId)
          .eq("family_id", familyId)
          .eq("contact_id", previousPrimaryId)
          .is("end_date", null)
          .maybeSingle()

        if (previousMembership?.role === "head") {
          await access.supabase
            .from("family_members")
            .update({ role: "spouse" })
            .eq("organization_id", access.organizationId)
            .eq("family_id", familyId)
            .eq("contact_id", previousPrimaryId)
            .is("end_date", null)
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await access.supabase
        .from("families")
        .update(updates)
        .eq("organization_id", access.organizationId)
        .eq("id", familyId)

      if (updateError) {
        return { success: false as const, error: updateError.message }
      }
    }

    const { data: memberRows } = await access.supabase
      .from("family_members")
      .select("contact_id")
      .eq("organization_id", access.organizationId)
      .eq("family_id", familyId)
      .is("end_date", null)

    for (const row of memberRows || []) {
      revalidatePath(`/contacts/${row.contact_id as string}`)
    }

    revalidatePath(`/contacts/families/${familyId}`)
    revalidatePath("/contacts/families")

    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not update household.",
    }
  }
}

export async function linkExistingContactToFamilyAction(input: {
  anchorContactId: string
  memberContactId: string
  relationship: string
}) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  const relationship = input.relationship.trim()
  if (!relationship) {
    return { success: false as const, error: "Relationship is required." }
  }

  if (input.anchorContactId === input.memberContactId) {
    return { success: false as const, error: "A contact cannot be linked to themselves." }
  }

  try {
    const anchor = await getIndividualContact(
      access.supabase,
      access.organizationId,
      input.anchorContactId
    )
    const member = await getIndividualContact(
      access.supabase,
      access.organizationId,
      input.memberContactId
    )

    const existingFamily = await findActiveFamilyForContact(
      access.supabase,
      access.organizationId,
      anchor.id as string
    )

    const familyId =
      existingFamily?.id ??
      (await ensureFamilyForPrimaryContact(
        access.supabase,
        access.organizationId,
        anchor.id as string,
        (anchor.full_name as string | null) || "Household"
      ))

    await assertCanMoveContactFromPrimaryFamily(
      access.supabase,
      access.organizationId,
      member.id as string,
      familyId
    )

    await endActiveMembershipsForContact(
      access.supabase,
      access.organizationId,
      member.id as string,
      { exceptFamilyId: familyId }
    )

    await deactivateEmptyPrimaryFamilies(
      access.supabase,
      access.organizationId,
      member.id as string
    )

    let personRelationshipId: string | null = null
    if (anchor.person_id && member.person_id) {
      personRelationshipId = await syncPersonRelationship(
        access.supabase,
        access.organizationId,
        anchor.person_id as string,
        member.person_id as string,
        relationship
      )
    }

    await upsertActiveFamilyMember(access.supabase, {
      organizationId: access.organizationId,
      familyId,
      contactId: member.id as string,
      role: mapRelationshipToFamilyRole(relationship),
      personRelationshipId,
    })

    revalidatePath(`/contacts/${anchor.id}`)
    revalidatePath(`/contacts/${member.id}`)
    revalidatePath(`/contacts/families/${familyId}`)
    revalidatePath("/contacts/families")

    return { success: true as const, familyId }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not link contact to household.",
    }
  }
}

export async function searchContactsForFamilyLinkAction(search: string, limit = 30) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  let query = access.supabase
    .from("contacts")
    .select("id, full_name, email, phone, contact_type")
    .eq("organization_id", access.organizationId)
    .eq("contact_type", "individual")
    .order("full_name", { ascending: true })
    .limit(Math.min(limit, 50))

  if (search.trim()) {
    const term = `%${escapeIlike(search.trim())}%`
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
  }

  const { data, error } = await query
  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    contacts: (data || []).map((row) => ({
      contactId: row.id as string,
      full_name: row.full_name as string | null,
      email: row.email as string | null,
      phone: row.phone as string | null,
    })),
  }
}

export async function removeHouseholdMemberAction(input: {
  familyId: string
  memberContactId: string
}) {
  const access = await requireContactsManageAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  const familyId = input.familyId.trim()
  const memberContactId = input.memberContactId.trim()

  if (!familyId || !memberContactId) {
    return { success: false as const, error: "Household and member are required." }
  }

  try {
    const result = await removeMemberFromHousehold({
      supabase: access.supabase,
      organizationId: access.organizationId,
      familyId,
      memberContactId,
    })

    revalidatePath(`/contacts/${memberContactId}`)
    for (const contactId of result.remainingContactIds) {
      revalidatePath(`/contacts/${contactId}`)
    }
    revalidatePath(`/contacts/families/${familyId}`)
    revalidatePath("/contacts/families")
    revalidatePath("/customer/profile")

    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not remove household member.",
    }
  }
}
