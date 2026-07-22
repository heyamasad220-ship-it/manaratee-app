"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"

export type ProgramPaymentTransactionRow = {
  id: string
  scheduleId: string
  chargeId: string
  enrollmentId: string
  programId: string
  programName: string
  offeringId: string | null
  offeringName: string | null
  participantName: string
  amount: number
  status: "Succeeded" | "Failed" | "Refunded"
  paidAt: string | null
  label: string | null
}

/**
 * Org-wide program payment ledger for Reports → Payment transactions.
 * Uses paid/refunded charge schedule rows (same idea as contact Financial).
 */
export async function getProgramPaymentTransactions(filters?: {
  programId?: string | null
  limit?: number
}): Promise<ProgramPaymentTransactionRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()
  const limit = filters?.limit ?? 200

  let scheduleQuery = supabase
    .from("program_charge_schedule")
    .select(
      `
      id,
      charge_id,
      amount,
      paid_at,
      due_date,
      status,
      label,
      charge:charge_id (
        id,
        enrollment_id,
        enrollment:enrollment_id (
          id,
          program_id,
          offering_id,
          child_name,
          participant_contact_id,
          program:program_id ( name ),
          offering:offering_id ( name )
        )
      )
    `
    )
    .eq("organization_id", organizationId)
    .in("status", ["paid", "refunded"])
    .order("paid_at", { ascending: false })
    .limit(limit)

  const { data, error } = await scheduleQuery

  if (error) {
    console.error("getProgramPaymentTransactions:", error.message)
    throw new Error(error.message || "Failed to load payment transactions")
  }

  const rows: ProgramPaymentTransactionRow[] = []

  for (const schedule of data || []) {
    const charge = schedule.charge as
      | {
          id: string
          enrollment_id: string
          enrollment?: Record<string, unknown> | Record<string, unknown>[] | null
        }
      | null
    const enrollmentRaw = charge?.enrollment
    const enrollment = Array.isArray(enrollmentRaw)
      ? enrollmentRaw[0]
      : enrollmentRaw

    if (!enrollment) continue

    const programId = enrollment.program_id as string
    if (filters?.programId && programId !== filters.programId) continue

    const programRel = enrollment.program as
      | { name?: string }
      | { name?: string }[]
      | null
    const offeringRel = enrollment.offering as
      | { name?: string }
      | { name?: string }[]
      | null
    const programName = Array.isArray(programRel)
      ? programRel[0]?.name
      : programRel?.name
    const offeringName = Array.isArray(offeringRel)
      ? offeringRel[0]?.name
      : offeringRel?.name

    const statusRaw = String(schedule.status || "").toLowerCase()
    const status: ProgramPaymentTransactionRow["status"] =
      statusRaw === "refunded" ? "Refunded" : "Succeeded"

    rows.push({
      id: `${schedule.id}`,
      scheduleId: schedule.id as string,
      chargeId: (charge?.id as string) || "",
      enrollmentId: (enrollment.id as string) || (charge?.enrollment_id as string),
      programId,
      programName: programName || "Program",
      offeringId: (enrollment.offering_id as string | null) ?? null,
      offeringName: offeringName || null,
      participantName: (enrollment.child_name as string) || "Participant",
      amount: Number(schedule.amount || 0),
      status,
      paidAt:
        (schedule.paid_at as string | null) ||
        (schedule.due_date as string | null) ||
        null,
      label: (schedule.label as string | null) ?? null,
    })
  }

  return rows
}

export async function fetchProgramPaymentTransactionsAction(filters?: {
  programId?: string | null
  limit?: number
}) {
  try {
    const rows = await getProgramPaymentTransactions(filters)
    return { success: true as const, rows }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load payment transactions.",
    }
  }
}
