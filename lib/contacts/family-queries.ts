"use server"

import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { fetchFamilyListSummaries } from "@/lib/contacts/family-giving-data"

export type FamilyHouseholdSummary = {
  id: string
  primaryPersonId: string | null
  primaryContactId: string | null
  primaryName: string
  primaryEmail: string | null
  memberCount: number
  lifetimeTotal: number
  giftCount: number
  lastGiftDate: string | null
  relationshipTypes: string[]
}

/** @deprecated Use fetchFamilyListSummariesAction for new code. Kept for legacy callers during migration. */
export async function fetchFamilyHouseholdSummaries(): Promise<FamilyHouseholdSummary[]> {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return []
  }

  const familiesResult = await fetchFamilyListSummaries(supabase, organizationId)
  if (familiesResult.ok) {
    return familiesResult.families.map((family) => ({
      id: family.id,
      primaryPersonId: null,
      primaryContactId: family.primaryContactId,
      primaryName: family.primaryName || family.name.replace(/ Family$/, ""),
      primaryEmail: family.primaryEmail,
      memberCount: family.memberCount,
      lifetimeTotal: family.lifetimeTotal,
      giftCount: family.giftCount,
      lastGiftDate: family.lastGiftDate,
      relationshipTypes: [],
    }))
  }

  const { data: relationships, error } = await supabase
    .from("person_relationships")
    .select(
      `
      id,
      person_id,
      related_person_id,
      relationship_type,
      people:person_id (
        id,
        first_name,
        last_name
      )
    `
    )
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to load family households")
  }

  const grouped = new Map<
    string,
    {
      primaryPersonId: string
      primaryName: string
      memberCount: number
      relationshipTypes: Set<string>
    }
  >()

  for (const row of relationships || []) {
    const person = row.people as
      | { id: string; first_name: string | null; last_name: string | null }
      | { id: string; first_name: string | null; last_name: string | null }[]
      | null

    const personRecord = Array.isArray(person) ? person[0] : person
    if (!personRecord) continue

    const primaryPersonId = row.person_id as string
    const existing = grouped.get(primaryPersonId)

    if (existing) {
      existing.memberCount += 1
      existing.relationshipTypes.add(String(row.relationship_type || "related"))
      continue
    }

    grouped.set(primaryPersonId, {
      primaryPersonId,
      primaryName:
        [personRecord.first_name, personRecord.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || "Unnamed",
      memberCount: 1,
      relationshipTypes: new Set([String(row.relationship_type || "related")]),
    })
  }

  const personIds = Array.from(grouped.keys())

  if (personIds.length === 0) {
    return []
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, person_id, email")
    .eq("organization_id", organizationId)
    .in("person_id", personIds)

  const contactByPersonId = new Map(
    (contacts || []).map((contact) => [contact.person_id as string, contact])
  )

  return Array.from(grouped.entries())
    .map(([primaryPersonId, household]) => {
      const contact = contactByPersonId.get(primaryPersonId)
      return {
        id: primaryPersonId,
        primaryPersonId,
        primaryContactId: (contact?.id as string | null) ?? null,
        primaryName: household.primaryName,
        primaryEmail: (contact?.email as string | null) ?? null,
        memberCount: household.memberCount,
        lifetimeTotal: 0,
        giftCount: 0,
        lastGiftDate: null,
        relationshipTypes: Array.from(household.relationshipTypes),
      }
    })
    .sort((left, right) => left.primaryName.localeCompare(right.primaryName))
}
