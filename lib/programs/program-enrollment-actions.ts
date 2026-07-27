"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"

export async function maybeSyncProgramParticipantAffiliation(
  supabase: SupabaseClient,
  organizationId: string,
  participantContactId: string | null,
  context: string
): Promise<void> {
  if (!participantContactId) {
    return
  }

  try {
    await syncContactAffiliations(participantContactId, organizationId, supabase)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `[program-enrollment] affiliation sync failed (${context}, contact ${participantContactId}): ${message}`
    )
  }
}

/**
 * After enrollment creation, sync Programs affiliation on contacts that already
 * exist. Do **not** create CRM contacts for child/person-only participants —
 * minors stay as people under the parent Contact (registrant).
 */
export async function syncAffiliationAfterEnrollmentCreation(input: {
  supabase: SupabaseClient
  organizationId: string
  enrollmentId: string
  context: string
}): Promise<void> {
  const { data: enrollment, error } = await input.supabase
    .from("program_enrollments")
    .select(
      "id, participant_contact_id, child_person_id, registrant_contact_id, payer_contact_id"
    )
    .eq("organization_id", input.organizationId)
    .eq("id", input.enrollmentId)
    .maybeSingle()

  if (error || !enrollment) {
    console.error(
      `[program-enrollment] affiliation sync skipped (${input.context}, enrollment ${input.enrollmentId}): ${error?.message || "enrollment not found"}`
    )
    return
  }

  const contactIds = [
    enrollment.registrant_contact_id as string | null,
    enrollment.payer_contact_id as string | null,
    // Only sync an existing participant contact — never create one for a child person.
    enrollment.participant_contact_id as string | null,
  ].filter((id): id is string => Boolean(id))

  const uniqueIds = [...new Set(contactIds)]

  for (const contactId of uniqueIds) {
    await maybeSyncProgramParticipantAffiliation(
      input.supabase,
      input.organizationId,
      contactId,
      input.context
    )
  }
}
