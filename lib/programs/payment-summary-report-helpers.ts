/** Payment Summary lists money to collect or money received — not free seats. */

export function isFreeOfferingFeePlan(plan: {
  planType?: string | null
  tuition?: number | null
} | null | undefined) {
  if (!plan) return false
  if (String(plan.planType || "").toLowerCase() === "free") return true
  return plan.tuition != null && Number(plan.tuition) === 0
}

export function isPaymentSummaryEnrollment(input: {
  offeringIsFree: boolean
  paymentRequired?: boolean | null
  totalAmount?: number | null
  amountPaid?: number | null
  chargeTotal?: number | null
}) {
  const total = Number(input.totalAmount || 0)
  const paid = Number(input.amountPaid || 0)
  const charges = Number(input.chargeTotal || 0)
  if (total > 0.009 || paid > 0.009 || charges > 0.009) return true
  if (input.offeringIsFree) return false
  return input.paymentRequired !== false
}

export function isYouthEnrollment(input: {
  childPersonId?: string | null
  participantContactId?: string | null
}) {
  return Boolean(input.childPersonId) || !input.participantContactId
}

/** Contact / parent column: youth, or an adult registered by someone else. */
export function enrollmentShowsContact(input: {
  childPersonId?: string | null
  participantContactId?: string | null
  registrantContactId?: string | null
}) {
  if (isYouthEnrollment(input)) return true
  return Boolean(
    input.registrantContactId &&
      input.registrantContactId !== input.participantContactId
  )
}
