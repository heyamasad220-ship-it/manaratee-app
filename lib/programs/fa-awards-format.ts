export type FaAwardPlanType = "total_fee" | "monthly"

export type ProgramFaAwardRow = {
  id: string
  enrollmentId: string
  programId: string | null
  offeringId: string | null
  participantContactId: string | null
  participantName: string
  programName: string
  offeringName: string | null
  originalAmount: number
  assistedAmount: number
  discountAmount: number
  planType: FaAwardPlanType
  monthlyAmount: number | null
  remainingMonths: number | null
  note: string | null
  status: "active" | "superseded"
  appliedAt: string
}

export function formatFaAwardPlanLabel(input: {
  planType: FaAwardPlanType
  monthlyAmount: number | null
  remainingMonths: number | null
  assistedAmount: number
  originalAmount: number
}) {
  if (
    input.planType === "monthly" &&
    input.monthlyAmount != null &&
    input.remainingMonths != null
  ) {
    return `$${input.monthlyAmount.toFixed(2)}/mo × ${input.remainingMonths} mo`
  }
  const pct =
    input.originalAmount > 0.009
      ? Math.round((1 - input.assistedAmount / input.originalAmount) * 100)
      : null
  if (input.assistedAmount <= 0.009) return "Full scholarship"
  if (pct != null && pct > 0) return `${pct}% off (total fee)`
  return "Reduced total fee"
}
