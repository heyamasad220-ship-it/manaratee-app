"use server"

import { revalidatePath } from "next/cache"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { buildPaymentAdminCapabilities } from "@/lib/donations/payment-admin-capabilities"
import {
  fetchPledgeAttribution,
  toPaymentAttributionColumns,
} from "@/lib/donations/payment-attribution"
import {
  applyPaymentRefundUpdate,
  createStripeDonationRefund,
  loadPaymentForRefund,
} from "@/lib/donations/stripe/refund-payment"
import { getStripeServerClient, isStripeConfigured } from "@/lib/stripe/stripe-server"
import { handleDonationAffiliationSync } from "@/lib/contacts/contact-affiliation-sync"
import {
  canAllocatePayment,
  isImportedPayment,
  isProcessorStripePayment,
  paymentNetAmount,
  remainingRefundableAmount,
} from "@/lib/donations/payment-net-amount"

import type { PaymentAdminCapabilities, PaymentAdminRecord } from "@/lib/donations/payment-admin-types"

type PaymentRow = {
  id: string
  organization_id: string
  donor_id: string | null
  amount: number
  refunded_amount: number
  payment_date: string
  source: string | null
  source_type: string | null
  status: string | null
  memo: string | null
  pledge_id: string | null
  import_batch_id: string | null
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
  category_id: string | null
  donation_categories?: { name: string | null } | null
}

function buildCapabilities(row: PaymentRow): PaymentAdminCapabilities {
  return buildPaymentAdminCapabilities(row, {
    stripeConfigured: isStripeConfigured(),
  })
}

function toPaymentAdminRecord(row: PaymentRow): PaymentAdminRecord {
  const amount = Number(row.amount || 0)
  const refundedAmount = Number(row.refunded_amount || 0)

  return {
    id: row.id,
    amount,
    refundedAmount,
    netAmount: paymentNetAmount(amount, refundedAmount),
    paymentDate: row.payment_date,
    source: row.source,
    sourceType: row.source_type,
    status: row.status,
    memo: row.memo,
    pledgeId: row.pledge_id,
    importBatchId: row.import_batch_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeChargeId: row.stripe_charge_id,
    categoryId: row.category_id,
    categoryName: row.donation_categories?.name ?? null,
    capabilities: buildCapabilities(row),
  }
}

async function loadOrgPayment(paymentId: string) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { ok: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("payments")
    .select(
      `
      id,
      organization_id,
      donor_id,
      amount,
      refunded_amount,
      payment_date,
      source,
      source_type,
      status,
      memo,
      pledge_id,
      import_batch_id,
      stripe_payment_intent_id,
      stripe_charge_id,
      category_id,
      donation_categories ( name )
    `
    )
    .eq("id", paymentId)
    .eq("organization_id", access.orgId)
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message }
  if (!data) return { ok: false as const, error: "Payment not found" }

  return { ok: true as const, access, payment: data as PaymentRow }
}

function revalidateDonationPaths(donorId: string | null | undefined) {
  revalidatePath("/donations/payments")
  revalidatePath("/donations/payments/one-time")
  revalidatePath("/donations/payments/recurring")
  revalidatePath("/donations/donors")
  if (donorId) {
    revalidatePath(`/donations/donors/individuals/${donorId}`)
    revalidatePath(`/donations/donors/organizations/${donorId}`)
  }
}

export async function getPaymentAdminRecordAction(paymentId: string) {
  const loaded = await loadOrgPayment(paymentId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }
  return {
    success: true as const,
    payment: toPaymentAdminRecord(loaded.payment),
  }
}

export async function updatePaymentAction(input: {
  paymentId: string
  amount?: number
  paymentDate?: string
  source?: string
  memo?: string | null
  categoryId?: string | null
}) {
  const loaded = await loadOrgPayment(input.paymentId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const { payment, access } = loaded
  const capabilities = buildCapabilities(payment)

  if (!capabilities.canEdit) {
    return { success: false as const, error: "This payment cannot be edited." }
  }

  const updates: Record<string, unknown> = {}

  if (input.memo !== undefined) {
    updates.memo = input.memo?.trim() || null
  }

  if (input.categoryId !== undefined) {
    updates.category_id = input.categoryId || null
  }

  if (capabilities.canEditAmount) {
    if (input.amount !== undefined) {
      const amount = Number(input.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false as const, error: "Amount must be greater than zero." }
      }
      if (amount < Number(payment.refunded_amount || 0)) {
        return {
          success: false as const,
          error: "Amount cannot be less than the refunded amount.",
        }
      }
      updates.amount = amount
    }

    if (input.paymentDate !== undefined && input.paymentDate.trim()) {
      const dateOnly = input.paymentDate.trim()
      updates.payment_date = dateOnly.includes("T")
        ? dateOnly
        : `${dateOnly}T12:00:00`
    }

    if (input.source !== undefined) {
      updates.source = input.source.trim() || null
    }
  } else if (
    input.amount !== undefined ||
    input.paymentDate !== undefined ||
    input.source !== undefined
  ) {
    return {
      success: false as const,
      error: "Amount, date, and method cannot be changed for app-collected Stripe payments.",
    }
  }

  if (Object.keys(updates).length === 0) {
    return { success: false as const, error: "No changes to save." }
  }

  const { error } = await access.supabase
    .from("payments")
    .update(updates)
    .eq("id", payment.id)
    .eq("organization_id", access.orgId)

  if (error) return { success: false as const, error: error.message }

  revalidateDonationPaths(payment.donor_id)
  return { success: true as const }
}

export async function voidPaymentAction(input: {
  paymentId: string
  reason?: string | null
}) {
  const loaded = await loadOrgPayment(input.paymentId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const { payment, access } = loaded
  const capabilities = buildCapabilities(payment)

  if (!capabilities.canVoid) {
    if (isProcessorStripePayment(payment)) {
      return {
        success: false as const,
        error: "App-collected Stripe payments must be refunded through Stripe, not voided.",
      }
    }
    return { success: false as const, error: "This payment cannot be voided." }
  }

  let memo = payment.memo
  if (input.reason?.trim()) {
    const note = `Voided: ${input.reason.trim()}`
    memo = memo ? `${memo}\n${note}` : note
  }

  const { error } = await access.supabase
    .from("payments")
    .update({
      status: "voided",
      memo,
    })
    .eq("id", payment.id)
    .eq("organization_id", access.orgId)

  if (error) return { success: false as const, error: error.message }

  revalidateDonationPaths(payment.donor_id)
  return { success: true as const }
}

export async function recordPaymentRefundAction(input: {
  paymentId: string
  refundAmount: number
  reason?: string | null
}) {
  const loaded = await loadOrgPayment(input.paymentId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const { payment, access } = loaded
  const capabilities = buildCapabilities(payment)

  if (!capabilities.canRecordRefund) {
    if (isProcessorStripePayment(payment) && !isImportedPayment(payment)) {
      return {
        success: false as const,
        error: "Use Stripe refund for donations collected through the app.",
      }
    }
    return { success: false as const, error: "This payment cannot be refunded." }
  }

  const refundAmount = Number(input.refundAmount)
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    return { success: false as const, error: "Refund amount must be greater than zero." }
  }

  const currentRefunded = Number(payment.refunded_amount || 0)
  const remaining = remainingRefundableAmount(payment)
  if (refundAmount > remaining + 0.0001) {
    return {
      success: false as const,
      error: `Refund cannot exceed ${remaining.toFixed(2)}.`,
    }
  }

  try {
    const result = await applyPaymentRefundUpdate(access.supabase, {
      paymentId: payment.id,
      nextRefundedAmount: currentRefunded + refundAmount,
      currentAmount: Number(payment.amount || 0),
      currentStatus: payment.status,
      refundNote: input.reason,
      existingMemo: payment.memo,
    })

    revalidateDonationPaths(payment.donor_id)
    return { success: true as const, ...result }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not record refund",
    }
  }
}

export async function stripeRefundPaymentAction(input: {
  paymentId: string
  refundAmount: number
  reason?: string | null
}) {
  const loaded = await loadOrgPayment(input.paymentId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const { payment, access } = loaded
  const capabilities = buildCapabilities(payment)

  if (!capabilities.canStripeRefund) {
    return {
      success: false as const,
      error: capabilities.stripeRefundBlockedReason || "Stripe refund is not available.",
    }
  }

  const refundAmount = Number(input.refundAmount)
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    return { success: false as const, error: "Refund amount must be greater than zero." }
  }

  const remaining = remainingRefundableAmount(payment)
  if (refundAmount > remaining + 0.0001) {
    return {
      success: false as const,
      error: `Refund cannot exceed ${remaining.toFixed(2)}.`,
    }
  }

  const refundRow = await loadPaymentForRefund(access.supabase, payment.id)
  if (!refundRow) {
    return { success: false as const, error: "Payment not found" }
  }

  try {
    const stripe = getStripeServerClient()
    const stripeRefund = await createStripeDonationRefund(stripe, {
      payment: refundRow,
      refundAmount,
      organizationId: access.orgId,
      reason: input.reason,
    })

    let nextRefundedAmount = Number(payment.refunded_amount || 0) + stripeRefund.amount / 100

    const chargeId =
      typeof stripeRefund.charge === "string" ? stripeRefund.charge : stripeRefund.charge?.id

    if (chargeId) {
      const charge = await stripe.charges.retrieve(chargeId)
      nextRefundedAmount = charge.amount_refunded / 100
    }

    const result = await applyPaymentRefundUpdate(access.supabase, {
      paymentId: payment.id,
      nextRefundedAmount,
      currentAmount: Number(payment.amount || 0),
      currentStatus: payment.status,
      refundNote: input.reason,
      existingMemo: payment.memo,
    })

    revalidateDonationPaths(payment.donor_id)
    return {
      success: true as const,
      stripeRefundId: stripeRefund.id,
      ...result,
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Stripe refund failed",
    }
  }
}

export async function allocatePaymentToOpenPledgeAction(input: {
  paymentId: string
  pledgeId: string
}) {
  const loaded = await loadOrgPayment(input.paymentId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const { payment, access } = loaded

  if (!canAllocatePayment(payment)) {
    return {
      success: false as const,
      error: "This payment is already allocated or cannot be linked to a pledge.",
    }
  }

  const { data: pledge, error: pledgeError } = await access.supabase
    .from("pledge_status_view")
    .select(
      "id, donor_id, donor_name, campaign_name, balance_remaining, calculated_status"
    )
    .eq("organization_id", access.orgId)
    .eq("id", input.pledgeId)
    .maybeSingle()

  if (pledgeError) return { success: false as const, error: pledgeError.message }
  if (!pledge) return { success: false as const, error: "Pledge not found" }

  if (String(pledge.calculated_status || "").toLowerCase() === "cancelled") {
    return { success: false as const, error: "Cancelled pledges cannot receive payments." }
  }

  if (Number(pledge.balance_remaining || 0) <= 0) {
    return { success: false as const, error: "This pledge has no remaining balance." }
  }

  if (payment.donor_id && pledge.donor_id && payment.donor_id !== pledge.donor_id) {
    return {
      success: false as const,
      error: "This pledge belongs to a different donor.",
    }
  }

  const pledgeAttribution = await fetchPledgeAttribution(access.supabase, input.pledgeId)

  const { error } = await access.supabase
    .from("payments")
    .update({
      pledge_id: input.pledgeId,
      donor_id: payment.donor_id || pledge.donor_id || null,
      status: "allocated",
      reconciled_at: new Date().toISOString(),
      ...toPaymentAttributionColumns(pledgeAttribution),
    })
    .eq("id", payment.id)
    .eq("organization_id", access.orgId)

  if (error) return { success: false as const, error: error.message }

  const donorId = payment.donor_id || pledge.donor_id
  if (donorId) {
    let contactId: string | null = null
    const { data: donorRow } = await access.supabase
      .from("donors")
      .select("contact_id")
      .eq("id", donorId)
      .maybeSingle()
    contactId = (donorRow?.contact_id as string | null) ?? null

    try {
      await handleDonationAffiliationSync({
        organizationId: access.orgId,
        donorId,
        contactId,
      })
    } catch (syncError) {
      console.error(
        `[payment-admin] affiliation sync failed: ${
          syncError instanceof Error ? syncError.message : String(syncError)
        }`
      )
    }
  }

  revalidateDonationPaths(donorId)
  revalidatePath("/donations/payments")
  return { success: true as const }
}
