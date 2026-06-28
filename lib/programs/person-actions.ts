"use server"

import { redirect } from "next/navigation"

import { ensureContactForPerson } from "@/lib/contacts/contact-actions"
import { verifyContactInOrganization } from "@/lib/programs/registration-contact-resolver"

/**
 * Resolve or create a CRM contact for a program participant person record.
 * Does not assign roles — customer is derived via syncContactAffiliations.
 */
export async function ensureParticipantContactForPerson(input: {
  organizationId: string
  personId: string
}) {
  return ensureContactForPerson({
    organizationId: input.organizationId,
    personId: input.personId,
  })
}

/**
 * Ensure the participant contact id used for enrollment is canonical for the linked person.
 */
export async function resolveParticipantContactIdForRegistration(input: {
  organizationId: string
  participantContactId: string
  redirectBase: string
}): Promise<string> {
  const contact = await verifyContactInOrganization(
    input.organizationId,
    input.participantContactId
  )

  if (!contact) {
    redirect(`${input.redirectBase}?error=invalid-participant`)
  }

  if (contact.person_id) {
    try {
      const { contactId } = await ensureParticipantContactForPerson({
        organizationId: input.organizationId,
        personId: contact.person_id,
      })
      return contactId
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        `[program-registration] ensure participant contact failed (person ${contact.person_id}): ${message}`
      )
      redirect(`${input.redirectBase}?error=missing-participant-contact`)
    }
  }

  return contact.id
}
