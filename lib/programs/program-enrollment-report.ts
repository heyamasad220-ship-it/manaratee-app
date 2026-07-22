"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  contactLabel,
  loadContactsByIds,
} from "@/lib/programs/registration-display-helpers"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_STATUSES = [
  "pending_payment",
  "pending",
  "enrolled",
  "active",
  "completed",
  "waitlisted",
] as const

export type ProgramEnrollmentReportRow = {
  enrollmentId: string
  studentName: string
  studentContactId: string | null
  parentName: string | null
  parentEmail: string | null
  parentPhone: string | null
  offeringId: string | null
  offeringName: string
  teacherName: string | null
  status: string | null
  enrolledAt: string | null
}

export type ProgramEnrollmentReportFilters = {
  offeringId?: string | null
  /** When true, include cancelled/withdrawn/etc. */
  includeInactive?: boolean
}

/** F6: Enrollments across all offerings for one program. */
export async function getProgramEnrollmentReport(
  programId: string,
  filters: ProgramEnrollmentReportFilters = {}
): Promise<ProgramEnrollmentReportRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()

  let query = supabase
    .from("program_enrollments")
    .select(
      `
      id,
      offering_id,
      child_name,
      participant_contact_id,
      parent_name,
      parent_email,
      parent_phone,
      status,
      enrollment_date,
      created_at,
      offering:offering_id (
        id,
        name
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .order("created_at", { ascending: false })

  if (filters.offeringId) {
    query = query.eq("offering_id", filters.offeringId)
  }

  if (!filters.includeInactive) {
    query = query.in("status", [...DEFAULT_STATUSES])
  }

  const { data: enrollmentRows, error } = await query

  if (error) {
    console.error("getProgramEnrollmentReport:", error.message)
    throw new Error(error.message || "Failed to load enrollments")
  }

  const enrollments = enrollmentRows || []
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
      if (role && role !== "primary_instructor" && role !== "instructor") {
        continue
      }
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

  return enrollments.map((row) => {
    const offering = row.offering as { id: string; name: string | null } | null
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
      parentName: (row.parent_name as string | null) ?? null,
      parentEmail: (row.parent_email as string | null) ?? null,
      parentPhone: (row.parent_phone as string | null) ?? null,
      offeringId,
      offeringName: offering?.name?.trim() || "Offering",
      teacherName: offeringId
        ? teacherByOfferingId.get(offeringId) || null
        : null,
      status: (row.status as string | null) ?? null,
      enrolledAt:
        (row.enrollment_date as string | null) ||
        (row.created_at as string | null) ||
        null,
    }
  })
}

export async function fetchProgramEnrollmentReportAction(
  programId: string,
  filters: ProgramEnrollmentReportFilters = {}
): Promise<
  | { success: true; rows: ProgramEnrollmentReportRow[] }
  | { success: false; error: string }
> {
  try {
    const rows = await getProgramEnrollmentReport(programId, filters)
    return { success: true, rows }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to load enrollments.",
    }
  }
}
