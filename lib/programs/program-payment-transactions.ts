"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { isOfferingCurrentlyActive } from "@/lib/programs/program-offering-display"
import {
  formatPaymentTransactionStatus,
  resolveProgramPaymentMethod,
  resolveProgramPaymentType,
  type PaymentTransactionStatus,
} from "@/lib/programs/payment-transaction-display"
import {
  contactLabel,
  loadContactsByIds,
} from "@/lib/programs/registration-display-helpers"
import { createClient } from "@/lib/supabase/server"

export type ProgramPaymentTransactionRow = {
  id: string
  scheduleId: string
  chargeId: string
  enrollmentId: string
  programId: string
  programName: string
  programKind: "academic" | "seasonal"
  departmentId: string | null
  departmentName: string | null
  offeringId: string | null
  offeringName: string | null
  offeringActivity: "active" | "closed"
  participantName: string
  contactName: string
  contactProfileId: string | null
  paymentType: string
  paymentMethod: string
  amount: number
  status: PaymentTransactionStatus
  paidAt: string | null
  label: string | null
}

type ChargeEmbed = {
  id?: string
  enrollment_id?: string
  charge_type?: string | null
  checkout_id?: string | null
  metadata?: Record<string, unknown> | null
  quote_snapshot?: Record<string, unknown> | null
  registrant_contact_id?: string | null
  payer_contact_id?: string | null
  enrollment?: Record<string, unknown> | Record<string, unknown>[] | null
}

/**
 * Org-wide program payment ledger for Reports → Payment transactions.
 * Uses paid/void/refunded charge schedule rows (same idea as contact Financial).
 */
export async function getProgramPaymentTransactions(filters?: {
  programId?: string | null
  limit?: number
}): Promise<ProgramPaymentTransactionRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()
  const limit = filters?.limit ?? 200

  const { data, error } = await supabase
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
      charge_category,
      metadata,
      updated_at,
      charge:charge_id (
        id,
        enrollment_id,
        charge_type,
        checkout_id,
        metadata,
        quote_snapshot,
        registrant_contact_id,
        payer_contact_id,
        enrollment:enrollment_id (
          id,
          program_id,
          offering_id,
          child_name,
          parent_name,
          participant_contact_id,
          registrant_contact_id,
          payer_contact_id,
          program:program_id (
            name,
            program_kind,
            department_id,
            start_date,
            end_date,
            enrollment_open_date,
            enrollment_close_date
          ),
          offering:offering_id (
            name,
            status,
            start_date,
            end_date,
            enrollment_open_date,
            enrollment_close_date,
            inherit_dates
          )
        )
      )
    `
    )
    .eq("organization_id", organizationId)
    .in("status", ["paid", "void", "refunded"])
    .order("paid_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("getProgramPaymentTransactions:", error.message)
    throw new Error(error.message || "Failed to load payment transactions")
  }

  const contactIds: string[] = []
  for (const schedule of data || []) {
    const charge = schedule.charge as ChargeEmbed | ChargeEmbed[] | null
    const chargeRow = Array.isArray(charge) ? charge[0] : charge
    const enrollmentRaw = chargeRow?.enrollment
    const enrollment = Array.isArray(enrollmentRaw)
      ? enrollmentRaw[0]
      : enrollmentRaw
    for (const id of [
      chargeRow?.registrant_contact_id,
      chargeRow?.payer_contact_id,
      enrollment?.registrant_contact_id,
      enrollment?.payer_contact_id,
    ]) {
      if (typeof id === "string" && id) contactIds.push(id)
    }
  }

  const contactsById = await loadContactsByIds(organizationId, contactIds)

  const departmentIds = [
    ...new Set(
      (data || [])
        .map((schedule) => {
          const charge = schedule.charge as ChargeEmbed | ChargeEmbed[] | null
          const chargeRow = Array.isArray(charge) ? charge[0] : charge
          const enrollmentRaw = chargeRow?.enrollment
          const enrollment = Array.isArray(enrollmentRaw)
            ? enrollmentRaw[0]
            : enrollmentRaw
          const programRel = enrollment?.program as
            | { department_id?: string | null }
            | { department_id?: string | null }[]
            | null
          const program = Array.isArray(programRel) ? programRel[0] : programRel
          return program?.department_id || null
        })
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const departmentNameById = new Map<string, string>()
  if (departmentIds.length > 0) {
    const { data: departments } = await supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", departmentIds)
    for (const department of departments || []) {
      departmentNameById.set(department.id as string, (department.name as string) || "Department")
    }
  }

  const rows: ProgramPaymentTransactionRow[] = []

  for (const schedule of data || []) {
    const charge = schedule.charge as ChargeEmbed | ChargeEmbed[] | null
    const chargeRow = Array.isArray(charge) ? charge[0] : charge
    const enrollmentRaw = chargeRow?.enrollment
    const enrollment = Array.isArray(enrollmentRaw)
      ? enrollmentRaw[0]
      : enrollmentRaw

    if (!enrollment) continue

    const programId = enrollment.program_id as string
    if (filters?.programId && programId !== filters.programId) continue

    const programRel = enrollment.program as
      | {
          name?: string
          program_kind?: string | null
          department_id?: string | null
          start_date?: string | null
          end_date?: string | null
          enrollment_open_date?: string | null
          enrollment_close_date?: string | null
        }
      | {
          name?: string
          program_kind?: string | null
          department_id?: string | null
          start_date?: string | null
          end_date?: string | null
          enrollment_open_date?: string | null
          enrollment_close_date?: string | null
        }[]
      | null
    const offeringRel = enrollment.offering as
      | {
          name?: string
          status?: string | null
          start_date?: string | null
          end_date?: string | null
          enrollment_open_date?: string | null
          enrollment_close_date?: string | null
          inherit_dates?: boolean | null
        }
      | {
          name?: string
          status?: string | null
          start_date?: string | null
          end_date?: string | null
          enrollment_open_date?: string | null
          enrollment_close_date?: string | null
          inherit_dates?: boolean | null
        }[]
      | null
    const program = Array.isArray(programRel) ? programRel[0] : programRel
    const offering = Array.isArray(offeringRel) ? offeringRel[0] : offeringRel
    const departmentId =
      (program?.department_id as string | null | undefined) ?? null
    const offeringActivity =
      offering &&
      isOfferingCurrentlyActive(
        {
          status: offering.status || "draft",
          start_date: offering.start_date ?? null,
          end_date: offering.end_date ?? null,
          enrollment_open_date: offering.enrollment_open_date ?? null,
          enrollment_close_date: offering.enrollment_close_date ?? null,
          inherit_dates: Boolean(offering.inherit_dates),
        },
        program ?? null
      )
        ? ("active" as const)
        : ("closed" as const)

    const contactId =
      (typeof enrollment.registrant_contact_id === "string" &&
        enrollment.registrant_contact_id) ||
      chargeRow?.registrant_contact_id ||
      (typeof enrollment.payer_contact_id === "string" &&
        enrollment.payer_contact_id) ||
      chargeRow?.payer_contact_id ||
      null
    const contact = contactId ? contactsById.get(contactId) : undefined

    const scheduleMetadata =
      (schedule.metadata as Record<string, unknown> | null) || null
    const chargeMetadata = chargeRow?.metadata || null

    rows.push({
      id: `${schedule.id}`,
      scheduleId: schedule.id as string,
      chargeId: (chargeRow?.id as string) || "",
      enrollmentId:
        (enrollment.id as string) || (chargeRow?.enrollment_id as string),
      programId,
      programName: program?.name || "Program",
      programKind: program?.program_kind === "seasonal" ? "seasonal" : "academic",
      departmentId,
      departmentName: departmentId
        ? departmentNameById.get(departmentId) || "Department"
        : null,
      offeringId: (enrollment.offering_id as string | null) ?? null,
      offeringName: offering?.name || null,
      offeringActivity,
      participantName: (enrollment.child_name as string) || "Participant",
      contactName: contactLabel(
        contact,
        (enrollment.parent_name as string | null) ||
          (enrollment.child_name as string | null) ||
          "Contact"
      ),
      contactProfileId: contactId,
      paymentType: resolveProgramPaymentType({
        chargeCategory: (schedule.charge_category as string | null) || null,
        chargeType: chargeRow?.charge_type || null,
        label: (schedule.label as string | null) || null,
        metadata: {
          ...(chargeMetadata || {}),
          ...(scheduleMetadata || {}),
        },
        quote: chargeRow?.quote_snapshot || null,
      }),
      paymentMethod: resolveProgramPaymentMethod({
        scheduleMetadata,
        chargeMetadata,
        checkoutId: chargeRow?.checkout_id || null,
      }),
      amount: Number(schedule.amount || 0),
      status: formatPaymentTransactionStatus(schedule.status as string | null),
      paidAt:
        (schedule.paid_at as string | null) ||
        (schedule.updated_at as string | null) ||
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
