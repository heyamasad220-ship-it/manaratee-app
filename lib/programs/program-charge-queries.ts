import { createClient } from "@/lib/supabase/server"
import type { ProgramChargeLine } from "@/lib/programs/program-charge-types"
import { isBillingSchemaMissingError } from "@/lib/programs/program-billing-schema"

export type EnrollmentChargeBundle = {
  chargeId: string | null
  planType: string | null
  subtotal: number
  discountTotal: number
  total: number
  dueToday: number
  amountPaid: number
  lines: ProgramChargeLine[]
  schemaReady: boolean
}

function lineIsActive(line: ProgramChargeLine) {
  const status = (line.metadata?.status as string | undefined) || "active"
  return status !== "voided"
}

export async function getEnrollmentChargeBundle(
  organizationId: string,
  enrollmentId: string,
  chargeId: string | null
): Promise<EnrollmentChargeBundle> {
  const empty: EnrollmentChargeBundle = {
    chargeId,
    planType: null,
    subtotal: 0,
    discountTotal: 0,
    total: 0,
    dueToday: 0,
    amountPaid: 0,
    lines: [],
    schemaReady: true,
  }

  if (!chargeId) {
    return { ...empty, schemaReady: true }
  }

  const supabase = await createClient()

  const { data: charge, error: chargeError } = await supabase
    .from("program_charges")
    .select(
      "id, plan_type, subtotal, discount_total, total, due_today, amount_paid"
    )
    .eq("organization_id", organizationId)
    .eq("id", chargeId)
    .maybeSingle()

  if (chargeError) {
    if (isBillingSchemaMissingError(chargeError.message)) {
      return { ...empty, schemaReady: false }
    }
    throw new Error(chargeError.message)
  }

  if (!charge) {
    return empty
  }

  const { data: lines, error: linesError } = await supabase
    .from("program_charge_lines")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("charge_id", chargeId)
    .order("sort_order", { ascending: true })

  if (linesError) {
    if (isBillingSchemaMissingError(linesError.message)) {
      return { ...empty, schemaReady: false }
    }
    throw new Error(linesError.message)
  }

  const activeLines = ((lines || []) as ProgramChargeLine[]).filter(lineIsActive)
  const voidedLines = ((lines || []) as ProgramChargeLine[]).filter(
    (line) => !lineIsActive(line)
  )

  return {
    chargeId,
    planType: charge.plan_type as string | null,
    subtotal: Number(charge.subtotal || 0),
    discountTotal: Number(charge.discount_total || 0),
    total: Number(charge.total || 0),
    dueToday: Number(charge.due_today || 0),
    amountPaid: Number(charge.amount_paid || 0),
    lines: [...activeLines, ...voidedLines],
    schemaReady: true,
  }
}
