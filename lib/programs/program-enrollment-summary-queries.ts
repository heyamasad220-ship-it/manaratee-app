"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  buildEnrollmentByOffering,
  buildEnrollmentSummaryTotals,
  buildRegistrationTrends,
  type EnrollmentByOfferingRow,
  type EnrollmentSummaryTotals,
  type EnrollmentTrendRow,
} from "@/lib/programs/program-enrollment-summary"
import { createClient } from "@/lib/supabase/server"

export type ProgramEnrollmentSummary = {
  totals: EnrollmentSummaryTotals
  byOffering: EnrollmentByOfferingRow[]
  hasCapacity: boolean
  trends: EnrollmentTrendRow[]
}

const EMPTY_SUMMARY: ProgramEnrollmentSummary = {
  totals: {
    enrolled: 0,
    waitlisted: 0,
    cancelled: 0,
    pending: 0,
    offerings: 0,
    availableSeats: null,
  },
  byOffering: [],
  hasCapacity: false,
  trends: [],
}

export async function getProgramEnrollmentSummary(
  programId: string
): Promise<ProgramEnrollmentSummary> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return EMPTY_SUMMARY

  const supabase = await createClient()

  const [
    { data: offerings, error: offeringsError },
    { data: enrollments, error: enrollmentsError },
  ] = await Promise.all([
    supabase
      .from("program_offerings")
      .select("id, name, capacity, capacity_mode")
      .eq("organization_id", organizationId)
      .eq("program_id", programId)
      .neq("status", "archived")
      .order("name", { ascending: true }),
    supabase
      .from("program_enrollments")
      .select("offering_id, status, enrollment_date, created_at")
      .eq("organization_id", organizationId)
      .eq("program_id", programId),
  ])

  if (offeringsError) {
    throw new Error(offeringsError.message || "Could not load offerings.")
  }
  if (enrollmentsError) {
    throw new Error(enrollmentsError.message || "Could not load enrollments.")
  }

  const offeringRows = offerings || []
  const offeringIds = offeringRows.map((row) => row.id as string)
  const teacherByOfferingId = new Map<string, string>()

  if (offeringIds.length > 0) {
    const { data: assignments } = await supabase
      .from("program_staff_assignments")
      .select(
        "offering_id, assignment_role, is_active, contact:contact_id ( full_name )"
      )
      .eq("organization_id", organizationId)
      .in("offering_id", offeringIds)
      .eq("is_active", true)

    for (const row of assignments || []) {
      const offeringId = row.offering_id as string
      if (teacherByOfferingId.has(offeringId)) continue
      const role = String(row.assignment_role || "")
      if (role && role !== "primary_instructor" && role !== "instructor") continue
      const contact = row.contact as { full_name?: string | null } | null
      const name = contact?.full_name?.trim()
      if (name) teacherByOfferingId.set(offeringId, name)
    }
  }

  const offeringInputs = offeringRows.map((row) => ({
    id: row.id as string,
    name: (row.name as string) || "Offering",
    teacherName: teacherByOfferingId.get(row.id as string) || null,
    capacity: row.capacity == null ? null : Number(row.capacity),
    capacityMode: (row.capacity_mode as string | null) ?? null,
  }))

  const enrollmentInputs = (enrollments || []).map((row) => ({
    offeringId: (row.offering_id as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    registeredAt:
      (row.enrollment_date as string | null) ||
      (row.created_at as string | null) ||
      null,
  }))

  const { rows, hasCapacity } = buildEnrollmentByOffering(
    offeringInputs,
    enrollmentInputs
  )
  const totals = buildEnrollmentSummaryTotals(
    enrollmentInputs,
    offeringInputs.length,
    rows,
    hasCapacity
  )

  return {
    totals,
    byOffering: rows,
    hasCapacity,
    trends: buildRegistrationTrends(enrollmentInputs),
  }
}

export async function getProgramEnrollmentSummaryAction(programId: string) {
  try {
    const summary = await getProgramEnrollmentSummary(programId)
    return { success: true as const, summary }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Could not load enrollment summary.",
      summary: EMPTY_SUMMARY,
    }
  }
}
