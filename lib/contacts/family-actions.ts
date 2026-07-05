"use server"

import {
  fetchFamilyGivingRollup,
  fetchFamilyListSummaries,
  familiesMigrationMessage,
  isMissingFamiliesTable,
} from "@/lib/contacts/family-giving-data"
import type { FamilyGivingRollup, FamilyListSummary } from "@/lib/contacts/family-types"

import { requireContactsViewAccess } from "@/lib/contacts/group-member-access"

export async function fetchFamilyListSummariesAction(): Promise<
  | { success: true; families: FamilyListSummary[] }
  | { success: false; error: string }
> {
  const access = await requireContactsViewAccess()
  if (!access.ok) return { success: false, error: access.error }

  const result = await fetchFamilyListSummaries(access.supabase, access.organizationId)
  if (!result.ok) return { success: false, error: result.error }

  return { success: true, families: result.families }
}

export async function fetchFamilyGivingRollupAction(familyId: string): Promise<
  | { success: true; rollup: FamilyGivingRollup }
  | { success: false; error: string }
> {
  const access = await requireContactsViewAccess()
  if (!access.ok) return { success: false, error: access.error }

  const result = await fetchFamilyGivingRollup(
    access.supabase,
    access.organizationId,
    familyId
  )

  if (!result.ok) return { success: false, error: result.error }

  return { success: true, rollup: result.rollup }
}

export { familiesMigrationMessage, isMissingFamiliesTable }
