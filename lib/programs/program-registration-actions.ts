"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  getRegistrationOptionById,
  isRegistrationOptionAvailable,
} from "@/lib/programs/program-registration-option-queries"
import type {
  ParticipantType,
  ProgramRegistrationOptionType,
  RegistrantType,
} from "@/lib/programs/program-registration-option-types"
import {
  createSessionAccessRows,
  getActiveSessionIdsForOffering,
} from "@/lib/programs/program-registration-session-access"
import { getDefaultOfferingForProgramByOrg } from "@/lib/programs/program-offering-queries"
import {
  lookupContactByPersonId,
  verifyContactInOrganization,
} from "@/lib/programs/registration-contact-resolver"

type ProgramSession = {
  id: string
  name: string
  price: number | null
}

function calculateAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return null

  const today = new Date()
  const birthDate = new Date(`${dateOfBirth}T00:00:00`)

  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }

  return age
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

function resolveParticipantType(
  programType: string,
  isAdultSelf: boolean
): ParticipantType {
  if (isAdultSelf) return "adult"
  if (programType === "family") return "family"
  return "youth"
}

function resolveRegistrantType(isAdultSelf: boolean): RegistrantType {
  return isAdultSelf ? "adult_self" : "guardian"
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

export async function registerForProgram(formData: FormData) {
  const supabase = await createClient()

  const programId = String(formData.get("program_id") || "")
  const organizationId = String(formData.get("organization_id") || "")
  const departmentId = String(formData.get("department_id") || "") || null
  const offeringId = String(formData.get("offering_id") || "")
  const registrationOptionId = String(formData.get("registration_option_id") || "")
  const mode = String(formData.get("mode") || "")
  const programType = String(formData.get("program_type") || "youth")
  const isAdultSelf = formData.get("is_adult_self") === "true"

  const registrantContactId = String(formData.get("registrant_contact_id") || "").trim()
  const payerContactId =
    String(formData.get("payer_contact_id") || "").trim() || registrantContactId
  const participantContactId = String(formData.get("participant_contact_id") || "").trim()
  const childPersonId = String(formData.get("child_person_id") || "").trim()

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

  if (
    !programId ||
    !organizationId ||
    !offeringId ||
    !registrationOptionId ||
    !registrantContactId
  ) {
    redirect(`${redirectBase}?error=missing-fields`)
  }

  const registrationOption = await getRegistrationOptionById(
    registrationOptionId,
    organizationId
  )

  if (
    !registrationOption ||
    registrationOption.offering_id !== offeringId ||
    registrationOption.program_id !== programId ||
    !isRegistrationOptionAvailable(registrationOption)
  ) {
    redirect(`${redirectBase}?error=invalid-option`)
  }

  const registrantContact = await verifyContactInOrganization(
    organizationId,
    registrantContactId
  )

  if (!registrantContact) {
    redirect(`${redirectBase}?error=invalid-registrant`)
  }

  const payerContact = await verifyContactInOrganization(
    organizationId,
    payerContactId
  )

  if (!payerContact) {
    redirect(`${redirectBase}?error=invalid-payer`)
  }

  let resolvedParticipantContactId = participantContactId || null
  let childName = ""
  let childAge: number | null = null
  let resolvedChildPersonId: string | null = null

  if (isAdultSelf) {
    resolvedParticipantContactId = registrantContactId
    childName = registrantContact.full_name || parentName || "Participant"
    resolvedChildPersonId = registrantContact.person_id ?? null
  } else {
    if (!childPersonId && !participantContactId) {
      redirect(`${redirectBase}?error=missing-fields`)
    }

    if (participantContactId) {
      const participantContact = await verifyContactInOrganization(
        organizationId,
        participantContactId
      )

      if (!participantContact) {
        redirect(`${redirectBase}?error=invalid-participant`)
      }

      resolvedParticipantContactId = participantContact.id
      resolvedChildPersonId = participantContact.person_id ?? childPersonId ?? null
      childName = participantContact.full_name || parentName || "Participant"
    } else if (childPersonId) {
      const { data: childPerson, error: childError } = await supabase
        .from("people")
        .select("id, first_name, last_name, date_of_birth")
        .eq("id", childPersonId)
        .eq("organization_id", organizationId)
        .maybeSingle()

      if (childError || !childPerson) {
        redirect(`${redirectBase}?error=invalid-participant`)
      }

      childName = `${childPerson.first_name || ""} ${childPerson.last_name || ""}`.trim()
      childAge = calculateAge(childPerson.date_of_birth)
      resolvedChildPersonId = childPerson.id

      const contactLookup = await lookupContactByPersonId(
        organizationId,
        childPerson.id
      )

      if (!contactLookup.contactId) {
        console.warn("Registration blocked — missing participant contact", {
          organizationId,
          personId: childPerson.id,
        })
        redirect(`${redirectBase}?error=missing-participant-contact`)
      }

      resolvedParticipantContactId = contactLookup.contactId
    }
  }

  if (!childName) {
    redirect(`${redirectBase}?error=invalid-participant`)
  }

  const { data: program, error: programError } = await supabase
    .from("programs")
    .select(
      `
      id,
      organization_id,
      department_id,
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

  const offering = await getDefaultOfferingForProgramByOrg(programId, organizationId)

  if (!offering || offering.id !== offeringId) {
    redirect(`${redirectBase}?error=invalid-offering`)
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
      offeringId,
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
  const today = new Date().toISOString().slice(0, 10)
  const weeksLegacy =
    registrationOption.option_type === "full_program"
      ? sessionIdsForAccess
      : sessionIdsForAccess

  const participantType = resolveParticipantType(programType, isAdultSelf)
  const registrantType = resolveRegistrantType(isAdultSelf)

  if (currentMode === "waitlist" || mode === "waitlist") {
    const duplicatePersonId = resolvedChildPersonId

    if (duplicatePersonId) {
      const { data: existingWaitlistRegistration } = await supabase
        .from("program_waitlist")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("program_id", programId)
        .eq("child_person_id", duplicatePersonId)
        .maybeSingle()

      if (existingWaitlistRegistration) {
        redirect(`${redirectBase}?error=already-waitlisted`)
      }
    }

    const { count: waitlistCount } = await supabase
      .from("program_waitlist")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("program_id", programId)

    const nextPosition = (waitlistCount || 0) + 1

    const { error } = await supabase.from("program_waitlist").insert({
      organization_id: organizationId,
      program_id: programId,
      child_person_id: resolvedChildPersonId,
      child_name: childName,
      child_age: childAge,
      parent_name: parentName || registrantContact.full_name,
      parent_email: parentEmail || registrantContact.email,
      parent_phone: parentPhone || registrantContact.phone,
      preferred_weeks: weeksLegacy.length > 0 ? weeksLegacy : null,
      added_date: today,
      position: nextPosition,
      status: "waiting",
      priority: "normal",
      notes: notes || null,
    })

    if (error) {
      if (error.code === "23505") {
        redirect(`${redirectBase}?error=already-waitlisted`)
      }

      throw new Error(error.message)
    }

    await supabase
      .from("programs")
      .update({ waitlist: (program.waitlist || 0) + 1 })
      .eq("id", programId)
      .eq("organization_id", organizationId)

    redirect(`/customer/programs/${programId}?registration=waitlist-success`)
  }

  if (resolvedParticipantContactId) {
    const { data: existingByContact } = await supabase
      .from("program_enrollments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("program_id", programId)
      .eq("participant_contact_id", resolvedParticipantContactId)
      .maybeSingle()

    if (existingByContact) {
      redirect(`${redirectBase}?error=already-enrolled`)
    }
  }

  if (resolvedChildPersonId) {
    const { data: existingEnrollment } = await supabase
      .from("program_enrollments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("program_id", programId)
      .eq("child_person_id", resolvedChildPersonId)
      .maybeSingle()

    if (existingEnrollment) {
      redirect(`${redirectBase}?error=already-enrolled`)
    }
  }

  const { data: enrollmentRow, error } = await supabase
    .from("program_enrollments")
    .insert({
      organization_id: organizationId,
      program_id: programId,
      offering_id: offeringId,
      department_id: departmentId,
      registration_option_id: registrationOptionId,
      participant_contact_id: resolvedParticipantContactId,
      registrant_contact_id: registrantContactId,
      payer_contact_id: payerContactId,
      participant_type: participantType,
      registrant_type: registrantType,
      child_person_id: resolvedChildPersonId,
      child_name: childName,
      child_age: childAge,
      parent_name: parentName || registrantContact.full_name,
      parent_email: parentEmail || registrantContact.email,
      parent_phone: parentPhone || registrantContact.phone,
      session_name:
        pricedSessions.length === 1 ? pricedSessions[0].name : null,
      weeks: weeksLegacy.length > 0 ? weeksLegacy : null,
      enrollment_date: today,
      status: "pending",
      payment_status: "pending",
      amount_paid: 0,
      total_amount: totalAmount,
      before_care: beforeCare,
      after_care: afterCare,
      lunch_type: lunchType,
      notes: notes || null,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      redirect(`${redirectBase}?error=already-enrolled`)
    }

    console.error("registerForProgram insert failed:", error)
    redirect(`${redirectBase}?error=save-failed`)
  }

  if (sessionIdsForAccess.length > 0) {
    await createSessionAccessRows({
      organizationId,
      enrollmentId: enrollmentRow.id,
      sessionIds: sessionIdsForAccess,
    })
  }

  await supabase
    .from("programs")
    .update({ enrolled: (program.enrolled || 0) + 1 })
    .eq("id", programId)
    .eq("organization_id", organizationId)

  redirect(`/customer/programs/${programId}?registration=success`)
}
