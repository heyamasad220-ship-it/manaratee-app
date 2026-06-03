"use server"

import { createClient } from "@/lib/supabase/server"
import type { QuoteAddons, ProgramRegistrationQuote } from "@/lib/programs/program-quote-types"

export async function quoteProgramRegistration(input: {
  organizationId: string
  programId: string
  offeringId: string
  registrationOptionId: string
  participantContactId?: string | null
  sessionIds: string[]
  addons?: QuoteAddons
}) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("quote_program_registration", {
    p_organization_id: input.organizationId,
    p_program_id: input.programId,
    p_offering_id: input.offeringId,
    p_registration_option_id: input.registrationOptionId,
    p_participant_contact_id: input.participantContactId ?? null,
    p_session_ids: input.sessionIds,
    p_addons: {
      before_care: input.addons?.before_care ?? false,
      after_care: input.addons?.after_care ?? false,
      lunch_option_id: input.addons?.lunch_option_id ?? null,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as ProgramRegistrationQuote
}
