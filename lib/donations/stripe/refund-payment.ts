import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import {
  paymentNetAmount,
  resolvePaymentStatusAfterRefund,
} from "@/lib/donations/payment-net-amount"

export type PaymentRefundRow = {
  id: string
  organization_id: string
  amount: number
  refunded_amount: number
  status: string | null
  pledge_id: string | null
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
}

export async function loadPaymentForRefund(
  supabase: SupabaseClient,
  paymentId: string
): Promise<PaymentRefundRow | null> {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, organization_id, amount, refunded_amount, status, pledge_id, stripe_payment_intent_id, stripe_charge_id"
    )
    .eq("id", paymentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    id: data.id,
    organization_id: data.organization_id,
    amount: Number(data.amount || 0),
    refunded_amount: Number(data.refunded_amount || 0),
    status: data.status,
    pledge_id: data.pledge_id,
    stripe_payment_intent_id: data.stripe_payment_intent_id,
    stripe_charge_id: data.stripe_charge_id,
  }
}

export async function applyPaymentRefundUpdate(
  supabase: SupabaseClient,
  input: {
    paymentId: string
    nextRefundedAmount: number
    currentAmount: number
    currentStatus: string | null
    refundNote?: string | null
    existingMemo?: string | null
  }
) {
  const amount = Number(input.currentAmount || 0)
  const nextRefundedAmount = Math.min(Math.max(input.nextRefundedAmount, 0), amount)
  const status = resolvePaymentStatusAfterRefund(
    amount,
    nextRefundedAmount,
    input.currentStatus
  )

  let memo = input.existingMemo ?? null
  if (input.refundNote?.trim()) {
    const note = `Refund: ${input.refundNote.trim()}`
    memo = memo ? `${memo}\n${note}` : note
  }

  const { error } = await supabase
    .from("payments")
    .update({
      refunded_amount: nextRefundedAmount,
      status,
      ...(memo !== input.existingMemo ? { memo } : {}),
    })
    .eq("id", input.paymentId)

  if (error) throw new Error(error.message)

  return {
    refundedAmount: nextRefundedAmount,
    netAmount: paymentNetAmount(amount, nextRefundedAmount),
    status,
  }
}

export async function syncPaymentRefundFromStripeCharge(
  supabase: SupabaseClient,
  charge: Stripe.Charge
) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id

  let query = supabase
    .from("payments")
    .select(
      "id, organization_id, amount, refunded_amount, status, pledge_id, memo, stripe_payment_intent_id, stripe_charge_id"
    )
    .eq("source_type", "processor")

  if (paymentIntentId) {
    query = query.eq("stripe_payment_intent_id", paymentIntentId)
  } else {
    query = query.eq("stripe_charge_id", charge.id)
  }

  const { data: payment, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  if (!payment) return { handled: false as const }

  const refundedAmount = charge.amount_refunded / 100
  if (refundedAmount <= Number(payment.refunded_amount || 0)) {
    return { handled: true as const, paymentId: payment.id, skipped: true as const }
  }

  const result = await applyPaymentRefundUpdate(supabase, {
    paymentId: payment.id,
    nextRefundedAmount: refundedAmount,
    currentAmount: Number(payment.amount || 0),
    currentStatus: payment.status,
    existingMemo: payment.memo,
  })

  return {
    handled: true as const,
    paymentId: payment.id,
    ...result,
  }
}

export async function createStripeDonationRefund(
  stripe: Stripe,
  input: {
    payment: PaymentRefundRow
    refundAmount: number
    organizationId: string
    connectedAccountId: string
    reason?: string | null
  }
) {
  const amountCents = Math.round(input.refundAmount * 100)
  if (amountCents <= 0) {
    throw new Error("Refund amount must be greater than zero")
  }

  const metadata = {
    organization_id: input.organizationId,
    payment_id: input.payment.id,
    manaratee_refund: "donation",
  }

  const requestOptions = { stripeAccount: input.connectedAccountId }

  if (input.payment.stripe_payment_intent_id) {
    return stripe.refunds.create(
      {
        payment_intent: input.payment.stripe_payment_intent_id,
        amount: amountCents,
        reason: "requested_by_customer",
        metadata,
      },
      requestOptions
    )
  }

  if (input.payment.stripe_charge_id) {
    return stripe.refunds.create(
      {
        charge: input.payment.stripe_charge_id,
        amount: amountCents,
        reason: "requested_by_customer",
        metadata,
      },
      requestOptions
    )
  }

  throw new Error("Payment is missing Stripe charge identifiers")
}
