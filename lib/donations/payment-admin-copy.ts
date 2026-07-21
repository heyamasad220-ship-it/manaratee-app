/**
 * Staff-facing donation action copy.
 * Prefer processor-ready labels (Refund / Receive Payment) so the UI matches the
 * connected Stripe experience even when a specific row was entered manually.
 */

export function paymentRefundMenuLabel() {
  return "Refund"
}

export function paymentRefundDialogTitle() {
  return "Refund"
}

export function paymentRefundConfirmLabel() {
  return "Refund"
}

export function paymentRefundDialogDescription(input: {
  remainingRefundable: number
  canStripeRefund: boolean
  stripeRefundBlockedReason?: string | null
  formatMoney: (value: number) => string
}) {
  const remaining = input.formatMoney(input.remainingRefundable)
  if (input.canStripeRefund) {
    return `Issue a refund through Stripe. Up to ${remaining} remaining.`
  }
  if (input.stripeRefundBlockedReason) {
    return `${input.stripeRefundBlockedReason} Up to ${remaining} can be refunded in the app.`
  }
  return `Issue a refund for this payment. Up to ${remaining} remaining.`
}

export function receivePaymentActionLabel() {
  return "Receive Payment"
}

export function receivePaymentSavingLabel() {
  return "Processing..."
}

export function receivePaymentDialogTitle() {
  return "Receive Payment"
}
