"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import { ensureParticipantContactForPerson } from "@/lib/programs/person-actions"

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
 * After enrollment creation, backfill participant_contact_id when missing and sync affiliations.
 * Sync failures are logged and never fail the enrollment write.
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

  let participantContactId = enrollment.participant_contact_id as string | null

  if (!participantContactId && enrollment.child_person_id) {
    try {
      const { contactId } = await ensureParticipantContactForPerson({
        organizationId: input.organizationId,
        personId: enrollment.child_person_id as string,
      })
      participantContactId = contactId

      const { error: updateError } = await input.supabase
        .from("program_enrollments")
        .update({ participant_contact_id: contactId })
        .eq("organization_id", input.organizationId)
        .eq("id", input.enrollmentId)
        .is("participant_contact_id", null)

      if (updateError) {
        console.error(
          `[program-enrollment] participant_contact_id backfill failed (${input.context}, enrollment ${input.enrollmentId}): ${updateError.message}`
        )
      }
    } catch (backfillError) {
      const message =
        backfillError instanceof Error ? backfillError.message : String(backfillError)
      console.error(
        `[program-enrollment] ensure contact for enrollment failed (${input.context}, enrollment ${input.enrollmentId}): ${message}`
      )
      return
    }
  }

  await maybeSyncProgramParticipantAffiliation(
    input.supabase,
    input.organizationId,
    participantContactId,
    input.context
  )
}
