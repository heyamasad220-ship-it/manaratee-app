"use server"

import { revalidatePath } from "next/cache"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  formatFaAwardPlanLabel,
  type FaAwardPlanType,
  type ProgramFaAwardRow,
} from "@/lib/programs/fa-awards-format"
import { createClient } from "@/lib/supabase/server"

export type ContactFaAwardSummary = {
  enrollmentId: string
  originalAmount: number
  assistedAmount: number
  discountAmount: number
  planType: FaAwardPlanType
  monthlyAmount: number | null
  remainingMonths: number | null
  planLabel: string
  note: string | null
  appliedAt: string
}

function mapAwardRow(row: Record<string, unknown>): ProgramFaAwardRow {
  const program = row.program as
    | { name?: string | null }
    | { name?: string | null }[]
    | null
  const offering = row.offering as
    | { name?: string | null }
    | { name?: string | null }[]
    | null
  const programRow = Array.isArray(program) ? program[0] : program
  const offeringRow = Array.isArray(offering) ? offering[0] : offering
  const planType =
    String(row.plan_type || "total_fee") === "monthly" ? "monthly" : "total_fee"
  const originalAmount = Number(row.original_amount || 0)
  const assistedAmount = Number(row.assisted_amount || 0)
  const monthlyAmount =
    row.monthly_amount == null ? null : Number(row.monthly_amount)
  const remainingMonths =
    row.remaining_months == null ? null : Number(row.remaining_months)

  return {
    id: row.id as string,
    enrollmentId: row.enrollment_id as string,
    programId: (row.program_id as string | null) || null,
    offeringId: (row.offering_id as string | null) || null,
    participantContactId: (row.participant_contact_id as string | null) || null,
    participantName:
      String(row.participant_name || "").trim() || "Participant",
    programName: programRow?.name?.trim() || "Program",
    offeringName: offeringRow?.name?.trim() || null,
    originalAmount,
    assistedAmount,
    discountAmount: Number(row.discount_amount || 0),
    planType,
    monthlyAmount,
    remainingMonths,
    note: (row.note as string | null) || null,
    status: String(row.status || "active") === "superseded" ? "superseded" : "active",
    appliedAt: (row.applied_at as string) || (row.created_at as string) || "",
  }
}

export async function recordEnrollmentFaAward(input: {
  organizationId: string
  enrollmentId: string
  programId?: string | null
  offeringId?: string | null
  participantContactId?: string | null
  participantName?: string | null
  originalAmount: number
  assistedAmount: number
  planType: FaAwardPlanType
  monthlyAmount?: number | null
  remainingMonths?: number | null
  note?: string | null
}): Promise<void> {
  const supabase = await createClient()
  const originalAmount = Math.round(Number(input.originalAmount) * 100) / 100
  const assistedAmount = Math.round(Number(input.assistedAmount) * 100) / 100
  const discountAmount =
    Math.round(Math.max(0, originalAmount - assistedAmount) * 100) / 100

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase
    .from("program_enrollment_fa_awards")
    .update({
      status: "superseded",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("enrollment_id", input.enrollmentId)
    .eq("status", "active")

  const { error } = await supabase.from("program_enrollment_fa_awards").insert({
    organization_id: input.organizationId,
    enrollment_id: input.enrollmentId,
    program_id: input.programId || null,
    offering_id: input.offeringId || null,
    participant_contact_id: input.participantContactId || null,
    participant_name: input.participantName?.trim() || null,
    original_amount: originalAmount,
    assisted_amount: assistedAmount,
    discount_amount: discountAmount,
    plan_type: input.planType,
    monthly_amount: input.monthlyAmount ?? null,
    remaining_months: input.remainingMonths ?? null,
    note: input.note?.trim() || null,
    status: "active",
    applied_at: new Date().toISOString(),
    applied_by: user?.id || null,
  })

  if (error) {
    // Table may not exist until script 185 is run — do not fail the fee update.
    console.warn("recordEnrollmentFaAward:", error.message)
  }
}

function resolvePaymentStatus(total: number, paid: number) {
  if (total <= 0.009) return "paid"
  if (paid <= 0.009) return "pending"
  if (paid + 0.009 >= total) return "paid"
  return "partial"
}

function resolveChargeStatus(total: number, paid: number) {
  if (total <= 0.009) return "pending_payment"
  if (paid <= 0.009) return "pending_payment"
  if (paid + 0.009 >= total) return "paid"
  return "partially_paid"
}

function appendNote(existing: string | null | undefined, addition: string) {
  const next = addition.trim()
  if (!next) return existing?.trim() || null
  const prior = (existing || "").trim()
  if (!prior) return next
  return `${prior}\n\n${next}`
}

/**
 * Remove an active FA award and restore the enrollment fee to the original amount.
 */
export async function removeEnrollmentFaAwardAction(input: {
  awardId: string
  note?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const awardId = String(input.awardId || "").trim()
    if (!awardId) {
      return { success: false, error: "Missing financial assistance award." }
    }

    const supabase = await createClient()
    const { data: award, error: awardError } = await supabase
      .from("program_enrollment_fa_awards")
      .select(
        "id, enrollment_id, original_amount, assisted_amount, status, participant_contact_id, program_id"
      )
      .eq("organization_id", organizationId)
      .eq("id", awardId)
      .maybeSingle()

    if (awardError || !award) {
      return {
        success: false,
        error: awardError?.message || "Financial assistance award not found.",
      }
    }

    if (String(award.status || "") !== "active") {
      return {
        success: false,
        error: "That financial assistance award is no longer active.",
      }
    }

    const enrollmentId = award.enrollment_id as string
    const originalAmount = Math.round(Number(award.original_amount || 0) * 100) / 100
    const assistedAmount = Math.round(Number(award.assisted_amount || 0) * 100) / 100

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("program_enrollments")
      .select("id, program_id, total_amount, amount_paid, notes, charge_id")
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)
      .maybeSingle()

    if (enrollmentError || !enrollment) {
      return {
        success: false,
        error: enrollmentError?.message || "Enrollment not found.",
      }
    }

    const amountPaid = Number(enrollment.amount_paid || 0)
    const restoredFee = Math.max(originalAmount, amountPaid)
    const removeNote = input.note?.trim()
      ? `Financial assistance removed: fee restored to $${restoredFee.toFixed(2)} (was assisted $${assistedAmount.toFixed(2)}). ${input.note.trim()}`
      : `Financial assistance removed: fee restored to $${restoredFee.toFixed(2)} (was assisted $${assistedAmount.toFixed(2)}).`

    const { error: enrollmentUpdateError } = await supabase
      .from("program_enrollments")
      .update({
        total_amount: restoredFee,
        payment_status: resolvePaymentStatus(restoredFee, amountPaid),
        notes: appendNote(enrollment.notes as string | null, removeNote),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", enrollmentId)

    if (enrollmentUpdateError) {
      return { success: false, error: enrollmentUpdateError.message }
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
      const { data: existingLines } = await supabase
        .from("program_charge_lines")
        .select("id, line_type, metadata")
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
          p_reason: "Financial assistance removed",
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
                void_reason: "Financial assistance removed",
              },
            })
            .eq("id", line.id)
            .eq("organization_id", organizationId)
        }
      }

      await supabase
        .from("program_charges")
        .update({
          total: restoredFee,
          discount_total: 0,
          due_today: Math.max(restoredFee - amountPaid, 0),
          charge_status: resolveChargeStatus(restoredFee, amountPaid),
          paid_at: amountPaid > 0.009 ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .eq("id", chargeId)

      const { data: openSchedules } = await supabase
        .from("program_charge_schedule")
        .select("id, label, metadata, status")
        .eq("organization_id", organizationId)
        .eq("charge_id", chargeId)
        .in("status", ["scheduled", "due", "past_due", "adjusted"])

      const faScheduleIds = (openSchedules || [])
        .filter((row) => {
          const meta = (row.metadata || {}) as Record<string, unknown>
          const label = String(row.label || "")
          return (
            meta.source === "financial_assistance" ||
            /^Assisted monthly/i.test(label)
          )
        })
        .map((row) => row.id as string)

      if (faScheduleIds.length > 0) {
        await supabase
          .from("program_charge_schedule")
          .update({ status: "void" })
          .eq("organization_id", organizationId)
          .in("id", faScheduleIds)
      }

      const remaining = Math.max(restoredFee - amountPaid, 0)
      const { data: stillOpen } = await supabase
        .from("program_charge_schedule")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("charge_id", chargeId)
        .in("status", ["scheduled", "due", "past_due", "adjusted"])
        .limit(5)

      if (remaining > 0.009 && (stillOpen || []).length === 0) {
        await supabase.from("program_charge_schedule").insert({
          organization_id: organizationId,
          charge_id: chargeId,
          schedule_type: "custom",
          label: "Balance due",
          amount: remaining,
          due_date: new Date().toISOString().slice(0, 10),
          sequence_number: 1,
          status: "scheduled",
          charge_category: "tuition",
          metadata: { source: "fa_removal_reopen" },
        })
      } else if (remaining > 0.009 && (stillOpen || []).length === 1) {
        await supabase
          .from("program_charge_schedule")
          .update({ amount: remaining })
          .eq("organization_id", organizationId)
          .eq("id", stillOpen![0].id)
      }
    }

    await supabase
      .from("program_payment_plans")
      .delete()
      .eq("organization_id", organizationId)
      .eq("enrollment_id", enrollmentId)
      .neq("status", "paid")

    const { error: awardUpdateError } = await supabase
      .from("program_enrollment_fa_awards")
      .update({
        status: "superseded",
        note: appendNote(
          null,
          input.note?.trim()
            ? `Removed: ${input.note.trim()}`
            : "Removed (applied in error)"
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", awardId)

    if (awardUpdateError) {
      return { success: false, error: awardUpdateError.message }
    }

    revalidatePath("/programs/registrations")
    revalidatePath(`/programs/registrations/${enrollmentId}`)
    revalidatePath("/finance/financial-assistance")
    revalidatePath("/programs/financial-assistance")
    revalidatePath("/programs/reports")
    const programId =
      (enrollment.program_id as string | null) ||
      (award.program_id as string | null)
    if (programId) {
      revalidatePath(`/programs/${programId}`)
      revalidatePath(`/programs/${programId}/billing`)
    }
    if (award.participant_contact_id) {
      revalidatePath(`/contacts/${award.participant_contact_id}`)
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to remove financial assistance.",
    }
  }
}

type ParsedFaNote = {
  planType: FaAwardPlanType
  monthlyAmount: number | null
  remainingMonths: number | null
  assistedAmount: number
  originalAmount: number
  note: string | null
}

function parseFaNoteBlock(notes: string | null | undefined): ParsedFaNote | null {
  const text = String(notes || "")
  if (!text) return null

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  let lastApplyIndex = -1
  let lastRemoveIndex = -1
  let latest = ""

  lines.forEach((line, index) => {
    if (/^Financial assistance removed/i.test(line)) {
      lastRemoveIndex = index
      return
    }
    if (/^Financial assistance:/i.test(line)) {
      lastApplyIndex = index
      latest = line
    }
  })

  // Removal after the latest apply — do not re-import.
  if (lastApplyIndex < 0 || lastRemoveIndex > lastApplyIndex) return null

  const monthlyMatch = latest.match(
    /Financial assistance:\s*\$([0-9]+(?:\.[0-9]+)?)\s*\/mo\s*[×x]\s*(\d+)\s*mo\s*\(fee\s*\$([0-9]+(?:\.[0-9]+)?),\s*was\s*\$([0-9]+(?:\.[0-9]+)?)\)(?:\.\s*(.*))?$/i
  )
  if (monthlyMatch) {
    const rest = monthlyMatch[5]?.trim() || null
    return {
      planType: "monthly",
      monthlyAmount: Number(monthlyMatch[1]),
      remainingMonths: Number(monthlyMatch[2]),
      assistedAmount: Number(monthlyMatch[3]),
      originalAmount: Number(monthlyMatch[4]),
      note: rest,
    }
  }

  const totalMatch = latest.match(
    /Financial assistance:\s*fee set to\s*\$([0-9]+(?:\.[0-9]+)?)\s*\(was\s*\$([0-9]+(?:\.[0-9]+)?)\)(?:\.\s*(.*))?$/i
  )
  if (totalMatch) {
    const rest = totalMatch[3]?.trim() || null
    return {
      planType: "total_fee",
      monthlyAmount: null,
      remainingMonths: null,
      assistedAmount: Number(totalMatch[1]),
      originalAmount: Number(totalMatch[2]),
      note: rest,
    }
  }

  return null
}

/**
 * Import historical FA from enrollment notes + active FA charge lines.
 * Idempotent: skips enrollments that already have any award row (active or
 * superseded). Otherwise Remove would reappear after refresh from old notes.
 * Re-apply FA via Mark financial assistance (writes a new active award).
 */
export async function backfillEnrollmentFaAwardsAction(): Promise<
  | { success: true; imported: number; skipped: number }
  | { success: false; error: string }
> {
  try {
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from("program_enrollment_fa_awards")
      .select("enrollment_id")
      .eq("organization_id", organizationId)

    if (existingError) {
      return {
        success: false,
        error:
          existingError.message.includes("program_enrollment_fa_awards") ||
          existingError.message.toLowerCase().includes("does not exist")
            ? "Run scripts/185_program_enrollment_fa_awards.sql in Supabase first."
            : existingError.message,
      }
    }

    const alreadyAwarded = new Set(
      (existing || []).map((row) => row.enrollment_id as string)
    )

    // If staff removed FA, notes still contain the old apply line. A prior bug
    // re-imported those as active awards — supersede them when removal is latest.
    const { data: removedNoted } = await supabase
      .from("program_enrollments")
      .select("id, notes")
      .eq("organization_id", organizationId)
      .ilike("notes", "%Financial assistance removed%")
      .limit(1000)

    const enrollmentsToSupersede = (removedNoted || [])
      .filter((row) => parseFaNoteBlock(row.notes as string | null) === null)
      .map((row) => row.id as string)

    if (enrollmentsToSupersede.length > 0) {
      await supabase
        .from("program_enrollment_fa_awards")
        .update({
          status: "superseded",
          note: "Superseded: financial assistance was removed",
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .in("enrollment_id", enrollmentsToSupersede)

      for (const enrollmentId of enrollmentsToSupersede) {
        alreadyAwarded.add(enrollmentId)
      }
    }

    const { data: notedEnrollments, error: notesError } = await supabase
      .from("program_enrollments")
      .select(
        `
        id,
        program_id,
        offering_id,
        participant_contact_id,
        child_name,
        total_amount,
        notes,
        updated_at,
        created_at
      `
      )
      .eq("organization_id", organizationId)
      .ilike("notes", "%Financial assistance%")
      .limit(1000)

    if (notesError) {
      return { success: false, error: notesError.message }
    }

    let imported = 0
    let skipped = 0
    const covered = new Set<string>()

    for (const enrollment of notedEnrollments || []) {
      const enrollmentId = enrollment.id as string
      if (alreadyAwarded.has(enrollmentId)) {
        skipped += 1
        covered.add(enrollmentId)
        continue
      }

      const parsed = parseFaNoteBlock(enrollment.notes as string | null)
      if (!parsed) {
        skipped += 1
        continue
      }

      const originalAmount = parsed.originalAmount
      const assistedAmount = parsed.assistedAmount
      if (
        !Number.isFinite(originalAmount) ||
        !Number.isFinite(assistedAmount) ||
        originalAmount + 0.009 < assistedAmount
      ) {
        skipped += 1
        continue
      }

      const { error: insertError } = await supabase
        .from("program_enrollment_fa_awards")
        .insert({
          organization_id: organizationId,
          enrollment_id: enrollmentId,
          program_id: enrollment.program_id || null,
          offering_id: enrollment.offering_id || null,
          participant_contact_id: enrollment.participant_contact_id || null,
          participant_name:
            String(enrollment.child_name || "").trim() || null,
          original_amount: originalAmount,
          assisted_amount: assistedAmount,
          discount_amount: Math.max(0, originalAmount - assistedAmount),
          plan_type: parsed.planType,
          monthly_amount: parsed.monthlyAmount,
          remaining_months: parsed.remainingMonths,
          note: parsed.note || "Imported from enrollment notes",
          status: "active",
          applied_at:
            (enrollment.updated_at as string) ||
            (enrollment.created_at as string) ||
            new Date().toISOString(),
        })

      if (insertError) {
        console.warn("backfill FA note:", insertError.message)
        skipped += 1
        continue
      }

      imported += 1
      covered.add(enrollmentId)
      alreadyAwarded.add(enrollmentId)
    }

    // Charge-line fallback for FA discounts that never wrote the note pattern.
    const { data: faLines } = await supabase
      .from("program_charge_lines")
      .select(
        `
        id,
        amount,
        metadata,
        created_at,
        charge:charge_id (
          id,
          total,
          enrollment_id,
          enrollment:enrollment_id (
            id,
            program_id,
            offering_id,
            participant_contact_id,
            child_name,
            total_amount
          )
        )
      `
      )
      .eq("organization_id", organizationId)
      .eq("line_type", "financial_assistance")
      .limit(1000)

    for (const line of faLines || []) {
      const meta = (line.metadata || {}) as Record<string, unknown>
      if (String(meta.status || "") === "voided") continue

      const charge = line.charge as
        | {
            total?: number | null
            enrollment_id?: string | null
            enrollment?: Record<string, unknown> | Record<string, unknown>[] | null
          }
        | {
            total?: number | null
            enrollment_id?: string | null
            enrollment?: Record<string, unknown> | Record<string, unknown>[] | null
          }[]
        | null
      const chargeRow = Array.isArray(charge) ? charge[0] : charge
      const enrollmentRaw = chargeRow?.enrollment
      const enrollment = Array.isArray(enrollmentRaw)
        ? enrollmentRaw[0]
        : enrollmentRaw
      const enrollmentId =
        (enrollment?.id as string | undefined) ||
        (chargeRow?.enrollment_id as string | undefined) ||
        null
      if (!enrollmentId || alreadyAwarded.has(enrollmentId)) {
        if (enrollmentId) skipped += 1
        continue
      }

      const reduction = Math.abs(Number(line.amount || 0))
      if (reduction <= 0.009) continue

      const assistedAmount = Number(
        chargeRow?.total ?? enrollment?.total_amount ?? 0
      )
      const originalAmount = assistedAmount + reduction

      const { error: insertError } = await supabase
        .from("program_enrollment_fa_awards")
        .insert({
          organization_id: organizationId,
          enrollment_id: enrollmentId,
          program_id: (enrollment?.program_id as string | null) || null,
          offering_id: (enrollment?.offering_id as string | null) || null,
          participant_contact_id:
            (enrollment?.participant_contact_id as string | null) || null,
          participant_name:
            String(enrollment?.child_name || "").trim() || null,
          original_amount: originalAmount,
          assisted_amount: assistedAmount,
          discount_amount: reduction,
          plan_type: "total_fee",
          monthly_amount: null,
          remaining_months: null,
          note:
            String(meta.add_reason || "").trim() ||
            "Imported from charge ledger",
          status: "active",
          applied_at: (line.created_at as string) || new Date().toISOString(),
        })

      if (insertError) {
        console.warn("backfill FA line:", insertError.message)
        skipped += 1
        continue
      }

      imported += 1
      alreadyAwarded.add(enrollmentId)
    }

    return { success: true, imported, skipped }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to import past financial assistance.",
    }
  }
}

export async function getProgramFaAwardsReport(filters?: {
  activeOnly?: boolean
  limit?: number
}): Promise<ProgramFaAwardRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()
  let query = supabase
    .from("program_enrollment_fa_awards")
    .select(
      `
      id,
      enrollment_id,
      program_id,
      offering_id,
      participant_contact_id,
      participant_name,
      original_amount,
      assisted_amount,
      discount_amount,
      plan_type,
      monthly_amount,
      remaining_months,
      note,
      status,
      applied_at,
      created_at,
      program:program_id ( name ),
      offering:offering_id ( name )
    `
    )
    .eq("organization_id", organizationId)
    .order("applied_at", { ascending: false })
    .limit(filters?.limit ?? 300)

  if (filters?.activeOnly !== false) {
    query = query.eq("status", "active")
  }

  const { data, error } = await query
  if (error) {
    console.warn("getProgramFaAwardsReport:", error.message)
    return []
  }

  return (data || []).map((row) => mapAwardRow(row as Record<string, unknown>))
}

export async function fetchProgramFaAwardsReportAction(filters?: {
  activeOnly?: boolean
  limit?: number
  /** When true (default), import historical FA from notes/charge lines first. */
  backfill?: boolean
}) {
  try {
    let backfillError: string | null = null
    if (filters?.backfill !== false) {
      const backfill = await backfillEnrollmentFaAwardsAction()
      if (!backfill.success) {
        backfillError = backfill.error
        console.warn("FA awards backfill:", backfill.error)
      }
    }
    const rows = await getProgramFaAwardsReport(filters)
    if (rows.length === 0 && backfillError) {
      return {
        success: false as const,
        error: backfillError,
        rows: [] as ProgramFaAwardRow[],
      }
    }
    return { success: true as const, rows }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load financial assistance report.",
      rows: [] as ProgramFaAwardRow[],
    }
  }
}

export async function getActiveFaAwardsByEnrollmentIds(
  organizationId: string,
  enrollmentIds: string[]
): Promise<Map<string, ContactFaAwardSummary>> {
  const map = new Map<string, ContactFaAwardSummary>()
  const ids = [...new Set(enrollmentIds.filter(Boolean))]
  if (!organizationId || ids.length === 0) return map

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("program_enrollment_fa_awards")
    .select(
      `
      enrollment_id,
      original_amount,
      assisted_amount,
      discount_amount,
      plan_type,
      monthly_amount,
      remaining_months,
      note,
      applied_at
    `
    )
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in("enrollment_id", ids)

  if (error) {
    console.warn("getActiveFaAwardsByEnrollmentIds:", error.message)
    return map
  }

  for (const row of data || []) {
    const enrollmentId = row.enrollment_id as string
    const planType =
      String(row.plan_type || "total_fee") === "monthly" ? "monthly" : "total_fee"
    const originalAmount = Number(row.original_amount || 0)
    const assistedAmount = Number(row.assisted_amount || 0)
    const monthlyAmount =
      row.monthly_amount == null ? null : Number(row.monthly_amount)
    const remainingMonths =
      row.remaining_months == null ? null : Number(row.remaining_months)
    map.set(enrollmentId, {
      enrollmentId,
      originalAmount,
      assistedAmount,
      discountAmount: Number(row.discount_amount || 0),
      planType,
      monthlyAmount,
      remainingMonths,
      planLabel: formatFaAwardPlanLabel({
        planType,
        monthlyAmount,
        remainingMonths,
        assistedAmount,
        originalAmount,
      }),
      note: (row.note as string | null) || null,
      appliedAt: (row.applied_at as string) || "",
    })
  }

  const missingIds = ids.filter((id) => !map.has(id))
  if (missingIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("program_enrollments")
      .select(
        "id, program_id, offering_id, participant_contact_id, child_name, notes, updated_at, created_at"
      )
      .eq("organization_id", organizationId)
      .in("id", missingIds)

    for (const enrollment of enrollments || []) {
      const parsed = parseFaNoteBlock(enrollment.notes as string | null)
      if (!parsed) continue
      const enrollmentId = enrollment.id as string
      map.set(enrollmentId, {
        enrollmentId,
        originalAmount: parsed.originalAmount,
        assistedAmount: parsed.assistedAmount,
        discountAmount: Math.max(
          0,
          parsed.originalAmount - parsed.assistedAmount
        ),
        planType: parsed.planType,
        monthlyAmount: parsed.monthlyAmount,
        remainingMonths: parsed.remainingMonths,
        planLabel: formatFaAwardPlanLabel(parsed),
        note: parsed.note,
        appliedAt:
          (enrollment.updated_at as string) ||
          (enrollment.created_at as string) ||
          "",
      })

      // Persist so Reports and future loads stay in sync.
      await supabase.from("program_enrollment_fa_awards").insert({
        organization_id: organizationId,
        enrollment_id: enrollmentId,
        program_id: enrollment.program_id || null,
        offering_id: enrollment.offering_id || null,
        participant_contact_id: enrollment.participant_contact_id || null,
        participant_name: String(enrollment.child_name || "").trim() || null,
        original_amount: parsed.originalAmount,
        assisted_amount: parsed.assistedAmount,
        discount_amount: Math.max(
          0,
          parsed.originalAmount - parsed.assistedAmount
        ),
        plan_type: parsed.planType,
        monthly_amount: parsed.monthlyAmount,
        remaining_months: parsed.remainingMonths,
        note: parsed.note || "Imported from enrollment notes",
        status: "active",
        applied_at:
          (enrollment.updated_at as string) ||
          (enrollment.created_at as string) ||
          new Date().toISOString(),
      })
    }
  }

  return map
}
