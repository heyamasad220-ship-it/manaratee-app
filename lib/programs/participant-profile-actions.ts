"use server"

import { revalidatePath } from "next/cache"

import {
  properCasePersonNameIfNeeded,
} from "@/lib/contacts/contact-constants"
import { normalizeDateOfBirth } from "@/lib/dates/date-input-utils"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  hasAnyPermission,
  PERMISSIONS,
} from "@/lib/permissions/permissions"
import { PARTICIPANT_PROFILE_BASE_PATH } from "@/lib/programs/participant-profile-path"
import { upsertParticipantDetailNotes } from "@/lib/programs/registration-report-helpers"
import { createClient } from "@/lib/supabase/server"

export type UpdateParticipantDetailsInput = {
  personId: string
  firstName: string
  lastName: string
  dateOfBirth?: string | null
  gender?: string | null
  grade?: string | null
  allergies?: string | null
  photoConsent?: string | null
  emergencyContact?: string | null
}

export async function syncEnrollmentNotesForPerson(input: {
  organizationId: string
  personId: string
  allergies: string | null
  photoConsent: string | null
  emergencyContact: string | null
}) {
  const supabase = await createClient()

  const { data: linkedContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("person_id", input.personId)
    .maybeSingle()

  const orFilter = linkedContact?.id
    ? `child_person_id.eq.${input.personId},participant_contact_id.eq.${linkedContact.id}`
    : `child_person_id.eq.${input.personId}`

  const { data: enrollments, error } = await supabase
    .from("program_enrollments")
    .select("id, notes")
    .eq("organization_id", input.organizationId)
    .or(orFilter)

  if (error) {
    throw new Error(error.message || "Could not load enrollments for note sync.")
  }

  for (const enrollment of enrollments || []) {
    const nextNotes = upsertParticipantDetailNotes(
      (enrollment.notes as string | null) || null,
      {
        allergies: input.allergies,
        photoConsent: input.photoConsent,
        emergencyContact: input.emergencyContact,
      }
    )
    if (nextNotes === ((enrollment.notes as string | null) || null)) continue

    const { error: updateError } = await supabase
      .from("program_enrollments")
      .update({ notes: nextNotes })
      .eq("organization_id", input.organizationId)
      .eq("id", enrollment.id as string)

    if (updateError) {
      throw new Error(updateError.message || "Could not sync enrollment notes.")
    }
  }
}

export async function updateParticipantDetailsAction(
  input: UpdateParticipantDetailsInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.PROGRAMS_MANAGE,
      PERMISSIONS.CONTACTS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to edit participants." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const personId = input.personId.trim()
    const firstName = properCasePersonNameIfNeeded(input.firstName)
    const lastName = properCasePersonNameIfNeeded(input.lastName)
    if (!personId) {
      return { success: false, error: "Participant is required." }
    }
    if (!firstName || !lastName) {
      return { success: false, error: "First and last name are required." }
    }

    const dateOfBirth = normalizeDateOfBirth(input.dateOfBirth, { required: false })
    const gender = input.gender?.trim() || null
    const grade = input.grade?.trim() || null
    const allergies = input.allergies?.trim() || null
    const photoConsent = input.photoConsent?.trim() || null
    const emergencyContact = input.emergencyContact?.trim() || null

    const supabase = await createClient()
    const { error: personError } = await supabase
      .from("people")
      .update({
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        gender,
        grade,
        allergies,
        emergency_contact: emergencyContact,
        photo_consent: photoConsent,
      })
      .eq("organization_id", organizationId)
      .eq("id", personId)

    if (personError) {
      return {
        success: false,
        error: personError.message || "Could not update participant.",
      }
    }

    await syncEnrollmentNotesForPerson({
      organizationId,
      personId,
      allergies,
      photoConsent,
      emergencyContact,
    })

    revalidatePath(`${PARTICIPANT_PROFILE_BASE_PATH}/${personId}`)
    revalidatePath("/programs/reports/enrollments")
    revalidatePath("/contacts")

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not update participant.",
    }
  }
}
