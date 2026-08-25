"use server"

import { DEPARTMENT_WORKSPACE_PROGRAM_STATUSES } from "@/lib/departments/department-active-programs"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  applicationStatusChipFor,
  type ApplicationStatusChip,
} from "@/lib/programs/program-application-types"
import {
  isCancelledEnrollmentStatus,
  isPendingSeatHoldStatus,
  isRosterEnrollmentStatus,
  resolveDisplayPaymentStatus,
} from "@/lib/programs/enrollment-process"
import { createClient } from "@/lib/supabase/server"

export type ProgramRegistrationMetrics = {
  needsReview: number
  awaitingEvaluation: number
  approvedPending: number
  enrolled: number
  balanceDue: number
  pendingCheckout: number
  waitlisted: number
  cancelled: number
  applicationChipCounts: Record<ApplicationStatusChip, number>
}

const EMPTY_CHIP_COUNTS: Record<ApplicationStatusChip, number> = {
  all: 0,
  needs_review: 0,
  evaluation: 0,
  approved: 0,
  waitlisted: 0,
  declined: 0,
}

const EMPTY_METRICS: ProgramRegistrationMetrics = {
  needsReview: 0,
  awaitingEvaluation: 0,
  approvedPending: 0,
  enrolled: 0,
  balanceDue: 0,
  pendingCheckout: 0,
  waitlisted: 0,
  cancelled: 0,
  applicationChipCounts: { ...EMPTY_CHIP_COUNTS },
}

export async function fetchProgramRegistrationMetricsAction(
  departmentId: string,
  programId?: string | null
): Promise<
  | { success: true; metrics: ProgramRegistrationMetrics }
  | { success: false; error: string; metrics: ProgramRegistrationMetrics }
> {
  try {
    const metrics = await fetchProgramRegistrationMetrics(
      departmentId,
      programId
    )
    return { success: true, metrics }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load registration metrics.",
      metrics: EMPTY_METRICS,
    }
  }
}

async function fetchProgramRegistrationMetrics(
  departmentId: string,
  programId?: string | null
): Promise<ProgramRegistrationMetrics> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return EMPTY_METRICS

  const supabase = await createClient()

  let programsQuery = supabase
    .from("programs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .in("status", [...DEPARTMENT_WORKSPACE_PROGRAM_STATUSES])

  if (programId) {
    programsQuery = programsQuery.eq("id", programId)
  }

  const { data: programs, error: programsError } = await programsQuery
  if (programsError) throw new Error(programsError.message)
  const programIds = (programs || []).map((row) => row.id as string)
  if (programIds.length === 0) return EMPTY_METRICS

  const [applicationsResult, enrollmentsResult, waitlistResult] =
    await Promise.all([
      supabase
        .from("program_applications")
        .select("id, status, enrollment_id")
        .eq("organization_id", organizationId)
        .in("program_id", programIds),
      supabase
        .from("program_enrollments")
        .select("id, status, payment_status, payment_required, amount_paid, total_amount")
        .eq("organization_id", organizationId)
        .in("program_id", programIds),
      supabase
        .from("program_waitlist")
        .select("id")
        .eq("organization_id", organizationId)
        .in("program_id", programIds)
        .in("status", ["waiting", "offered"]),
    ])

  if (applicationsResult.error) {
    throw new Error(applicationsResult.error.message)
  }
  if (enrollmentsResult.error) {
    throw new Error(enrollmentsResult.error.message)
  }

  const chipCounts: Record<ApplicationStatusChip, number> = {
    ...EMPTY_CHIP_COUNTS,
  }
  let needsReview = 0
  let awaitingEvaluation = 0
  let approvedPending = 0

  for (const row of applicationsResult.data || []) {
    chipCounts.all += 1
    const chip = applicationStatusChipFor(String(row.status || ""))
    if (chip && chip !== "all") chipCounts[chip] += 1
    if (row.status === "submitted") needsReview += 1
    if (chip === "evaluation") awaitingEvaluation += 1
    if (row.status === "approved" && !row.enrollment_id) approvedPending += 1
  }

  let enrolled = 0
  let balanceDue = 0
  let pendingCheckout = 0
  let cancelled = 0

  for (const row of enrollmentsResult.data || []) {
    const status = String(row.status || "")
    if (isRosterEnrollmentStatus(status)) {
      enrolled += 1
      const payment = resolveDisplayPaymentStatus({
        paymentStatus: row.payment_status as string | null,
        paymentRequired: row.payment_required as boolean | null,
        totalAmount: Number(row.total_amount || 0),
        amountPaid: Number(row.amount_paid || 0),
      })
      if (
        payment === "balance_due" ||
        payment === "partially_paid" ||
        payment === "overdue" ||
        payment === "payment_plan"
      ) {
        const remaining =
          Number(row.total_amount || 0) - Number(row.amount_paid || 0)
        if (remaining > 0.009) balanceDue += 1
      }
    } else if (isPendingSeatHoldStatus(status)) {
      pendingCheckout += 1
    } else if (isCancelledEnrollmentStatus(status)) {
      cancelled += 1
    }
  }

  return {
    needsReview,
    awaitingEvaluation,
    approvedPending,
    enrolled,
    balanceDue,
    pendingCheckout,
    waitlisted: waitlistResult.error
      ? 0
      : (waitlistResult.data || []).length,
    cancelled,
    applicationChipCounts: chipCounts,
  }
}
