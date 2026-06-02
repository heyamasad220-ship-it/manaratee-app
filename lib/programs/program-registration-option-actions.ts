"use server"

import { createClient } from "@/lib/supabase/server"
import type { ProgramRegistrationOptionType } from "@/lib/programs/program-registration-option-types"
import { REGISTRATION_OPTION_LABELS } from "@/lib/programs/program-registration-option-types"

type SyncRegistrationOptionsInput = {
  organizationId: string
  programId: string
  offeringId: string
  fullProgramEnabled: boolean
  sessionRegistrationEnabled: boolean
  singleSessionEnabled?: boolean
  dropInEnabled?: boolean
}

const OPTION_RANK: Record<ProgramRegistrationOptionType, number> = {
  full_program: 10,
  selected_sessions: 20,
  single_session: 30,
  drop_in: 40,
}

async function upsertOption(
  input: SyncRegistrationOptionsInput & {
    optionType: ProgramRegistrationOptionType
    enabled: boolean
  }
) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("program_registration_options")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("offering_id", input.offeringId)
    .eq("option_type", input.optionType)
    .maybeSingle()

  const payload = {
    organization_id: input.organizationId,
    program_id: input.programId,
    offering_id: input.offeringId,
    name: REGISTRATION_OPTION_LABELS[input.optionType],
    option_type: input.optionType,
    is_active: input.enabled,
    priority_rank: OPTION_RANK[input.optionType],
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("program_registration_options")
      .update(payload)
      .eq("organization_id", input.organizationId)
      .eq("id", existing.id)

    if (error) throw new Error(error.message)
    return
  }

  if (!input.enabled) {
    return
  }

  const { error } = await supabase.from("program_registration_options").insert(payload)

  if (error) throw new Error(error.message)
}

export async function syncRegistrationOptionsFromProgramFlags(
  input: SyncRegistrationOptionsInput
) {
  await upsertOption({
    ...input,
    optionType: "full_program",
    enabled: input.fullProgramEnabled,
  })

  await upsertOption({
    ...input,
    optionType: "selected_sessions",
    enabled: input.sessionRegistrationEnabled,
  })

  await upsertOption({
    ...input,
    optionType: "single_session",
    enabled: input.singleSessionEnabled ?? false,
  })

  await upsertOption({
    ...input,
    optionType: "drop_in",
    enabled: input.dropInEnabled ?? false,
  })
}

export async function updateRegistrationOptionActive(input: {
  organizationId: string
  optionId: string
  isActive: boolean
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("program_registration_options")
    .update({
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.optionId)

  if (error) {
    throw new Error(error.message)
  }
}
