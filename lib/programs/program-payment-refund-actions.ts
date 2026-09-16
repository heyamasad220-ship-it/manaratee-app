"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { canManageEnrollment, canManageProgram } from "@/lib/programs/program-access"

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

export async function refundProgramSchedulePaymentAction(input: {
  scheduleId: string
  refundAmount: number
  reason?: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected" }
  }

  const scheduleId = String(input.scheduleId || "").trim()
  const refundAmount = Number(input.refundAmount || 0)
  if (!scheduleId) {
    return { success: false, error: "Missing payment schedule" }
  }
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    return { success: false, error: "Enter a valid refund amount" }
  }

  const supabase = await createClient()
  const { data: schedule, error: scheduleError } = await supabase
    .from("program_charge_schedule")
    .select("id, charge_id, amount, status, paid_at, metadata")
    .eq("organization_id", organizationId)
    .eq("id", scheduleId)
    .maybeSingle()

  if (scheduleError || !schedule) {
    return { success: false, error: scheduleError?.message || "Payment not found" }
  }

  if ((schedule.status || "").toLowerCase() !== "paid") {
    return { success: false, error: "Only paid schedule payments can be refunded" }
  }

  const originalAmount = Number(schedule.amount || 0)
  if (refundAmount - 0.009 > originalAmount) {
    return { success: false, error: "Refund amount exceeds the payment amount" }
  }

  const { data: charge, error: chargeError } = await supabase
    .from("program_charges")
    .select("id, enrollment_id, program_id, amount_paid, total")
    .eq("organization_id", organizationId)
    .eq("id", schedule.charge_id)
    .maybeSingle()

  if (chargeError || !charge) {
    return { success: false, error: chargeError?.message || "Charge not found" }
  }

  const canRefund = charge.program_id
    ? await canManageProgram(charge.program_id as string)
    : charge.enrollment_id
      ? await canManageEnrollment(charge.enrollment_id as string)
      : false
  if (!canRefund) {
    return { success: false, error: "You do not have permission to refund this payment." }
  }

  const isFullRefund = refundAmount + 0.009 >= originalAmount
  const nextScheduleAmount = Math.max(0, originalAmount - refundAmount)
  const nextPaidTotal = Math.max(0, Number(charge.amount_paid || 0) - refundAmount)
  const chargeTotal = Number(charge.total || 0)
  const metadata = {
    ...((schedule.metadata as Record<string, unknown> | null) || {}),
    refund: {
      amount: refundAmount,
      reason: input.reason?.trim() || null,
      refunded_at: new Date().toISOString(),
    },
  }

  const { error: scheduleUpdateError } = await supabase
    .from("program_charge_schedule")
    .update({
      amount: nextScheduleAmount,
      status: isFullRefund ? "refunded" : "paid",
      paid_at: isFullRefund ? null : schedule.paid_at,
      metadata,
    })
    .eq("id", scheduleId)
    .eq("organization_id", organizationId)

  if (scheduleUpdateError) {
    return { success: false, error: scheduleUpdateError.message }
  }

  const { error: chargeUpdateError } = await supabase
    .from("program_charges")
    .update({
      amount_paid: nextPaidTotal,
      due_today: Math.max(chargeTotal - nextPaidTotal, 0),
      charge_status: resolveChargeStatus(chargeTotal, nextPaidTotal),
      paid_at: nextPaidTotal > 0.009 ? new Date().toISOString() : null,
    })
    .eq("id", charge.id)
    .eq("organization_id", organizationId)

  if (chargeUpdateError) {
    return { success: false, error: chargeUpdateError.message }
  }

  if (charge.enrollment_id) {
    await supabase
      .from("program_enrollments")
      .update({
        amount_paid: nextPaidTotal,
        payment_status: resolvePaymentStatus(chargeTotal, nextPaidTotal),
      })
      .eq("id", charge.enrollment_id)
      .eq("organization_id", organizationId)

    revalidatePath(`/programs/registrations/${charge.enrollment_id}`)
  }

  revalidatePath("/programs/registrations")
  if (charge.program_id) {
    revalidatePath(`/programs/${charge.program_id}/billing`)
  }
  revalidatePath("/contacts")

  return { success: true }
}
