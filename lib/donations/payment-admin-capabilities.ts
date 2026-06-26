import type { PaymentAdminCapabilities, PaymentAdminRecord } from "@/lib/donations/payment-admin-types"
import {
  canAllocatePayment,
  isFullyRefundedPayment,
  isImportedPayment,
  isProcessorStripePayment,
  isVoidedPaymentStatus,
  paymentNetAmount,
  remainingRefundableAmount,
} from "@/lib/donations/payment-net-amount"

export type DonationHistoryPaymentRow = {
  id: string
  amount: number
  refunded_amount?: number | null
  payment_date: string
  source?: string | null
  source_type?: string | null
  status?: string | null
  memo?: string | null
  import_batch_id?: string | null
  stripe_payment_intent_id?: string | null
  stripe_charge_id?: string | null
  pledge_id?: string | null
  donation_categories?: { name: string | null } | null
}

export function buildPaymentAdminCapabilities(
  row: DonationHistoryPaymentRow,
  options?: { stripeConfigured?: boolean }
): PaymentAdminCapabilities {
  const amount = Number(row.amount || 0)
  const refundedAmount = Number(row.refunded_amount || 0)
  const status = row.status ?? null
  const remaining = remainingRefundableAmount({
    amount,
    refunded_amount: refundedAmount,
    status,
  })
  const voided = isVoidedPaymentStatus(status)
  const fullyRefunded = isFullyRefundedPayment({
    amount,
    refunded_amount: refundedAmount,
    status,
  })
  const processorStripe = isProcessorStripePayment(row)
  const imported = isImportedPayment(row)
  const stripeConfigured = options?.stripeConfigured ?? true

  let stripeRefundBlockedReason: string | null = null
  if (imported) {
    stripeRefundBlockedReason =
      "This payment was imported. Refund the donor externally, then record a refund here."
  } else if (!processorStripe) {
    stripeRefundBlockedReason =
      "Stripe refunds are only available for donations collected through the app."
  } else if (!stripeConfigured) {
    stripeRefundBlockedReason = "Stripe is not configured for this environment."
  }

  const canStripeRefund =
    !voided &&
    !fullyRefunded &&
    remaining > 0 &&
    processorStripe &&
    !imported &&
    stripeConfigured

  const canRecordRefund =
    !voided && !fullyRefunded && remaining > 0 && (!processorStripe || imported)

  const canEditAmount =
    !voided &&
    !fullyRefunded &&
    !processorStripe &&
    String(row.source_type || "").toLowerCase() !== "processor"

  return {
    canEdit: !voided,
    canEditAmount,
    canVoid: !voided && !processorStripe,
    canStripeRefund,
    canRecordRefund,
    canAllocate: canAllocatePayment(row),
    remainingRefundable: remaining,
    stripeRefundBlockedReason,
  }
}

export function mapPaymentToDonationHistoryRow(
  row: DonationHistoryPaymentRow
): import("@/components/donations/donor-donation-history-table").DonationHistoryRow {
  const amount = Number(row.amount || 0)
  const refundedAmount = Number(row.refunded_amount || 0)

  return {
    id: row.id,
    date: row.payment_date,
    amount,
    netAmount: paymentNetAmount(amount, refundedAmount),
    refundedAmount,
    category: row.donation_categories?.name || "General",
    method: row.source || "Unknown",
    status: row.status ?? null,
    sourceType: row.source_type ?? null,
    memo: row.memo ?? null,
    pledgeId: row.pledge_id ?? null,
    capabilities: buildPaymentAdminCapabilities(row),
  }
}

export function mapPaymentToAdminRecord(row: DonationHistoryPaymentRow): PaymentAdminRecord {
  const amount = Number(row.amount || 0)
  const refundedAmount = Number(row.refunded_amount || 0)

  return {
    id: row.id,
    amount,
    refundedAmount,
    netAmount: paymentNetAmount(amount, refundedAmount),
    paymentDate: row.payment_date,
    source: row.source ?? null,
    sourceType: row.source_type ?? null,
    status: row.status ?? null,
    memo: row.memo ?? null,
    pledgeId: row.pledge_id ?? null,
    importBatchId: row.import_batch_id ?? null,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
    stripeChargeId: row.stripe_charge_id ?? null,
    categoryId: null,
    categoryName: row.donation_categories?.name ?? null,
    capabilities: buildPaymentAdminCapabilities(row),
  }
}
