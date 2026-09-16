"use server"

import { revalidatePath } from "next/cache"

import { roundMoney } from "@/lib/departments/department-period-helpers"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  PENDING_SEAT_HOLD_STATUSES,
  ROSTER_ENROLLMENT_STATUSES,
} from "@/lib/programs/enrollment-process"
import { canManageOffering } from "@/lib/programs/program-access"
import { cancelEnrollmentRpc, removeWaitlistRpc } from "@/lib/programs/program-lifecycle-actions"
import { isCancelledOfferingStatus } from "@/lib/programs/program-offering-types"
import { setOfferingScheduleFacility } from "@/lib/programs/program-schedule-actions"
import { createClient } from "@/lib/supabase/server"

const CANCEL_REASON = "Offering cancelled — not enough enrollment"

const ACTIVE_ENROLLMENT_STATUSES = [
  ...ROSTER_ENROLLMENT_STATUSES,
  ...PENDING_SEAT_HOLD_STATUSES,
] as const

const OPEN_SCHEDULE_STATUSES = ["scheduled", "due", "past_due", "adjusted"] as const

export type CancelOfferingStudentRow = {
  enrollmentId: string
  name: string
  paid: number
  balance: number
}

export type CancelOfferingImpact = {
  offeringId: string
  offeringName: string
  programId: string
  studentCount: number
  waitlistCount: number
  received: number
  outstanding: number
  students: CancelOfferingStudentRow[]
}

function isVoidedChargeStatus(status: string) {
  const value = status.toLowerCase()
  return value === "voided" || value === "void"
}

function resolvePaymentStatus(total: number, paid: number) {
  if (paid <= 0.009) return "pending"
  if (paid + 0.009 >= total) return "paid"
  return "partial"
}

function resolveChargeStatus(total: number, paid: number) {
  if (paid <= 0.009) return "pending_payment"
  if (paid + 0.009 >= total) return "paid"
  return "partially_paid"
}

function revalidateOfferingCancelPaths(programId: string) {
  revalidatePath("/programs/catalog")
  revalidatePath("/programs/list")
  revalidatePath("/programs/registrations")
  revalidatePath(`/programs/${programId}`)
  revalidatePath(`/programs/${programId}/offerings`)
  revalidatePath(`/customer/programs/${programId}`)
  revalidatePath(`/customer/programs/${programId}/register`)
}

async function loadOfferingForCancel(offeringId: string) {
  if (!(await canManageOffering(offeringId))) {
    return { error: "You do not have permission to manage this offering." as const }
  }
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { error: "No organization selected." as const }
  }
  const supabase = await createClient()
  const { data: offering, error } = await supabase
    .from("program_offerings")
    .select("id, name, program_id, status")
    .eq("id", offeringId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !offering) {
    return { error: error?.message || "Offering not found." }
  }
  if (isCancelledOfferingStatus(String(offering.status || ""))) {
    return { error: "This offering is already cancelled." }
  }
  return {
    organizationId,
    supabase,
    offering: {
      id: offering.id as string,
      name: (offering.name as string) || "Offering",
      programId: offering.program_id as string,
    },
  }
}

export async function getCancelOfferingImpactAction(
  offeringId: string
): Promise<
  { success: true; data: CancelOfferingImpact } | { success: false; error: string }
> {
  try {
    const loaded = await loadOfferingForCancel(offeringId)
    if ("error" in loaded) return { success: false, error: loaded.error }
    const { organizationId, supabase, offering } = loaded

    const [{ data: enrollments, error: enrollmentError }, { data: waitlist, error: waitlistError }] =
      await Promise.all([
        supabase
          .from("program_enrollments")
          .select("id, child_name, status, amount_paid, total_amount")
          .eq("organization_id", organizationId)
          .eq("offering_id", offering.id)
          .in("status", [...ACTIVE_ENROLLMENT_STATUSES]),
        supabase
          .from("program_waitlist")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("offering_id", offering.id)
          .in("status", ["waiting", "offered"]),
      ])

    if (enrollmentError) {
      return { success: false, error: enrollmentError.message }
    }
    if (waitlistError) {
      return { success: false, error: waitlistError.message }
    }

    const students: CancelOfferingStudentRow[] = (enrollments || []).map((row) => {
      const paid = roundMoney(Number(row.amount_paid || 0))
      const total = roundMoney(Number(row.total_amount || 0))
      return {
        enrollmentId: row.id as string,
        name: String(row.child_name || "").trim() || "Student",
        paid,
        balance: roundMoney(Math.max(total - paid, 0)),
      }
    })
    students.sort((a, b) => a.name.localeCompare(b.name))

    return {
      success: true,
      data: {
        offeringId: offering.id,
        offeringName: offering.name,
        programId: offering.programId,
        studentCount: students.length,
        waitlistCount: (waitlist || []).length,
        received: roundMoney(students.reduce((sum, row) => sum + row.paid, 0)),
        outstanding: roundMoney(students.reduce((sum, row) => sum + row.balance, 0)),
        students,
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not load offering enrollments.",
    }
  }
}

async function refundPaidSchedulesForEnrollment(input: {
  supabase: Awaited<ReturnType<typeof createClient>>
  organizationId: string
  enrollmentId: string
}) {
  const { data: charges, error } = await input.supabase
    .from("program_charges")
    .select("id, amount_paid, total, charge_status")
    .eq("organization_id", input.organizationId)
    .eq("enrollment_id", input.enrollmentId)

  if (error) throw new Error(error.message)

  for (const charge of charges || []) {
    if (isVoidedChargeStatus(String(charge.charge_status || ""))) continue

    const { data: schedules, error: scheduleError } = await input.supabase
      .from("program_charge_schedule")
      .select("id, amount, status, metadata")
      .eq("organization_id", input.organizationId)
      .eq("charge_id", charge.id)
      .eq("status", "paid")

    if (scheduleError) throw new Error(scheduleError.message)

    let paidRemaining = roundMoney(Number(charge.amount_paid || 0))
    const chargeTotal = roundMoney(Number(charge.total || 0))

    for (const schedule of schedules || []) {
      const refundAmount = roundMoney(Number(schedule.amount || 0))
      if (refundAmount <= 0.009) continue
      const metadata = {
        ...((schedule.metadata as Record<string, unknown> | null) || {}),
        refund: {
          amount: refundAmount,
          reason: CANCEL_REASON,
          refunded_at: new Date().toISOString(),
        },
      }
      const { error: updateScheduleError } = await input.supabase
        .from("program_charge_schedule")
        .update({
          amount: 0,
          status: "refunded",
          paid_at: null,
          metadata,
        })
        .eq("id", schedule.id)
        .eq("organization_id", input.organizationId)
      if (updateScheduleError) throw new Error(updateScheduleError.message)
      paidRemaining = roundMoney(Math.max(paidRemaining - refundAmount, 0))
    }

    const { error: chargeUpdateError } = await input.supabase
      .from("program_charges")
      .update({
        amount_paid: paidRemaining,
        due_today: Math.max(chargeTotal - paidRemaining, 0),
        charge_status: resolveChargeStatus(chargeTotal, paidRemaining),
        paid_at: paidRemaining > 0.009 ? new Date().toISOString() : null,
      })
      .eq("id", charge.id)
      .eq("organization_id", input.organizationId)
    if (chargeUpdateError) throw new Error(chargeUpdateError.message)
  }

  const { data: enrollment } = await input.supabase
    .from("program_enrollments")
    .select("total_amount")
    .eq("id", input.enrollmentId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  const { data: paidCharges } = await input.supabase
    .from("program_charges")
    .select("amount_paid")
    .eq("organization_id", input.organizationId)
    .eq("enrollment_id", input.enrollmentId)

  const paid = roundMoney(
    (paidCharges || [])
      .map((row) => Number(row.amount_paid || 0))
      .reduce((sum, value) => sum + value, 0)
  )
  const total = roundMoney(Number(enrollment?.total_amount || 0))

  await input.supabase
    .from("program_enrollments")
    .update({
      amount_paid: paid,
      payment_status: resolvePaymentStatus(total, paid),
    })
    .eq("id", input.enrollmentId)
    .eq("organization_id", input.organizationId)
}

async function writeOffRemainingForEnrollment(input: {
  supabase: Awaited<ReturnType<typeof createClient>>
  organizationId: string
  enrollmentId: string
}) {
  const { data: enrollment, error } = await input.supabase
    .from("program_enrollments")
    .select("amount_paid, total_amount")
    .eq("id", input.enrollmentId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const paid = roundMoney(Number(enrollment?.amount_paid || 0))
  const total = paid

  const { data: charges } = await input.supabase
    .from("program_charges")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("enrollment_id", input.enrollmentId)

  const chargeIds = (charges || []).map((row) => row.id as string)
  if (chargeIds.length > 0) {
    await input.supabase
      .from("program_charge_schedule")
      .update({ status: "void" })
      .eq("organization_id", input.organizationId)
      .in("charge_id", chargeIds)
      .in("status", [...OPEN_SCHEDULE_STATUSES])

    await input.supabase
      .from("program_charges")
      .update({
        total,
        amount_paid: paid,
        due_today: 0,
        charge_status: resolveChargeStatus(total, paid),
      })
      .eq("organization_id", input.organizationId)
      .in("id", chargeIds)
  }

  await input.supabase
    .from("program_enrollments")
    .update({
      total_amount: total,
      amount_paid: paid,
      payment_status: resolvePaymentStatus(total, paid),
    })
    .eq("id", input.enrollmentId)
    .eq("organization_id", input.organizationId)
}

export async function cancelOfferingWithStudentsAction(input: {
  offeringId: string
  refundPayments: boolean
}): Promise<{ success: true; unenrolled: number } | { success: false; error: string }> {
  try {
    const loaded = await loadOfferingForCancel(input.offeringId)
    if ("error" in loaded) return { success: false, error: loaded.error }
    const { organizationId, supabase, offering } = loaded

    const { data: enrollments, error: enrollmentError } = await supabase
      .from("program_enrollments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("offering_id", offering.id)
      .in("status", [...ACTIVE_ENROLLMENT_STATUSES])

    if (enrollmentError) {
      return { success: false, error: enrollmentError.message }
    }

    const enrollmentIds = (enrollments || []).map((row) => row.id as string)

    for (const enrollmentId of enrollmentIds) {
      if (input.refundPayments) {
        await refundPaidSchedulesForEnrollment({
          supabase,
          organizationId,
          enrollmentId,
        })
      }
      await writeOffRemainingForEnrollment({
        supabase,
        organizationId,
        enrollmentId,
      })
      try {
        await cancelEnrollmentRpc({
          organizationId,
          enrollmentId,
          cancelReason: CANCEL_REASON,
        })
      } catch {
        const { error: updateError } = await supabase
          .from("program_enrollments")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancel_reason: CANCEL_REASON,
            updated_at: new Date().toISOString(),
          })
          .eq("id", enrollmentId)
          .eq("organization_id", organizationId)
        if (updateError) throw new Error(updateError.message)
      }
    }

    const { data: waitlistRows, error: waitlistError } = await supabase
      .from("program_waitlist")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("offering_id", offering.id)
      .in("status", ["waiting", "offered"])

    if (waitlistError) {
      return { success: false, error: waitlistError.message }
    }

    for (const row of waitlistRows || []) {
      try {
        await removeWaitlistRpc({
          organizationId,
          waitlistId: row.id as string,
          reason: CANCEL_REASON,
        })
      } catch (error) {
        console.warn(
          "cancelOfferingWithStudentsAction waitlist:",
          error instanceof Error ? error.message : error
        )
      }
    }

    const { error: offeringError } = await supabase
      .from("program_offerings")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", offering.id)
      .eq("organization_id", organizationId)

    if (offeringError) {
      return { success: false, error: offeringError.message }
    }

    try {
      await setOfferingScheduleFacility({
        program_id: offering.programId,
        offering_id: offering.id,
        venue_id: null,
        location: null,
      })
    } catch (error) {
      console.warn(
        "cancelOfferingWithStudentsAction space release:",
        error instanceof Error ? error.message : error
      )
    }

    revalidateOfferingCancelPaths(offering.programId)
    return { success: true, unenrolled: enrollmentIds.length }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not cancel this offering.",
    }
  }
}
