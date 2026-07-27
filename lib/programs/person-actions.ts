"use server"

/**
 * Participant identity helpers.
 *
 * Youth / minors use people under the parent Contact (QIL Contact + Participant
 * model). Do not create CRM contacts for minors.
 */

import { verifyContactInOrganization } from "@/lib/programs/registration-contact-resolver"

/**
 * Resolve an existing participant contact for enrollment when one already exists.
 * Never creates a contact.
 */
export async function resolveExistingParticipantContactId(input: {
  organizationId: string
  participantContactId: string
}): Promise<string | null> {
  const contact = await verifyContactInOrganization(
    input.organizationId,
    input.participantContactId
  )

  return contact?.id ?? null
}
