"use server"

import { redirect } from "next/navigation"

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

type ProgramSession = {
  id: string
  name: string
  price: number | null
}

type RegisterForProgramRpcResult = {
  ok: boolean
  mode?: string
  enrollment_id?: string
  waitlist_id?: string
}

function isEnrollmentOpen(open?: string | null, close?: string | null) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const openDate = open ? new Date(`${open}T00:00:00`) : null
  const closeDate = close ? new Date(`${close}T00:00:00`) : null

  if (openDate && today < openDate) return false
  if (closeDate && today > closeDate) return false

  return true
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
  const enrollmentOpen = isEnrollmentOpen(
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

  redirect(`${redirectBase}?error=save-failed`)
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
  const participantContactId = String(formData.get("participant_contact_id") || "").trim()

  const parentName = String(formData.get("parent_name") || "").trim()
  const parentEmail = String(formData.get("parent_email") || "").trim()
  const parentPhone = String(formData.get("parent_phone") || "").trim()
  const notes = String(formData.get("notes") || "").trim()

  const selectedSessionIds = formData
    .getAll("session_ids")
    .map((sessionId) => String(sessionId))
    .filter(Boolean)

  const beforeCare = formData.get("before_care") === "on"
  const afterCare = formData.get("after_care") === "on"
  const lunchOptionId =
    String(formData.get("lunch_option_id") || "").trim() || null

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

  if (!isAdultProgram && !participantContactId) {
    redirect(`${redirectBase}?error=missing-fields`)
  }

  if (
    !isAdultProgram &&
    participantContactId &&
    customerContact.person_id
  ) {
    const isFamilyParticipant = await verifyParticipantInRegistrantFamily({
      organizationId,
      registrantPersonId: customerContact.person_id,
      participantContactId,
    })

    if (!isFamilyParticipant) {
      redirect(`${redirectBase}?error=invalid-participant`)
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

  const enrollmentOpen = isEnrollmentOpen(
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

  let lunchType: string | null = null
  let lunchPrice = 0

  if (lunchOptionId) {
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

    lunchType = lunchOption.name
    lunchPrice = Number(lunchOption.price || 0)
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

  const selectedSessions: ProgramSession[] = []

  if (sessionIdsForAccess.length > 0) {
    const { data: sessions, error: sessionsError } = await supabase
      .from("program_sessions")
      .select("id, name, price")
      .eq("organization_id", organizationId)
      .eq("program_id", programId)
      .in("id", sessionIdsForAccess)

    if (sessionsError) {
      redirect(`${redirectBase}?error=invalid-session`)
    }

    selectedSessions.push(...((sessions || []) as ProgramSession[]))

    if (registrationOption.option_type !== "full_program") {
      if (selectedSessions.length !== sessionIdsForAccess.length) {
        redirect(`${redirectBase}?error=invalid-session`)
      }
    }
  }

  const pricedSessionIds =
    registrationOption.option_type === "full_program" ? [] : sessionIdsForAccess

  const pricedSessions = selectedSessions.filter((session) =>
    pricedSessionIds.includes(session.id)
  )

  const sessionTotal = pricedSessions.reduce((total, session) => {
    return total + Number(session.price || 0)
  }, 0)

  const totalAmount = sessionTotal + lunchPrice
  const rpcMode = currentMode === "waitlist" || mode === "waitlist" ? "waitlist" : "enroll"

  const { data: rpcData, error: rpcError } = await supabase.rpc("register_for_program", {
    p_organization_id: organizationId,
    p_program_id: programId,
    p_registration_option_id: registrationOptionId,
    p_participant_contact_id: isAdultProgram ? null : participantContactId,
    p_session_ids: sessionIdsForAccess,
    p_mode: rpcMode,
    p_parent_name: parentName || customerContact.full_name,
    p_parent_email: parentEmail || customerContact.email,
    p_parent_phone: parentPhone || customerContact.phone,
    p_notes: notes || null,
    p_before_care: beforeCare,
    p_after_care: afterCare,
    p_lunch_type: lunchType,
    p_total_amount: totalAmount,
    p_session_name: pricedSessions.length === 1 ? pricedSessions[0].name : null,
  })

  if (rpcError) {
    console.error("registerForProgram RPC failed:", rpcError)
    mapRegisterForProgramError(rpcError.message, redirectBase, programId)
  }

  const result = rpcData as RegisterForProgramRpcResult | null

  if (!result?.ok) {
    redirect(`${redirectBase}?error=save-failed`)
  }

  if (result.mode === "waitlist") {
    redirect(`/customer/programs/${programId}?registration=waitlist-success`)
  }

  redirect(`/customer/programs/${programId}?registration=success`)
}
