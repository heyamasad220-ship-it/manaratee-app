"use server"

import { revalidatePath } from "next/cache"

import { recordEnrollmentFaAward } from "@/lib/programs/fa-awards"
import { clampDateToProgramYear } from "@/lib/programs/program-year-attribution"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"

function resolvePaymentStatus(total: number, paid: number) {
  if (total <= 0.009) return "paid"
  if (paid <= 0.009) return "pending"
  if (paid + 0.009 >= total) return "paid"
  return "partial"
}

function resolveChargeStatus(total: number, paid: number) {
  if (total <= 0.009) return "paid"
  if (paid <= 0.009) return "pending_payment"
  if (paid + 0.009 >= total) return "paid"
  return "partially_paid"
}

function revalidateEnrollmentPaymentPaths(enrollmentId: string, programId?: string | null) {
  revalidatePath("/programs/registrations")
  revalidatePath(`/programs/registrations/${enrollmentId}`)
  revalidatePath("/programs/reports")
  if (programId) {
    revalidatePath(`/programs/${programId}`)
    revalidatePath(`/programs/${programId}/billing`)
  }
}

async function requireOrgId() {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }
  return organizationId
}

function appendNote(existing: string | null | undefined, addition: string) {
  const next = addition.trim()
  if (!next) return existing?.trim() || null
  const prior = (existing || "").trim()
  if (!prior) return next
  return `${prior}\n\n${next}`
}

export async function receiveEnrollmentPaymentAction(input: {
  enrollmentId: string
  amount: number
  note?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const organizationId = await requireOrgId()
    const enrollmentId = String(input.enrollmentId || "").trim()
    const amount = Number(input.amount)

    if (!enrollmentId) {
      return { success: false, error: "Missing enrollment." }
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: "Enter a payment amount greater than zero." }
    }

    const supabase = await createClient()
    const { data: enrollment, error } = await supabase
      .from("program_enrollments")
      .select("id, program_id, total_amount, amount_paid, notes")
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)
      .maybeSingle()

    if (error || !enrollment) {
      return {
        success: false,
        error: error?.message || "Enrollment not found.",
      }
    }

    let programStart: string | null = null
    let programEnd: string | null = null
    if (enrollment.program_id) {
      const { data: program } = await supabase
        .from("programs")
        .select("start_date, end_date")
        .eq("organization_id", organizationId)
        .eq("id", enrollment.program_id)
        .maybeSingle()
      programStart = (program?.start_date as string | null) || null
      programEnd = (program?.end_date as string | null) || null
    }

    const total = Number(enrollment.total_amount || 0)
    const previouslyPaid = Number(enrollment.amount_paid || 0)
    const nextPaid = Math.min(
      total > 0 ? total : previouslyPaid + amount,
      previouslyPaid + amount
    )
    const paymentNote = input.note?.trim()
      ? `Payment received $${amount.toFixed(2)}: ${input.note.trim()}`
      : `Payment received $${amount.toFixed(2)}`
    const receivedAt = new Date().toISOString()

    const { error: updateError } = await supabase
      .from("program_enrollments")
      .update({
        amount_paid: nextPaid,
        payment_status: resolvePaymentStatus(total, nextPaid),
        notes: appendNote(enrollment.notes as string | null, paymentNote),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    const { data: charges } = await supabase
      .from("program_charges")
      .select("id, total")
      .eq("organization_id", organizationId)
      .eq("enrollment_id", enrollmentId)

    for (const charge of charges || []) {
      const chargeTotal = Number(charge.total || 0)
      await supabase
        .from("program_charges")
        .update({
          amount_paid: nextPaid,
          due_today: Math.max(chargeTotal - nextPaid, 0),
          charge_status: resolveChargeStatus(chargeTotal, nextPaid),
          paid_at: nextPaid > 0.009 ? receivedAt : null,
        })
        .eq("organization_id", organizationId)
        .eq("id", charge.id)
    }

    // Best-effort: mark the oldest unpaid schedule row as paid when amounts match.
    const { data: openSchedules } = await supabase
      .from("program_charge_schedule")
      .select("id, amount, status, due_date, charge:charge_id ( id, enrollment_id )")
      .eq("organization_id", organizationId)
      .in("status", ["scheduled", "due", "past_due", "adjusted"])
      .order("due_date", { ascending: true })
      .limit(50)

    const matching = (openSchedules || []).find((row) => {
      const charge = row.charge as
        | { enrollment_id?: string }
        | { enrollment_id?: string }[]
        | null
      const enrollmentRef = Array.isArray(charge) ? charge[0] : charge
      return (
        enrollmentRef?.enrollment_id === enrollmentId &&
        Math.abs(Number(row.amount || 0) - amount) < 0.01
      )
    })

    if (matching) {
      // Cash date stays "now"; clamp due_date into year/season so late receipts
      // still attribute to Financial Summary for that program.
      const dueClamped =
        clampDateToProgramYear(
          (matching.due_date as string | null) || receivedAt.slice(0, 10),
          programStart,
          programEnd
        ) || (matching.due_date as string | null)

      await supabase
        .from("program_charge_schedule")
        .update({
          status: "paid",
          paid_at: receivedAt,
          ...(dueClamped ? { due_date: dueClamped } : {}),
        })
        .eq("id", matching.id)
        .eq("organization_id", organizationId)
    }

    revalidateEnrollmentPaymentPaths(
      enrollmentId,
      enrollment.program_id as string | null
    )
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to receive payment.",
    }
  }
}

/**
 * Staff edit of a registration: offering and/or fee (not FA, not a payment void).
 */
export async function getEnrollmentEditContextAction(
  enrollmentId: string
): Promise<
  | {
      success: true
      programId: string | null
      offeringId: string | null
      totalAmount: number
      amountPaid: number
      offerings: Array<{
        id: string
        name: string
        programId: string
        programName: string
      }>
    }
  | { success: false; error: string }
> {
  try {
    const organizationId = await requireOrgId()
    const id = String(enrollmentId || "").trim()
    if (!id) return { success: false, error: "Missing enrollment." }

    const supabase = await createClient()
    const { data: enrollment, error } = await supabase
      .from("program_enrollments")
      .select("id, program_id, offering_id, total_amount, amount_paid")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()

    if (error || !enrollment) {
      return {
        success: false,
        error: error?.message || "Enrollment not found.",
      }
    }

    const { data: offeringRows, error: offeringError } = await supabase
      .from("program_offerings")
      .select("id, name, program_id, status, program:program_id ( name )")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .order("name", { ascending: true })
      .limit(500)

    if (offeringError) {
      return { success: false, error: offeringError.message }
    }

    const offerings = (offeringRows || []).map((row) => {
      const program = row.program as
        | { name?: string | null }
        | { name?: string | null }[]
        | null
      const programRow = Array.isArray(program) ? program[0] : program
      return {
        id: row.id as string,
        name: (row.name as string) || "Offering",
        programId: row.program_id as string,
        programName: programRow?.name?.trim() || "Program",
      }
    })

    // Prefer same-program offerings first in the list.
    const programId = (enrollment.program_id as string | null) || null
    offerings.sort((a, b) => {
      const aSame = programId && a.programId === programId ? 0 : 1
      const bSame = programId && b.programId === programId ? 0 : 1
      if (aSame !== bSame) return aSame - bSame
      return a.name.localeCompare(b.name)
    })

    return {
      success: true,
      programId,
      offeringId: (enrollment.offering_id as string | null) || null,
      totalAmount: Number(enrollment.total_amount || 0),
      amountPaid: Number(enrollment.amount_paid || 0),
      offerings,
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load registration details.",
    }
  }
}

export async function updateEnrollmentRegistrationAction(input: {
  enrollmentId: string
  offeringId?: string | null
  feeAmount?: number | null
  note?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const organizationId = await requireOrgId()
    const enrollmentId = String(input.enrollmentId || "").trim()
    const nextOfferingId =
      input.offeringId === undefined
        ? undefined
        : String(input.offeringId || "").trim() || null
    const hasFeeInput =
      input.feeAmount !== undefined && input.feeAmount !== null
    const feeAmount = hasFeeInput
      ? Math.round(Number(input.feeAmount) * 100) / 100
      : null
    const note = String(input.note || "").trim()

    if (!enrollmentId) {
      return { success: false, error: "Missing enrollment." }
    }
    if (hasFeeInput && (feeAmount == null || !Number.isFinite(feeAmount) || feeAmount < 0)) {
      return { success: false, error: "Enter a valid fee (0 or more)." }
    }

    const supabase = await createClient()
    const { data: enrollment, error } = await supabase
      .from("program_enrollments")
      .select(
        "id, program_id, offering_id, department_id, participant_contact_id, child_person_id, total_amount, amount_paid, notes, charge_id"
      )
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)
      .maybeSingle()

    if (error || !enrollment) {
      return {
        success: false,
        error: error?.message || "Enrollment not found.",
      }
    }

    const previousTotal = Number(enrollment.total_amount || 0)
    const amountPaid = Number(enrollment.amount_paid || 0)
    const previousOfferingId = (enrollment.offering_id as string | null) || null
    const offeringChanged =
      nextOfferingId !== undefined && nextOfferingId !== previousOfferingId
    const feeChanged =
      hasFeeInput &&
      feeAmount != null &&
      Math.abs(feeAmount - previousTotal) >= 0.01

    if (!offeringChanged && !feeChanged) {
      return {
        success: false,
        error: "Change the offering or fee before saving.",
      }
    }

    if (feeChanged && feeAmount != null && feeAmount + 0.009 < amountPaid) {
      return {
        success: false,
        error: `Fee cannot be less than amount already received ($${amountPaid.toFixed(2)}).`,
      }
    }

    let nextProgramId = enrollment.program_id as string | null
    let nextDepartmentId = enrollment.department_id as string | null
    let previousOfferingName: string | null = null
    let nextOfferingName: string | null = null

    if (offeringChanged) {
      if (!nextOfferingId) {
        return { success: false, error: "Choose an offering." }
      }

      const { data: offering, error: offeringError } = await supabase
        .from("program_offerings")
        .select("id, name, program_id, status, program:program_id ( name, department_id )")
        .eq("organization_id", organizationId)
        .eq("id", nextOfferingId)
        .maybeSingle()

      if (offeringError || !offering) {
        return {
          success: false,
          error: offeringError?.message || "Offering not found.",
        }
      }
      if (String(offering.status || "").toLowerCase() === "archived") {
        return { success: false, error: "That offering is archived." }
      }

      const program = offering.program as
        | { name?: string | null; department_id?: string | null }
        | { name?: string | null; department_id?: string | null }[]
        | null
      const programRow = Array.isArray(program) ? program[0] : program
      nextProgramId = offering.program_id as string
      nextDepartmentId = (programRow?.department_id as string | null) || null
      nextOfferingName = (offering.name as string) || "Offering"

      if (previousOfferingId) {
        const { data: priorOffering } = await supabase
          .from("program_offerings")
          .select("name")
          .eq("id", previousOfferingId)
          .maybeSingle()
        previousOfferingName = (priorOffering?.name as string | null) || null
      }

      const participantContactId =
        (enrollment.participant_contact_id as string | null) || null
      const childPersonId = (enrollment.child_person_id as string | null) || null

      if (participantContactId) {
        const { data: clash } = await supabase
          .from("program_enrollments")
          .select("id, status")
          .eq("organization_id", organizationId)
          .eq("offering_id", nextOfferingId)
          .eq("participant_contact_id", participantContactId)
          .neq("id", enrollmentId)
          .limit(20)
        const activeClash = (clash || []).find(
          (row) =>
            !["withdrawn", "cancelled", "transferred", "expired"].includes(
              String(row.status || "").toLowerCase()
            )
        )
        if (activeClash) {
          return {
            success: false,
            error: "This participant is already registered in that offering.",
          }
        }
      }

      if (childPersonId) {
        const { data: clash } = await supabase
          .from("program_enrollments")
          .select("id, status")
          .eq("organization_id", organizationId)
          .eq("offering_id", nextOfferingId)
          .eq("child_person_id", childPersonId)
          .neq("id", enrollmentId)
          .limit(20)
        const activeClash = (clash || []).find(
          (row) =>
            !["withdrawn", "cancelled", "transferred", "expired"].includes(
              String(row.status || "").toLowerCase()
            )
        )
        if (activeClash) {
          return {
            success: false,
            error: "This participant is already registered in that offering.",
          }
        }
      }
    }

    const nextFee = feeChanged && feeAmount != null ? feeAmount : previousTotal
    const noteParts: string[] = []
    if (offeringChanged) {
      noteParts.push(
        `Offering changed to ${nextOfferingName || "selected offering"}${
          previousOfferingName ? ` (was ${previousOfferingName})` : ""
        }.`
      )
    }
    if (feeChanged) {
      noteParts.push(
        `Registration fee updated to $${nextFee.toFixed(2)} (was $${previousTotal.toFixed(2)}).`
      )
    }
    if (note) noteParts.push(note)

    const enrollmentUpdate: Record<string, unknown> = {
      notes: appendNote(enrollment.notes as string | null, noteParts.join(" ")),
      updated_at: new Date().toISOString(),
    }
    if (offeringChanged) {
      enrollmentUpdate.offering_id = nextOfferingId
      enrollmentUpdate.program_id = nextProgramId
      if (nextDepartmentId !== undefined) {
        enrollmentUpdate.department_id = nextDepartmentId
      }
    }
    if (feeChanged) {
      enrollmentUpdate.total_amount = nextFee
      enrollmentUpdate.payment_status = resolvePaymentStatus(nextFee, amountPaid)
    }

    const { error: updateError } = await supabase
      .from("program_enrollments")
      .update(enrollmentUpdate)
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    let chargeId = (enrollment.charge_id as string | null) || null
    if (!chargeId) {
      const { data: chargeRow } = await supabase
        .from("program_charges")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("enrollment_id", enrollmentId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      chargeId = (chargeRow?.id as string | undefined) || null
    }

    if (chargeId) {
      const chargeUpdate: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (offeringChanged) {
        chargeUpdate.offering_id = nextOfferingId
        chargeUpdate.program_id = nextProgramId
      }
      if (feeChanged) {
        chargeUpdate.total = nextFee
        chargeUpdate.due_today = Math.max(nextFee - amountPaid, 0)
        chargeUpdate.charge_status = resolveChargeStatus(nextFee, amountPaid)
        chargeUpdate.paid_at = amountPaid > 0.009 ? new Date().toISOString() : null
      }

      await supabase
        .from("program_charges")
        .update(chargeUpdate)
        .eq("organization_id", organizationId)
        .eq("id", chargeId)

      if (feeChanged) {
        const remaining = Math.max(nextFee - amountPaid, 0)
        const { data: openSchedules } = await supabase
          .from("program_charge_schedule")
          .select("id, amount")
          .eq("organization_id", organizationId)
          .eq("charge_id", chargeId)
          .in("status", ["scheduled", "due", "past_due", "adjusted"])
          .order("due_date", { ascending: true })

        if (openSchedules && openSchedules.length === 1) {
          await supabase
            .from("program_charge_schedule")
            .update({ amount: remaining })
            .eq("organization_id", organizationId)
            .eq("id", openSchedules[0].id)
        }
      }
    }

    revalidateEnrollmentPaymentPaths(enrollmentId, nextProgramId)
    if (
      offeringChanged &&
      enrollment.program_id &&
      enrollment.program_id !== nextProgramId
    ) {
      revalidatePath(`/programs/${enrollment.program_id}`)
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update registration.",
    }
  }
}

/** @deprecated Use updateEnrollmentRegistrationAction */
export async function updateEnrollmentRegistrationFeeAction(input: {
  enrollmentId: string
  feeAmount: number
  note?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  return updateEnrollmentRegistrationAction({
    enrollmentId: input.enrollmentId,
    feeAmount: input.feeAmount,
    note: input.note,
  })
}

export async function getEnrollmentAssistanceContextAction(
  enrollmentId: string
): Promise<
  | {
      success: true
      totalAmount: number
      amountPaid: number
      openInstallmentCount: number
      currentInstallmentAmount: number | null
    }
  | { success: false; error: string }
> {
  try {
    const organizationId = await requireOrgId()
    const id = String(enrollmentId || "").trim()
    if (!id) return { success: false, error: "Missing enrollment." }

    const supabase = await createClient()
    const { data: enrollment, error } = await supabase
      .from("program_enrollments")
      .select("id, total_amount, amount_paid, charge_id")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()

    if (error || !enrollment) {
      return {
        success: false,
        error: error?.message || "Enrollment not found.",
      }
    }

    let chargeId = (enrollment.charge_id as string | null) || null
    if (!chargeId) {
      const { data: chargeRow } = await supabase
        .from("program_charges")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("enrollment_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      chargeId = (chargeRow?.id as string | undefined) || null
    }

    let openInstallmentCount = 0
    let currentInstallmentAmount: number | null = null

    if (chargeId) {
      const { data: schedules } = await supabase
        .from("program_charge_schedule")
        .select("id, amount")
        .eq("organization_id", organizationId)
        .eq("charge_id", chargeId)
        .in("status", ["scheduled", "due", "past_due", "adjusted"])
        .order("due_date", { ascending: true })

      openInstallmentCount = schedules?.length || 0
      if (schedules && schedules.length > 0) {
        currentInstallmentAmount = Number(schedules[0].amount || 0)
      }
    }

    if (openInstallmentCount === 0) {
      const { data: plans } = await supabase
        .from("program_payment_plans")
        .select("id, installment_amount")
        .eq("organization_id", organizationId)
        .eq("enrollment_id", id)
        .in("status", ["scheduled", "due", "pending", "open"])
        .order("due_date", { ascending: true })

      openInstallmentCount = plans?.length || 0
      if (plans && plans.length > 0) {
        currentInstallmentAmount = Number(plans[0].installment_amount || 0)
      }
    }

    return {
      success: true,
      totalAmount: Number(enrollment.total_amount || 0),
      amountPaid: Number(enrollment.amount_paid || 0),
      openInstallmentCount,
      currentInstallmentAmount,
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load assistance details.",
    }
  }
}

export async function applyEnrollmentFinancialAssistanceAction(input: {
  enrollmentId: string
  discountedAmount: number
  note?: string | null
  /** When set, fee becomes amountPaid + monthlyAmount × remainingMonths and open installments are rewritten. */
  monthlyAmount?: number | null
  remainingMonths?: number | null
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const organizationId = await requireOrgId()
    const enrollmentId = String(input.enrollmentId || "").trim()
    const hasMonthly =
      input.monthlyAmount != null &&
      Number.isFinite(Number(input.monthlyAmount)) &&
      Number(input.monthlyAmount) >= 0

    if (!enrollmentId) {
      return { success: false, error: "Missing enrollment." }
    }

    const supabase = await createClient()
    const { data: enrollment, error } = await supabase
      .from("program_enrollments")
      .select(
        "id, program_id, offering_id, child_name, participant_contact_id, total_amount, amount_paid, notes, charge_id, status"
      )
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)
      .maybeSingle()

    if (error || !enrollment) {
      return {
        success: false,
        error: error?.message || "Enrollment not found.",
      }
    }

    const previousTotal = Number(enrollment.total_amount || 0)
    const amountPaid = Number(enrollment.amount_paid || 0)

    let discountedAmount = Math.round(Number(input.discountedAmount) * 100) / 100
    let monthlyAmount: number | null = null
    let remainingMonths: number | null = null

    if (hasMonthly) {
      monthlyAmount = Math.round(Number(input.monthlyAmount) * 100) / 100
      remainingMonths = Math.floor(Number(input.remainingMonths))
      if (!Number.isFinite(monthlyAmount) || monthlyAmount < 0) {
        return { success: false, error: "Enter a valid monthly amount." }
      }
      if (
        !Number.isFinite(remainingMonths) ||
        remainingMonths == null ||
        remainingMonths < 1 ||
        remainingMonths > 36
      ) {
        return {
          success: false,
          error: "Enter remaining months between 1 and 36.",
        }
      }
      discountedAmount =
        Math.round((amountPaid + monthlyAmount * remainingMonths) * 100) / 100
    }

    if (!Number.isFinite(discountedAmount) || discountedAmount < 0) {
      return { success: false, error: "Enter a valid discounted fee (0 or more)." }
    }

    if (discountedAmount + 0.009 < amountPaid) {
      return {
        success: false,
        error: `Discounted fee cannot be less than amount already paid ($${amountPaid.toFixed(2)}).`,
      }
    }

    if (previousTotal > 0 && discountedAmount + 0.009 >= previousTotal) {
      return {
        success: false,
        error: `Enter a fee lower than the current fee ($${previousTotal.toFixed(2)}).`,
      }
    }

    const faNote = hasMonthly
      ? input.note?.trim()
        ? `Financial assistance: $${monthlyAmount!.toFixed(2)}/mo × ${remainingMonths} mo (fee $${discountedAmount.toFixed(2)}, was $${previousTotal.toFixed(2)}). ${input.note.trim()}`
        : `Financial assistance: $${monthlyAmount!.toFixed(2)}/mo × ${remainingMonths} mo (fee $${discountedAmount.toFixed(2)}, was $${previousTotal.toFixed(2)}).`
      : input.note?.trim()
        ? `Financial assistance: fee set to $${discountedAmount.toFixed(2)} (was $${previousTotal.toFixed(2)}). ${input.note.trim()}`
        : `Financial assistance: fee set to $${discountedAmount.toFixed(2)} (was $${previousTotal.toFixed(2)}).`

    let chargeId = (enrollment.charge_id as string | null) || null
    if (!chargeId) {
      const { data: chargeRow } = await supabase
        .from("program_charges")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("enrollment_id", enrollmentId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      chargeId = (chargeRow?.id as string | undefined) || null
    }

    if (chargeId) {
      const { data: existingLines } = await supabase
        .from("program_charge_lines")
        .select("id, line_type, amount, metadata")
        .eq("organization_id", organizationId)
        .eq("charge_id", chargeId)

      for (const line of existingLines || []) {
        const meta = (line.metadata || {}) as Record<string, unknown>
        const isFa =
          String(line.line_type || "").toLowerCase() === "financial_assistance" ||
          meta.source === "financial_assistance"
        const isVoided = String(meta.status || "") === "voided"
        if (!isFa || isVoided) continue

        const { error: voidError } = await supabase.rpc("void_program_charge_line", {
          p_organization_id: organizationId,
          p_line_id: line.id,
          p_reason: "Replaced by updated financial assistance",
        })
        if (voidError) {
          await supabase
            .from("program_charge_lines")
            .update({
              amount: 0,
              unit_amount: 0,
              quantity: 0,
              metadata: {
                ...meta,
                status: "voided",
                void_reason: "Replaced by updated financial assistance",
              },
            })
            .eq("id", line.id)
            .eq("organization_id", organizationId)

          const { data: activeLines } = await supabase
            .from("program_charge_lines")
            .select("amount, metadata")
            .eq("organization_id", organizationId)
            .eq("charge_id", chargeId)

          const recomputedTotal = (activeLines || []).reduce((sum, row) => {
            const rowMeta = (row.metadata || {}) as Record<string, unknown>
            if (String(rowMeta.status || "") === "voided") return sum
            return sum + Number(row.amount || 0)
          }, 0)

          await supabase
            .from("program_charges")
            .update({
              total: Math.max(recomputedTotal, 0),
              updated_at: new Date().toISOString(),
            })
            .eq("id", chargeId)
            .eq("organization_id", organizationId)
        }
      }

      const { data: chargeAfterVoid } = await supabase
        .from("program_charges")
        .select("id, total")
        .eq("id", chargeId)
        .eq("organization_id", organizationId)
        .maybeSingle()

      const baseTotal = Number(chargeAfterVoid?.total ?? previousTotal)
      const reduction =
        Math.round(Math.max(0, baseTotal - discountedAmount) * 100) / 100

      if (reduction > 0.009) {
        const { error: lineError } = await supabase.rpc("add_program_charge_line", {
          p_organization_id: organizationId,
          p_charge_id: chargeId,
          p_line_type: "financial_assistance",
          p_label: "Financial assistance",
          p_unit_amount: -reduction,
          p_quantity: 1,
          p_reason: input.note?.trim() || "Financial assistance discount",
        })

        if (lineError) {
          await supabase.from("program_charge_lines").insert({
            organization_id: organizationId,
            charge_id: chargeId,
            line_type: "financial_assistance",
            label: "Financial assistance",
            quantity: 1,
            unit_amount: -reduction,
            amount: -reduction,
            sort_order: 100,
            metadata: {
              status: "active",
              is_discount: true,
              source: "financial_assistance",
              add_reason: input.note?.trim() || "Financial assistance discount",
            },
          })

          await supabase
            .from("program_charges")
            .update({
              total: discountedAmount,
              discount_total: reduction,
              due_today: Math.max(discountedAmount - amountPaid, 0),
              charge_status: resolveChargeStatus(discountedAmount, amountPaid),
              updated_at: new Date().toISOString(),
            })
            .eq("id", chargeId)
            .eq("organization_id", organizationId)
        }
      } else {
        await supabase
          .from("program_charges")
          .update({
            total: discountedAmount,
            due_today: Math.max(discountedAmount - amountPaid, 0),
            charge_status: resolveChargeStatus(discountedAmount, amountPaid),
            updated_at: new Date().toISOString(),
          })
          .eq("id", chargeId)
          .eq("organization_id", organizationId)
      }

      const remaining = Math.max(discountedAmount - amountPaid, 0)
      const { data: openSchedules } = await supabase
        .from("program_charge_schedule")
        .select("id, due_date, amount")
        .eq("organization_id", organizationId)
        .eq("charge_id", chargeId)
        .in("status", ["scheduled", "due", "past_due", "adjusted"])
        .order("due_date", { ascending: true })

      if (hasMonthly && monthlyAmount != null && remainingMonths != null) {
        const openIds = (openSchedules || []).map((row) => row.id as string)
        if (openIds.length > 0) {
          await supabase
            .from("program_charge_schedule")
            .update({ status: "void" })
            .eq("organization_id", organizationId)
            .in("id", openIds)
        }

        const firstDue =
          openSchedules?.[0]?.due_date ||
          new Date().toISOString().slice(0, 10)
        const start = new Date(`${String(firstDue).slice(0, 10)}T00:00:00`)
        const scheduleRows = Array.from({ length: remainingMonths }, (_, index) => {
          const due = new Date(start)
          due.setMonth(due.getMonth() + index)
          const y = due.getFullYear()
          const m = String(due.getMonth() + 1).padStart(2, "0")
          const d = String(due.getDate()).padStart(2, "0")
          return {
            organization_id: organizationId,
            charge_id: chargeId,
            schedule_type: "custom",
            label: `Assisted monthly ${index + 1} of ${remainingMonths}`,
            amount: monthlyAmount,
            due_date: `${y}-${m}-${d}`,
            sequence_number: index + 1,
            status: "scheduled",
            charge_category: "tuition",
            metadata: { source: "financial_assistance" },
          }
        })
        if (scheduleRows.length > 0) {
          await supabase.from("program_charge_schedule").insert(scheduleRows)
        }
      } else if (openSchedules && openSchedules.length === 1) {
        await supabase
          .from("program_charge_schedule")
          .update({ amount: remaining })
          .eq("id", openSchedules[0].id)
          .eq("organization_id", organizationId)
      }
    }

    if (hasMonthly && monthlyAmount != null && remainingMonths != null) {
      await supabase
        .from("program_payment_plans")
        .delete()
        .eq("organization_id", organizationId)
        .eq("enrollment_id", enrollmentId)
        .neq("status", "paid")

      const start = new Date()
      const planRows = Array.from({ length: remainingMonths }, (_, index) => {
        const due = new Date(start)
        due.setMonth(due.getMonth() + index)
        const y = due.getFullYear()
        const m = String(due.getMonth() + 1).padStart(2, "0")
        const d = String(due.getDate()).padStart(2, "0")
        return {
          organization_id: organizationId,
          enrollment_id: enrollmentId,
          installment_amount: monthlyAmount,
          due_date: `${y}-${m}-${d}`,
          status: "scheduled",
        }
      })
      if (planRows.length > 0) {
        await supabase.from("program_payment_plans").insert(planRows)
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("program_enrollments")
      .update({
        total_amount: discountedAmount,
        payment_status: resolvePaymentStatus(discountedAmount, amountPaid),
        notes: appendNote(enrollment.notes as string | null, faNote),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)
      .select("id, total_amount")
      .maybeSingle()

    if (updateError) {
      return { success: false, error: updateError.message }
    }
    if (!updated) {
      return {
        success: false,
        error: "Could not update enrollment fee. Check permissions and try again.",
      }
    }

    await recordEnrollmentFaAward({
      organizationId,
      enrollmentId,
      programId: enrollment.program_id as string | null,
      offeringId: enrollment.offering_id as string | null,
      participantContactId: enrollment.participant_contact_id as string | null,
      participantName: enrollment.child_name as string | null,
      originalAmount: previousTotal,
      assistedAmount: discountedAmount,
      planType: hasMonthly ? "monthly" : "total_fee",
      monthlyAmount,
      remainingMonths,
      note: input.note?.trim() || null,
    })

    revalidateEnrollmentPaymentPaths(
      enrollmentId,
      enrollment.program_id as string | null
    )
    revalidatePath("/programs/financial-assistance")
    if (enrollment.participant_contact_id) {
      revalidatePath(`/contacts/${enrollment.participant_contact_id}`)
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to apply financial assistance.",
    }
  }
}

export async function createEnrollmentCustomPaymentPlanAction(input: {
  enrollmentId: string
  installmentCount: number
  firstDueDate: string
  note?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const organizationId = await requireOrgId()
    const enrollmentId = String(input.enrollmentId || "").trim()
    const installmentCount = Math.floor(Number(input.installmentCount))
    const firstDueDate = String(input.firstDueDate || "").trim()

    if (!enrollmentId) {
      return { success: false, error: "Missing enrollment." }
    }
    if (!Number.isFinite(installmentCount) || installmentCount < 2 || installmentCount > 24) {
      return {
        success: false,
        error: "Choose between 2 and 24 installments.",
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) {
      return { success: false, error: "Choose a valid first due date." }
    }

    const supabase = await createClient()
    const { data: enrollment, error } = await supabase
      .from("program_enrollments")
      .select("id, program_id, total_amount, amount_paid, notes")
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)
      .maybeSingle()

    if (error || !enrollment) {
      return {
        success: false,
        error: error?.message || "Enrollment not found.",
      }
    }

    const balance = Math.max(
      0,
      Number(enrollment.total_amount || 0) - Number(enrollment.amount_paid || 0)
    )
    if (balance <= 0.009) {
      return { success: false, error: "No outstanding balance to schedule." }
    }

    const base = Math.floor((balance / installmentCount) * 100) / 100
    const amounts = Array.from({ length: installmentCount }, (_, index) =>
      index === installmentCount - 1
        ? Math.round((balance - base * (installmentCount - 1)) * 100) / 100
        : base
    )

    const start = new Date(`${firstDueDate}T00:00:00`)
    const rows = amounts.map((installmentAmount, index) => {
      const due = new Date(start)
      due.setMonth(due.getMonth() + index)
      const y = due.getFullYear()
      const m = String(due.getMonth() + 1).padStart(2, "0")
      const d = String(due.getDate()).padStart(2, "0")
      return {
        organization_id: organizationId,
        enrollment_id: enrollmentId,
        installment_amount: installmentAmount,
        due_date: `${y}-${m}-${d}`,
        status: "scheduled",
      }
    })

    // Replace any existing open plan rows for this enrollment.
    await supabase
      .from("program_payment_plans")
      .delete()
      .eq("organization_id", organizationId)
      .eq("enrollment_id", enrollmentId)
      .neq("status", "paid")

    const { error: insertError } = await supabase
      .from("program_payment_plans")
      .insert(rows)

    if (insertError) {
      return {
        success: false,
        error:
          insertError.message ||
          "Could not create payment plan. Check program_payment_plans schema.",
      }
    }

    const planNote = input.note?.trim()
      ? `Custom payment plan: ${installmentCount} installments starting ${firstDueDate}. ${input.note.trim()}`
      : `Custom payment plan: ${installmentCount} installments starting ${firstDueDate}.`

    await supabase
      .from("program_enrollments")
      .update({
        notes: appendNote(enrollment.notes as string | null, planNote),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)

    revalidateEnrollmentPaymentPaths(
      enrollmentId,
      enrollment.program_id as string | null
    )
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create payment plan.",
    }
  }
}

export async function updateEnrollmentNotesAction(input: {
  enrollmentId: string
  notes: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const organizationId = await requireOrgId()
    const enrollmentId = String(input.enrollmentId || "").trim()
    const notes = String(input.notes || "").trim()

    if (!enrollmentId) {
      return { success: false, error: "Missing enrollment." }
    }

    const supabase = await createClient()
    const { data: enrollment, error } = await supabase
      .from("program_enrollments")
      .select("id, program_id")
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)
      .maybeSingle()

    if (error || !enrollment) {
      return {
        success: false,
        error: error?.message || "Enrollment not found.",
      }
    }

    const { error: updateError } = await supabase
      .from("program_enrollments")
      .update({
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidateEnrollmentPaymentPaths(
      enrollmentId,
      enrollment.program_id as string | null
    )
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save notes.",
    }
  }
}

export type WithdrawSettlementMode =
  | "write_off"
  | "collect"
  | "leave_balance"

/**
 * Mark enrollment withdrawn and settle the account.
 * - write_off: set fee equal to amount already paid (no remaining balance)
 * - collect: record an additional payment, then write off any tiny remainder
 * - leave_balance: withdraw only; payment status/amounts unchanged
 */
export async function withdrawAndSettleEnrollmentAction(input: {
  enrollmentId: string
  reason: string
  settlement: WithdrawSettlementMode
  collectAmount?: number
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const organizationId = await requireOrgId()
    const enrollmentId = String(input.enrollmentId || "").trim()
    const reason = String(input.reason || "").trim()
    const settlement = input.settlement

    if (!enrollmentId) {
      return { success: false, error: "Missing enrollment." }
    }
    if (!reason) {
      return { success: false, error: "Enter a withdrawal reason." }
    }
    if (!["write_off", "collect", "leave_balance"].includes(settlement)) {
      return { success: false, error: "Choose how to settle the account." }
    }

    const supabase = await createClient()
    const { data: enrollment, error } = await supabase
      .from("program_enrollments")
      .select("id, program_id, status, total_amount, amount_paid, notes")
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)
      .maybeSingle()

    if (error || !enrollment) {
      return {
        success: false,
        error: error?.message || "Enrollment not found.",
      }
    }

    const currentStatus = String(enrollment.status || "").toLowerCase()
    if (["withdrawn", "cancelled", "transferred"].includes(currentStatus)) {
      return {
        success: false,
        error: `This enrollment is already ${currentStatus}.`,
      }
    }

    let total = Number(enrollment.total_amount || 0)
    let paid = Number(enrollment.amount_paid || 0)
    let settlementNote = ""

    if (settlement === "collect") {
      const collectAmount = Number(input.collectAmount)
      if (!Number.isFinite(collectAmount) || collectAmount < 0) {
        return { success: false, error: "Enter a valid collection amount." }
      }
      if (collectAmount > 0) {
        paid = paid + collectAmount
        settlementNote = `Collected $${collectAmount.toFixed(2)} on withdrawal.`
      }
      // After collection, close remaining balance by aligning fee to paid.
      total = paid
      settlementNote = settlementNote
        ? `${settlementNote} Remaining balance written off.`
        : "Remaining balance written off on withdrawal."
    } else if (settlement === "write_off") {
      total = paid
      settlementNote =
        paid > 0.009
          ? `Withdrawal settlement: fee reduced to amount paid ($${paid.toFixed(2)}).`
          : "Withdrawal settlement: fee written off (no payments received)."
    } else {
      settlementNote = "Withdrawal: account balance left as-is."
    }

    const withdrawNote = `Withdrawn: ${reason}. ${settlementNote}`

    // Prefer lifecycle override for capacity + history when actor is org admin.
    const { error: overrideError } = await supabase.rpc(
      "admin_override_enrollment_status",
      {
        p_organization_id: organizationId,
        p_enrollment_id: enrollmentId,
        p_target_status: "withdrawn",
        p_reason: reason,
      }
    )

    const settlementPayload = {
      total_amount: total,
      amount_paid: paid,
      payment_status: resolvePaymentStatus(total, paid),
      withdrawn_at: new Date().toISOString(),
      withdraw_reason: reason,
      notes: appendNote(enrollment.notes as string | null, withdrawNote),
      updated_at: new Date().toISOString(),
    }

    if (overrideError) {
      // Non-admin (or override unavailable): withdraw directly.
      console.warn(
        "withdrawAndSettleEnrollmentAction override:",
        overrideError.message
      )
      const { error: updateError } = await supabase
        .from("program_enrollments")
        .update({
          status: "withdrawn",
          ...settlementPayload,
        })
        .eq("organization_id", organizationId)
        .eq("id", enrollmentId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }
    } else {
      const { error: updateError } = await supabase
        .from("program_enrollments")
        .update(settlementPayload)
        .eq("organization_id", organizationId)
        .eq("id", enrollmentId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }
    }

    // Best-effort: void open charge schedule rows when writing off / collecting.
    if (settlement === "write_off" || settlement === "collect") {
      const { data: charges } = await supabase
        .from("program_charges")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("enrollment_id", enrollmentId)

      const chargeIds = (charges || []).map((row) => row.id as string)
      if (chargeIds.length > 0) {
        await supabase
          .from("program_charge_schedule")
          .update({ status: "void" })
          .eq("organization_id", organizationId)
          .in("charge_id", chargeIds)
          .in("status", ["scheduled", "due", "past_due", "adjusted"])

        await supabase
          .from("program_charges")
          .update({
            total,
            amount_paid: paid,
            due_today: Math.max(total - paid, 0),
            charge_status:
              paid <= 0.009
                ? "pending_payment"
                : paid + 0.009 >= total
                  ? "paid"
                  : "partially_paid",
          })
          .eq("organization_id", organizationId)
          .in("id", chargeIds)
      }
    }

    revalidateEnrollmentPaymentPaths(
      enrollmentId,
      enrollment.program_id as string | null
    )
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to withdraw enrollment.",
    }
  }
}

export type EnrollmentPaymentActivityItem = {
  id: string
  kind: "schedule_paid" | "schedule_void" | "enrollment_received"
  label: string
  amount: number
  occurredAt: string | null
  scheduleId: string | null
  detail: string | null
  canCorrect: boolean
}

export type EnrollmentPaymentActivity = {
  enrollmentId: string
  participantName: string
  totalAmount: number
  amountPaid: number
  balance: number
  items: EnrollmentPaymentActivityItem[]
}

async function syncEnrollmentAndChargePaid(input: {
  supabase: Awaited<ReturnType<typeof createClient>>
  organizationId: string
  enrollmentId: string
  nextPaid: number
  notes?: string | null
}) {
  const { data: enrollment } = await input.supabase
    .from("program_enrollments")
    .select("id, total_amount")
    .eq("organization_id", input.organizationId)
    .eq("id", input.enrollmentId)
    .maybeSingle()

  const total = Number(enrollment?.total_amount || 0)
  const nextPaid = Math.max(0, Number(input.nextPaid || 0))

  const enrollmentUpdate: Record<string, unknown> = {
    amount_paid: nextPaid,
    payment_status: resolvePaymentStatus(total, nextPaid),
    updated_at: new Date().toISOString(),
  }
  if (input.notes !== undefined) {
    enrollmentUpdate.notes = input.notes
  }

  await input.supabase
    .from("program_enrollments")
    .update(enrollmentUpdate)
    .eq("organization_id", input.organizationId)
    .eq("id", input.enrollmentId)

  const { data: charges } = await input.supabase
    .from("program_charges")
    .select("id, total")
    .eq("organization_id", input.organizationId)
    .eq("enrollment_id", input.enrollmentId)

  for (const charge of charges || []) {
    const chargeTotal = Number(charge.total || 0)
    await input.supabase
      .from("program_charges")
      .update({
        amount_paid: nextPaid,
        due_today: Math.max(chargeTotal - nextPaid, 0),
        charge_status: resolveChargeStatus(chargeTotal, nextPaid),
        paid_at: nextPaid > 0.009 ? new Date().toISOString() : null,
      })
      .eq("organization_id", input.organizationId)
      .eq("id", charge.id)
  }
}

export async function getEnrollmentPaymentActivityAction(
  enrollmentId: string
): Promise<
  | { success: true; data: EnrollmentPaymentActivity }
  | { success: false; error: string }
> {
  try {
    const organizationId = await requireOrgId()
    const id = String(enrollmentId || "").trim()
    if (!id) {
      return { success: false, error: "Missing enrollment." }
    }

    const supabase = await createClient()
    const { data: enrollment, error } = await supabase
      .from("program_enrollments")
      .select(
        "id, child_name, total_amount, amount_paid, notes, participant_contact:participant_contact_id ( full_name )"
      )
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()

    if (error || !enrollment) {
      return {
        success: false,
        error: error?.message || "Enrollment not found.",
      }
    }

    const contact = enrollment.participant_contact as
      | { full_name?: string | null }
      | { full_name?: string | null }[]
      | null
    const contactRow = Array.isArray(contact) ? contact[0] : contact
    const participantName =
      String(enrollment.child_name || "").trim() ||
      contactRow?.full_name?.trim() ||
      "Participant"

    const totalAmount = Number(enrollment.total_amount || 0)
    const amountPaid = Number(enrollment.amount_paid || 0)
    const items: EnrollmentPaymentActivityItem[] = []

    const { data: charges } = await supabase
      .from("program_charges")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("enrollment_id", id)

    const chargeIds = (charges || []).map((row) => row.id as string)
    if (chargeIds.length > 0) {
      const { data: schedules } = await supabase
        .from("program_charge_schedule")
        .select("id, amount, status, paid_at, due_date, label, updated_at")
        .eq("organization_id", organizationId)
        .in("charge_id", chargeIds)
        .in("status", ["paid", "void"])
        .order("paid_at", { ascending: false })
        .limit(40)

      for (const schedule of schedules || []) {
        const status = String(schedule.status || "").toLowerCase()
        const amount = Number(schedule.amount || 0)
        const isVoid = status === "void"
        items.push({
          id: `schedule:${schedule.id}`,
          kind: isVoid ? "schedule_void" : "schedule_paid",
          label: isVoid
            ? schedule.label
              ? `Voided · ${schedule.label}`
              : "Voided payment"
            : schedule.label
              ? `Payment · ${schedule.label}`
              : "Payment applied",
          amount,
          occurredAt:
            (schedule.paid_at as string | null) ||
            (schedule.updated_at as string | null) ||
            null,
          scheduleId: schedule.id as string,
          detail: schedule.due_date
            ? `Due ${String(schedule.due_date).slice(0, 10)}`
            : null,
          canCorrect: !isVoid && amount > 0.009,
        })
      }
    }

    const notes = String(enrollment.notes || "")
    const noteLines = notes
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
    const paymentNoteRegex =
      /^Payment received \$([0-9]+(?:\.[0-9]+)?)\s*(?::\s*(.*))?$/i
    for (const line of noteLines.slice().reverse()) {
      const match = line.match(paymentNoteRegex)
      if (!match) continue
      const amount = Number(match[1])
      if (!Number.isFinite(amount) || amount <= 0) continue
      items.push({
        id: `note:${line}`,
        kind: "enrollment_received",
        label: "Payment received (from notes)",
        amount,
        occurredAt: null,
        scheduleId: null,
        detail: match[2]?.trim() || null,
        canCorrect: amountPaid > 0.009,
      })
    }

    const scheduleAmounts = new Set(
      items
        .filter((item) => item.kind === "schedule_paid" && item.canCorrect)
        .map((item) => item.amount.toFixed(2))
    )
    const deduped = items.filter((item) => {
      if (item.kind !== "enrollment_received") return true
      if (scheduleAmounts.has(item.amount.toFixed(2))) return false
      return true
    })

    const hasCorrectable = deduped.some((item) => item.canCorrect)
    if (amountPaid > 0.009 && !hasCorrectable) {
      deduped.unshift({
        id: "balance:received",
        kind: "enrollment_received",
        label: "Recorded received amount",
        amount: amountPaid,
        occurredAt: null,
        scheduleId: null,
        detail: "No installment match — void this total to reopen the balance",
        canCorrect: true,
      })
    }

    return {
      success: true,
      data: {
        enrollmentId: id,
        participantName,
        totalAmount,
        amountPaid,
        balance: Math.max(0, totalAmount - amountPaid),
        items: deduped.slice(0, 30),
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load payment activity.",
    }
  }
}

/**
 * Permanently void a mistaken payment application.
 * Restores enrollment/charge balances and keeps a void ledger row for reports.
 */
export async function voidEnrollmentPaymentAction(input: {
  enrollmentId: string
  amount: number
  scheduleId?: string | null
  note?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const organizationId = await requireOrgId()
    const enrollmentId = String(input.enrollmentId || "").trim()
    const amount = Number(input.amount)
    const scheduleId = String(input.scheduleId || "").trim() || null
    const note = String(input.note || "").trim()

    if (!enrollmentId) {
      return { success: false, error: "Missing enrollment." }
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: "Enter an amount greater than zero." }
    }

    const supabase = await createClient()
    const { data: enrollment, error } = await supabase
      .from("program_enrollments")
      .select("id, program_id, total_amount, amount_paid, notes, participant_contact_id")
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)
      .maybeSingle()

    if (error || !enrollment) {
      return {
        success: false,
        error: error?.message || "Enrollment not found.",
      }
    }

    const previouslyPaid = Number(enrollment.amount_paid || 0)
    if (amount - 0.009 > previouslyPaid) {
      return {
        success: false,
        error: `Cannot void more than received (${previouslyPaid.toFixed(2)}).`,
      }
    }

    const { data: charges } = await supabase
      .from("program_charges")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("enrollment_id", enrollmentId)

    const chargeIds = (charges || []).map((row) => row.id as string)
    const primaryChargeId = chargeIds[0] || null

    type ScheduleRow = {
      id: string
      amount: number | null
      status: string | null
      paid_at: string | null
      due_date: string | null
      label: string | null
      schedule_type: string | null
      sequence_number: number | null
      charge_id: string
      metadata: Record<string, unknown> | null
      charge_category?: string | null
    }

    let matched: ScheduleRow | null = null

    if (scheduleId) {
      const { data: schedule, error: scheduleError } = await supabase
        .from("program_charge_schedule")
        .select(
          "id, amount, status, paid_at, due_date, label, schedule_type, sequence_number, charge_id, metadata, charge_category"
        )
        .eq("organization_id", organizationId)
        .eq("id", scheduleId)
        .maybeSingle()

      if (scheduleError || !schedule) {
        return {
          success: false,
          error: scheduleError?.message || "Payment not found.",
        }
      }
      if (!chargeIds.includes(schedule.charge_id as string)) {
        return {
          success: false,
          error: "That payment does not belong to this enrollment.",
        }
      }
      if (String(schedule.status || "").toLowerCase() !== "paid") {
        return {
          success: false,
          error: "Only paid payments can be voided.",
        }
      }
      if (Math.abs(Number(schedule.amount || 0) - amount) > 0.01) {
        return {
          success: false,
          error: "Amount does not match the selected payment.",
        }
      }
      matched = schedule as ScheduleRow
    } else if (chargeIds.length > 0) {
      const { data: paidSchedules } = await supabase
        .from("program_charge_schedule")
        .select(
          "id, amount, status, paid_at, due_date, label, schedule_type, sequence_number, charge_id, metadata, charge_category"
        )
        .eq("organization_id", organizationId)
        .in("charge_id", chargeIds)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(20)

      matched =
        ((paidSchedules || []).find(
          (row) => Math.abs(Number(row.amount || 0) - amount) < 0.01
        ) as ScheduleRow | undefined) || null
    }

    const voidedAt = new Date().toISOString()
    const voidMeta = {
      amount,
      reason: note || "Payment correction",
      voided_at: voidedAt,
      source: "edit_payments",
    }

    if (matched) {
      const priorMeta =
        (matched.metadata as Record<string, unknown> | null) || {}
      const { error: voidError } = await supabase
        .from("program_charge_schedule")
        .update({
          status: "void",
          metadata: {
            ...priorMeta,
            void: {
              ...voidMeta,
              prior_status: "paid",
              prior_paid_at: matched.paid_at,
            },
          },
          updated_at: voidedAt,
        })
        .eq("organization_id", organizationId)
        .eq("id", matched.id)

      if (voidError) {
        return { success: false, error: voidError.message }
      }

      // Reopen an installment so staff can collect the correct payment later.
      const { error: reopenError } = await supabase
        .from("program_charge_schedule")
        .insert({
          organization_id: organizationId,
          charge_id: matched.charge_id,
          schedule_type: matched.schedule_type || "installment",
          label: matched.label || "Payment due",
          amount: Number(matched.amount || amount),
          due_date: matched.due_date,
          sequence_number: Number(matched.sequence_number || 0),
          status: "scheduled",
          charge_category: matched.charge_category || "tuition",
          metadata: {
            source: "void_reopen",
            voided_schedule_id: matched.id,
          },
        })

      if (reopenError) {
        console.warn("voidEnrollmentPaymentAction reopen:", reopenError.message)
      }
    } else if (primaryChargeId) {
      // No paid schedule row — still leave a void ledger entry for reports.
      const { data: existing } = await supabase
        .from("program_charge_schedule")
        .select("sequence_number")
        .eq("organization_id", organizationId)
        .eq("charge_id", primaryChargeId)
        .order("sequence_number", { ascending: false })
        .limit(1)

      const nextSeq = Number(existing?.[0]?.sequence_number || 0) + 1
      const { error: auditError } = await supabase
        .from("program_charge_schedule")
        .insert({
          organization_id: organizationId,
          charge_id: primaryChargeId,
          schedule_type: "custom",
          label: "Voided payment",
          amount,
          due_date: voidedAt.slice(0, 10),
          sequence_number: nextSeq,
          status: "void",
          paid_at: voidedAt,
          charge_category: "adjustment",
          metadata: { void: voidMeta },
        })

      if (auditError) {
        console.warn("voidEnrollmentPaymentAction audit:", auditError.message)
      }
    }

    const nextPaid = Math.max(0, previouslyPaid - amount)
    const voidNote = note
      ? `Payment voided $${amount.toFixed(2)}: ${note}`
      : `Payment voided $${amount.toFixed(2)}`

    await syncEnrollmentAndChargePaid({
      supabase,
      organizationId,
      enrollmentId,
      nextPaid,
      notes: appendNote(enrollment.notes as string | null, voidNote),
    })

    revalidateEnrollmentPaymentPaths(
      enrollmentId,
      enrollment.program_id as string | null
    )
    revalidatePath("/reports")
    revalidatePath("/programs/reports")
    if (enrollment.participant_contact_id) {
      revalidatePath(`/contacts/${enrollment.participant_contact_id}`)
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to void payment.",
    }
  }
}
