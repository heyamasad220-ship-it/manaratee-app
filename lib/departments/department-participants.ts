"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { contactLabel, loadContactsByIds } from "@/lib/programs/registration-display-helpers"
import { createClient } from "@/lib/supabase/server"

const ACTIVE_ENROLLMENT_STATUSES = [
  "pending_payment",
  "pending",
  "enrolled",
  "active",
  "completed",
] as const

export type DepartmentParticipantRow = {
  enrollmentId: string
  studentName: string
  studentContactId: string | null
  teacherName: string | null
  courseName: string
  programId: string
  offeringId: string | null
  status: string | null
  registeredAt: string | null
}

export async function fetchDepartmentParticipants(
  departmentId: string
): Promise<DepartmentParticipantRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .in("status", ["draft", "active", "paused"])

  if (programsError) {
    throw new Error(programsError.message || "Could not load department programs.")
  }

  const programIds = (programs || []).map((row) => row.id as string)
  const programNameById = new Map(
    (programs || []).map((row) => [row.id as string, (row.name as string) || "Program"])
  )

  let enrollmentsQuery = supabase
    .from("program_enrollments")
    .select(
      `
      id,
      program_id,
      offering_id,
      child_name,
      participant_contact_id,
      status,
      created_at,
      department_id,
      offering:offering_id (
        id,
        name
      )
    `
    )
    .eq("organization_id", organizationId)
    .in("status", [...ACTIVE_ENROLLMENT_STATUSES])
    .order("created_at", { ascending: false })

  if (programIds.length > 0) {
    enrollmentsQuery = enrollmentsQuery.or(
      `department_id.eq.${departmentId},program_id.in.(${programIds.join(",")})`
    )
  } else {
    enrollmentsQuery = enrollmentsQuery.eq("department_id", departmentId)
  }

  const { data: enrollmentRows, error: enrollmentsError } = await enrollmentsQuery

  if (enrollmentsError) {
    throw new Error(enrollmentsError.message || "Could not load participants.")
  }

  const enrollments = (enrollmentRows || []).filter((row) => {
    const enrollmentDept = row.department_id as string | null
    const programId = row.program_id as string
    return enrollmentDept === departmentId || programIds.includes(programId)
  })

  if (enrollments.length === 0) return []

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
    enrollments
      .map((row) => row.participant_contact_id as string | null)
      .filter((id): id is string => Boolean(id))
  )

  const rows: DepartmentParticipantRow[] = enrollments.map((row) => {
    const offering = row.offering as { id: string; name: string | null } | null
    const programId = row.program_id as string
    const offeringId = (row.offering_id as string | null) ?? null

    return {
      enrollmentId: row.id as string,
      studentName: contactLabel(
        row.participant_contact_id
          ? contactsById.get(row.participant_contact_id as string)
          : undefined,
        row.child_name as string
      ),
      studentContactId: (row.participant_contact_id as string | null) ?? null,
      teacherName: offeringId ? teacherByOfferingId.get(offeringId) || null : null,
      courseName: offering?.name?.trim() || programNameById.get(programId) || "Course",
      programId,
      offeringId,
      status: (row.status as string | null) ?? null,
      registeredAt: (row.created_at as string | null) ?? null,
    }
  })

  rows.sort((a, b) => a.studentName.localeCompare(b.studentName))
  return rows
}

export async function fetchDepartmentParticipantsAction(departmentId: string) {
  try {
    const participants = await fetchDepartmentParticipants(departmentId)
    return { success: true as const, participants }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load participants.",
    }
  }
}
