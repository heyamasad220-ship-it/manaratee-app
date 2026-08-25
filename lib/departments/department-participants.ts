"use server"

import { DEPARTMENT_WORKSPACE_PROGRAM_STATUSES } from "@/lib/departments/department-active-programs"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { YEAR_SEASON_LABEL } from "@/lib/programs/program-display-labels"
import { contactLabel, loadContactsByIds } from "@/lib/programs/registration-display-helpers"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_ENROLLMENT_STATUSES = [
  "pending_payment",
  "pending",
  "enrolled",
  "active",
  "completed",
  "waitlisted",
] as const

export type DepartmentParticipantRow = {
  enrollmentId: string
  studentName: string
  /** Participant contact when present; minors typically have none / no profile page. */
  studentContactId: string | null
  parentName: string | null
  parentEmail: string | null
  parentPhone: string | null
  /** Registrant / guardian contact — profile link for youth enrollments. */
  parentContactId: string | null
  teacherName: string | null
  courseName: string
  yearSeasonName: string
  programId: string
  offeringId: string | null
  status: string | null
  paymentStatus: string | null
  paymentRequired: boolean | null
  amountPaid: number
  totalAmount: number
  registeredAt: string | null
}

export type DepartmentParticipantYearOption = {
  id: string
  name: string
  status: string
}

export type DepartmentParticipantCourseOption = {
  id: string
  name: string
  programId: string
}

export type DepartmentParticipantsBundle = {
  participants: DepartmentParticipantRow[]
  years: DepartmentParticipantYearOption[]
  courses: DepartmentParticipantCourseOption[]
}

export type DepartmentParticipantsFilters = {
  programId?: string | null
  offeringId?: string | null
  includeInactive?: boolean
}

export async function fetchDepartmentParticipants(
  departmentId: string,
  filters: DepartmentParticipantsFilters = {}
): Promise<DepartmentParticipantsBundle> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { participants: [], years: [], courses: [] }
  }

  const supabase = await createClient()

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("id, name, status")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .in("status", [...DEPARTMENT_WORKSPACE_PROGRAM_STATUSES])
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })

  if (programsError) {
    throw new Error(programsError.message || "Could not load department programs.")
  }

  const years: DepartmentParticipantYearOption[] = (programs || []).map((row) => ({
    id: row.id as string,
    name: (row.name as string) || YEAR_SEASON_LABEL,
    status: (row.status as string) || "active",
  }))
  const programIds = years.map((row) => row.id)
  const programNameById = new Map(years.map((row) => [row.id, row.name]))

  if (programIds.length === 0) {
    return { participants: [], years: [], courses: [] }
  }

  const scopedProgramIds =
    filters.programId && programIds.includes(filters.programId)
      ? [filters.programId]
      : programIds

  const { data: offeringRows } = await supabase
    .from("program_offerings")
    .select("id, name, program_id, status")
    .eq("organization_id", organizationId)
    .in("program_id", scopedProgramIds)
    .order("name", { ascending: true })

  const courses: DepartmentParticipantCourseOption[] = (offeringRows || [])
    .filter((row) => (row.status as string) !== "archived")
    .map((row) => ({
      id: row.id as string,
      name: (row.name as string) || "Course",
      programId: row.program_id as string,
    }))

  let enrollmentsQuery = supabase
    .from("program_enrollments")
    .select(
      `
      id,
      program_id,
      offering_id,
      child_name,
      participant_contact_id,
      registrant_contact_id,
      parent_name,
      parent_email,
      parent_phone,
      status,
      payment_status,
      payment_required,
      amount_paid,
      total_amount,
      enrollment_date,
      created_at,
      offering:offering_id (
        id,
        name
      )
    `
    )
    .eq("organization_id", organizationId)
    .in("program_id", scopedProgramIds)
    .order("created_at", { ascending: false })

  if (filters.offeringId) {
    enrollmentsQuery = enrollmentsQuery.eq("offering_id", filters.offeringId)
  }

  if (!filters.includeInactive) {
    enrollmentsQuery = enrollmentsQuery.in("status", [...DEFAULT_ENROLLMENT_STATUSES])
  }

  const { data: enrollmentRows, error: enrollmentsError } = await enrollmentsQuery

  if (enrollmentsError) {
    throw new Error(enrollmentsError.message || "Could not load participants.")
  }

  const enrollments = enrollmentRows || []
  if (enrollments.length === 0) {
    return { participants: [], years, courses }
  }

  const offeringIds = [
    ...new Set(
      enrollments
        .map((row) => row.offering_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const teacherByOfferingId = new Map<string, string>()

  if (offeringIds.length > 0) {
    const { data: assignments } = await supabase
      .from("program_staff_assignments")
      .select(
        `
        offering_id,
        assignment_role,
        is_active,
        contact:contact_id ( full_name )
      `
      )
      .eq("organization_id", organizationId)
      .in("offering_id", offeringIds)
      .eq("is_active", true)
      .order("created_at", { ascending: true })

    for (const row of assignments || []) {
      const offeringId = row.offering_id as string
      if (teacherByOfferingId.has(offeringId)) continue
      const role = (row.assignment_role as string) || ""
      if (role && role !== "primary_instructor" && role !== "instructor") continue
      const contact = row.contact as { full_name?: string | null } | null
      const name = contact?.full_name?.trim()
      if (name) teacherByOfferingId.set(offeringId, name)
    }

    for (const row of assignments || []) {
      const offeringId = row.offering_id as string
      if (teacherByOfferingId.has(offeringId)) continue
      const contact = row.contact as { full_name?: string | null } | null
      const name = contact?.full_name?.trim()
      if (name) teacherByOfferingId.set(offeringId, name)
    }
  }

  const contactsById = await loadContactsByIds(
    organizationId,
    enrollments.flatMap((row) =>
      [
        row.participant_contact_id as string | null,
        row.registrant_contact_id as string | null,
      ].filter((id): id is string => Boolean(id))
    )
  )

  const participants: DepartmentParticipantRow[] = enrollments.map((row) => {
    const offering = row.offering as unknown as {
      id: string
      name: string | null
    } | null
    const programId = row.program_id as string
    const offeringId = (row.offering_id as string | null) ?? null
    const parentContactId =
      (row.registrant_contact_id as string | null) ?? null
    const parentContact = parentContactId
      ? contactsById.get(parentContactId)
      : undefined

    return {
      enrollmentId: row.id as string,
      studentName: contactLabel(
        row.participant_contact_id
          ? contactsById.get(row.participant_contact_id as string)
          : undefined,
        row.child_name as string
      ),
      studentContactId: (row.participant_contact_id as string | null) ?? null,
      parentName:
        parentContact?.full_name?.trim() ||
        (row.parent_name as string | null) ||
        null,
      parentEmail:
        parentContact?.email?.trim() ||
        (row.parent_email as string | null) ||
        null,
      parentPhone:
        parentContact?.phone?.trim() ||
        (row.parent_phone as string | null) ||
        null,
      parentContactId,
      teacherName: offeringId ? teacherByOfferingId.get(offeringId) || null : null,
      courseName: offering?.name?.trim() || programNameById.get(programId) || "Course",
      yearSeasonName: programNameById.get(programId) || YEAR_SEASON_LABEL,
      programId,
      offeringId,
      status: (row.status as string | null) ?? null,
      paymentStatus: (row.payment_status as string | null) ?? null,
      paymentRequired: (row.payment_required as boolean | null) ?? null,
      amountPaid: Number(row.amount_paid || 0),
      totalAmount: Number(row.total_amount || 0),
      registeredAt:
        (row.enrollment_date as string | null) ||
        (row.created_at as string | null) ||
        null,
    }
  })

  participants.sort((a, b) => a.studentName.localeCompare(b.studentName))
  return { participants, years, courses }
}

export async function fetchDepartmentParticipantsAction(
  departmentId: string,
  filters: DepartmentParticipantsFilters = {}
) {
  try {
    const bundle = await fetchDepartmentParticipants(departmentId, filters)
    return { success: true as const, ...bundle }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load participants.",
    }
  }
}
