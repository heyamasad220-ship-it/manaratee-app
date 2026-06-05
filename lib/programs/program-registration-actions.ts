"use server"

import { redirect } from "next/navigation"

import { readParticipantSelections } from "@/lib/programs/registration-form-parsing"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { createClient } from "@/lib/supabase/server"
import { getDefaultOfferingForProgramByOrg } from "@/lib/programs/program-offering-queries"
import {
  getRegistrationOptionById,
  isRegistrationOptionAvailable,
} from "@/lib/programs/program-registration-option-queries"
import type { ProgramRegistrationOptionType } from "@/lib/programs/program-registration-option-types"
import { getActiveSessionIdsForOffering } from "@/lib/programs/program-registration-session-access"
import {
  getCustomerContactForUser,
  verifyParticipantInRegistrantFamily,
} from "@/lib/programs/registration-contact-resolver"
import {
  isEnrollmentWindowOpen,
  isProgramPublishedForRegistration,
} from "@/lib/programs/program-enrollment-availability"

type RegisterForProgramRpcResult = {
  ok: boolean
  mode?: string
  enrollment_id?: string
  waitlist_id?: string
  charge_id?: string
  status?: string
  payment_required?: boolean
  due_today?: number
  total_amount?: number
}

function isFull(program: { capacity: number; enrolled: number }) {
  return program.capacity > 0 && program.enrolled >= program.capacity
}

function getRegistrationMode(program: {
  capacity: number
  enrolled: number
  waitlist: number
  enrollment_open_date: string | null
  enrollment_close_date: string | null
}) {
  const enrollmentOpen = isEnrollmentWindowOpen(
    program.enrollment_open_date,
    program.enrollment_close_date
  )

  if (!enrollmentOpen) return "closed"
  if (isFull(program)) return program.waitlist > 0 ? "waitlist" : "full"
  return "enroll"
}

function validateSessionsForOption(
  optionType: ProgramRegistrationOptionType,
  sessionIds: string[]
) {
  if (optionType === "full_program") {
    return sessionIds
  }

  if (optionType === "selected_sessions") {
    if (sessionIds.length === 0) {
      throw new Error("Select at least one session.")
    }
    return sessionIds
  }

  if (optionType === "single_session" || optionType === "drop_in") {
    if (sessionIds.length !== 1) {
      throw new Error("Select exactly one session.")
    }
    return sessionIds
  }

  return sessionIds
}

async function resolveSessionIdsForRegistration(input: {
  organizationId: string
  programId: string
  offeringId: string
  optionType: ProgramRegistrationOptionType
  selectedSessionIds: string[]
}) {
  if (input.optionType === "full_program") {
    return getActiveSessionIdsForOffering(
      input.offeringId,
      input.organizationId,
      input.programId
    )
  }

  return validateSessionsForOption(input.optionType, input.selectedSessionIds)
}

function mapRegisterForProgramError(
  message: string | undefined,
  redirectBase: string,
  programId: string
): never {
  const normalized = message || ""

  if (normalized.includes("register_for_program:unauthorized")) {
    redirect(`${redirectBase}?error=unauthorized`)
  }

  if (normalized.includes("register_for_program:invalid-participant")) {
    redirect(`${redirectBase}?error=invalid-participant`)
  }

  if (normalized.includes("register_for_program:missing-participant-contact")) {
    redirect(`${redirectBase}?error=missing-participant-contact`)
  }

  if (normalized.includes("register_for_program:capacity-full")) {
    redirect(`${redirectBase}?error=capacity-full`)
  }

  if (normalized.includes("register_for_program:already-enrolled")) {
    redirect(`${redirectBase}?error=already-enrolled`)
  }

  if (normalized.includes("register_for_program:already-waitlisted")) {
    redirect(`${redirectBase}?error=already-waitlisted`)
  }

  if (
    normalized.includes("register_for_program:enrollment-closed") ||
    normalized.includes("register_for_program:invalid-program")
  ) {
    redirect(`/customer/programs/${programId}?registration=unavailable`)
  }

  if (
    normalized.includes("register_for_program:invalid-option") ||
    normalized.includes("register_for_program:invalid-offering")
  ) {
    redirect(`${redirectBase}?error=invalid-option`)
  }

  if (normalized.includes("register_for_program:invalid-session")) {
    redirect(`${redirectBase}?error=invalid-session`)
  }

  if (normalized.includes("quote:no-fee-plan")) {
    redirect(`${redirectBase}?error=no-fee-plan`)
  }

  if (normalized.includes("quote:invalid-fee-plan")) {
    redirect(`${redirectBase}?error=invalid-fee-plan`)
  }

  if (normalized.includes("quote:invalid-lunch")) {
    redirect(`${redirectBase}?error=invalid-lunch`)
  }

  if (
    normalized.includes("quote:invalid-session") ||
    normalized.includes("quote:invalid-option") ||
    normalized.includes("quote:invalid-offering")
  ) {
    redirect(`${redirectBase}?error=invalid-session`)
  }

  if (
    normalized.includes("quote:pricing-error") ||
    normalized.includes("quote:failed")
  ) {
    redirect(`${redirectBase}?error=pricing-error`)
  }

  redirect(`${redirectBase}?error=save-failed`)
}

import type { ParticipantRegistrationSelection } from "@/lib/programs/registration-form-parsing"

async function resolveLunchType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  lunchOptionId: string | null,
  redirectBase: string
) {
  if (!lunchOptionId) {
    return { lunchType: null as string | null, lunchOptionId: null as string | null }
  }

  const { data: lunchOption, error: lunchError } = await supabase
    .from("program_lunch_options")
    .select("id, name, price")
    .eq("id", lunchOptionId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle()

  if (lunchError || !lunchOption) {
    redirect(`${redirectBase}?error=invalid-lunch`)
  }

  return {
    lunchType: lunchOption.name as string,
    lunchOptionId,
  }
}

async function registerSingleParticipant(input: {
  supabase: Awaited<ReturnType<typeof createClient>>
  organizationId: string
  programId: string
  registrationOptionId: string
  participant: ParticipantRegistrationSelection
  sessionIdsForAccess: string[]
  rpcMode: string
  isAdultProgram: boolean
  customerContact: {
    full_name: string | null
    email: string | null
    phone: string | null
  }
  notes: string | null
  pricedSessions: Array<{ id: string; name: string }>
  redirectBase: string
}) {
  const lunch = await resolveLunchType(
    input.supabase,
    input.organizationId,
    input.participant.lunchOptionId,
    input.redirectBase
  )

  const { data: rpcData, error: rpcError } = await input.supabase.rpc(
    "register_for_program",
    {
      p_organization_id: input.organizationId,
      p_program_id: input.programId,
      p_registration_option_id: input.registrationOptionId,
      p_participant_contact_id: input.isAdultProgram
        ? null
        : input.participant.participantContactId,
      p_session_ids: input.sessionIdsForAccess,
      p_mode: input.rpcMode,
      p_parent_name: input.customerContact.full_name,
      p_parent_email: input.customerContact.email,
      p_parent_phone: input.customerContact.phone,
      p_notes: input.notes,
      p_before_care: input.participant.beforeCare,
      p_after_care: input.participant.afterCare,
      p_lunch_type: lunch.lunchType,
      p_lunch_option_id: lunch.lunchOptionId,
      p_total_amount: 0,
      p_session_name:
        input.pricedSessions.length === 1
          ? (input.pricedSessions[0]?.name ?? null)
          : null,
    }
  )

  if (rpcError) {
    console.error("registerForProgram RPC failed:", rpcError)
    if (rpcError.message?.includes("quote:invalid-fee-plan")) {
      console.warn("[program-fee-plans] Registration blocked by invalid fee_plan_id", {
        programId: input.programId,
        registrationOptionId: input.registrationOptionId,
        participantContactId: input.participant.participantContactId,
      })
    }
    mapRegisterForProgramError(
      rpcError.message,
      input.redirectBase,
      input.programId
    )
  }

  const result = rpcData as RegisterForProgramRpcResult | null

  if (!result?.ok) {
    redirect(`${input.redirectBase}?error=save-failed`)
  }

  return result
}

export async function registerForProgram(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/login")
  }

  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization?.organization_id) {
    redirect("/customer/programs?error=unauthorized")
  }

  const organizationId = activeOrganization.organization_id

  const programId = String(formData.get("program_id") || "")
  const registrationOptionId = String(formData.get("registration_option_id") || "")
  const mode = String(formData.get("mode") || "")
  const participants = readParticipantSelections(formData)
  const notes = String(formData.get("notes") || "").trim()

  const selectedSessionIds = formData
    .getAll("session_ids")
    .map((sessionId) => String(sessionId))
    .filter(Boolean)

  const redirectBase = `/customer/programs/${programId}/register`

  if (!programId || !registrationOptionId) {
    redirect(`${redirectBase}?error=missing-fields`)
  }

  const customerContact = await getCustomerContactForUser(organizationId, user.id)

  if (!customerContact) {
    redirect(`${redirectBase}?error=unauthorized`)
  }

  const { data: program, error: programError } = await supabase
    .from("programs")
    .select(
      `
      id,
      organization_id,
      department_id,
      program_type,
      capacity,
      enrolled,
      waitlist,
      status,
      enrollment_open_date,
      enrollment_close_date
    `
    )
    .eq("id", programId)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .maybeSingle()

  if (programError || !program) {
    redirect("/customer/programs")
  }

  const isAdultProgram = program.program_type === "adult"

  if (!isAdultProgram && participants.length === 0) {
    redirect(`${redirectBase}?error=missing-fields`)
  }

  if (!isAdultProgram && customerContact.person_id) {
    for (const participant of participants) {
      const isFamilyParticipant = await verifyParticipantInRegistrantFamily({
        organizationId,
        registrantPersonId: customerContact.person_id,
        participantContactId: participant.participantContactId,
      })

      if (!isFamilyParticipant) {
        redirect(`${redirectBase}?error=invalid-participant`)
      }
    }
  }

  const offering = await getDefaultOfferingForProgramByOrg(programId, organizationId)

  if (!offering) {
    redirect(`${redirectBase}?error=invalid-option`)
  }

  const registrationOption = await getRegistrationOptionById(
    registrationOptionId,
    organizationId
  )

  if (
    !registrationOption ||
    registrationOption.offering_id !== offering.id ||
    registrationOption.program_id !== programId ||
    !isRegistrationOptionAvailable(registrationOption)
  ) {
    redirect(`${redirectBase}?error=invalid-option`)
  }

  const enrollmentOpen =
    isProgramPublishedForRegistration(program.status) &&
    isEnrollmentWindowOpen(
      offering.enrollment_open_date ?? program.enrollment_open_date,
      offering.enrollment_close_date ?? program.enrollment_close_date
    )

  if (!enrollmentOpen) {
    redirect(`/customer/programs/${programId}?registration=unavailable`)
  }

  const currentMode = getRegistrationMode(program)

  if (currentMode === "closed" || currentMode === "full") {
    redirect(`/customer/programs/${programId}?registration=unavailable`)
  }

  let sessionIdsForAccess: string[] = []

  try {
    sessionIdsForAccess = await resolveSessionIdsForRegistration({
      organizationId,
      programId,
      offeringId: offering.id,
      optionType: registrationOption.option_type,
      selectedSessionIds,
    })
  } catch {
    redirect(`${redirectBase}?error=invalid-session`)
  }

  const pricedSessions =
    registrationOption.option_type !== "full_program" && sessionIdsForAccess.length > 0
      ? (
          await supabase
            .from("program_sessions")
            .select("id, name")
            .eq("organization_id", organizationId)
            .eq("program_id", programId)
            .in("id", sessionIdsForAccess)
        ).data || []
      : []

  const rpcMode = currentMode === "waitlist" || mode === "waitlist" ? "waitlist" : "enroll"

  const registrationTargets: ParticipantRegistrationSelection[] = isAdultProgram
    ? participants.length > 0
      ? participants
      : [
          {
            participantContactId: customerContact.id,
            lunchOptionId: null,
            beforeCare: false,
            afterCare: false,
          },
        ]
    : participants

  const results = []

  for (const participant of registrationTargets) {
    const result = await registerSingleParticipant({
      supabase,
      organizationId,
      programId,
      registrationOptionId,
      participant,
      sessionIdsForAccess,
      rpcMode,
      isAdultProgram,
      customerContact: {
        full_name: customerContact.full_name,
        email: customerContact.email,
        phone: customerContact.phone,
      },
      notes: notes || null,
      pricedSessions: pricedSessions as Array<{ id: string; name: string }>,
      redirectBase,
    })
    results.push(result)
  }

  if (results[0]?.mode === "waitlist") {
    redirect(
      `/customer/programs/${programId}?registration=waitlist-success&count=${results.length}`
    )
  }

  redirect(
    `/customer/programs/${programId}?registration=success&count=${results.length}`
  )
}
