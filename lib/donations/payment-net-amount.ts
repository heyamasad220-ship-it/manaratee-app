export function paymentNetAmount(
  amount: number | null | undefined,
  refundedAmount: number | null | undefined = 0
): number {
  return Math.max(Number(amount || 0) - Number(refundedAmount || 0), 0)
}

export function isVoidedPaymentStatus(status: string | null | undefined): boolean {
  return String(status || "").toLowerCase() === "voided"
}

export function isFullyRefundedPayment(input: {
  amount: number | null | undefined
  refunded_amount?: number | null | undefined
  status?: string | null | undefined
}): boolean {
  if (String(input.status || "").toLowerCase() === "refunded") return true
  return paymentNetAmount(input.amount, input.refunded_amount) <= 0
}

export function countsTowardGivingTotals(input: {
  amount: number | null | undefined
  refunded_amount?: number | null | undefined
  status?: string | null | undefined
}): boolean {
  if (isVoidedPaymentStatus(input.status)) return false
  return paymentNetAmount(input.amount, input.refunded_amount) > 0
}

export function resolvePaymentStatusAfterRefund(
  amount: number,
  refundedAmount: number,
  currentStatus: string | null | undefined
): string {
  if (refundedAmount >= amount && amount > 0) return "refunded"
  if (refundedAmount > 0) return "partially_refunded"
  return String(currentStatus || "unallocated").toLowerCase()
}

export function canAllocatePayment(input: {
  pledge_id?: string | null
  status?: string | null
  amount?: number | null
  refunded_amount?: number | null
}): boolean {
  if (input.pledge_id) return false
  if (isVoidedPaymentStatus(input.status)) return false
  return paymentNetAmount(input.amount, input.refunded_amount) > 0
}

export function isProcessorStripePayment(input: {
  source_type?: string | null
  stripe_payment_intent_id?: string | null
  stripe_charge_id?: string | null
}): boolean {
  return (
    String(input.source_type || "").toLowerCase() === "processor" &&
    Boolean(input.stripe_payment_intent_id || input.stripe_charge_id)
  )
}

export function isImportedPayment(input: {
  source_type?: string | null
  import_batch_id?: string | null
}): boolean {
  return (
    String(input.source_type || "").toLowerCase() === "import" ||
    Boolean(input.import_batch_id)
  )
}

export function remainingRefundableAmount(input: {
  amount: number | null | undefined
  refunded_amount?: number | null | undefined
  status?: string | null | undefined
}): number {
  if (isVoidedPaymentStatus(input.status)) return 0
  return paymentNetAmount(input.amount, input.refunded_amount)
}

/**
 * Pledge ledger: pledged is the commitment; collected is net allocated payments.
 * Org giving is the payment total — never pledged + collected.
 */
export function computePledgeLedgerTotals(input: {
  amountPledged: number
  allocatedPayments: Array<{
    amount: number | null | undefined
    refunded_amount?: number | null | undefined
    status?: string | null | undefined
  }>
}) {
  const collected = input.allocatedPayments
    .filter((payment) => countsTowardGivingTotals(payment))
    .reduce((sum, payment) => sum + paymentNetAmount(payment.amount, payment.refunded_amount), 0)

  return {
    pledged: input.amountPledged,
    collected,
    outstanding: Math.max(input.amountPledged - collected, 0),
    orgGiving: collected,
  }
}
