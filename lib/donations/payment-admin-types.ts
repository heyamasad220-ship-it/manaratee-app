export type PaymentAdminCapabilities = {
  canEdit: boolean
  canEditAmount: boolean
  canVoid: boolean
  canStripeRefund: boolean
  canRecordRefund: boolean
  canAllocate: boolean
  remainingRefundable: number
  stripeRefundBlockedReason: string | null
}

export type PaymentAdminRecord = {
  id: string
  amount: number
  refundedAmount: number
  netAmount: number
  paymentDate: string
  source: string | null
  sourceType: string | null
  status: string | null
  memo: string | null
  pledgeId: string | null
  importBatchId: string | null
  stripePaymentIntentId: string | null
  stripeChargeId: string | null
  categoryId: string | null
  categoryName: string | null
  capabilities: PaymentAdminCapabilities
}
