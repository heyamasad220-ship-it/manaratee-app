import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import { parseDonationCheckoutMetadata } from "@/lib/donations/stripe/metadata"
import {
  loadCheckoutSession,
  markCheckoutSessionStatus,
} from "@/lib/donations/stripe/checkout-session-utils"
import { handleRecurringCheckoutSessionCompleted } from "@/lib/donations/stripe/processor-subscription"
import { maybeAutoGenerateAndEmailPaymentReceipt } from "@/lib/donations/stripe/receipt-after-payment"
import type {
  DonationCheckoutMetadata,
  ProcessorPaymentInsertResult,
} from "@/lib/donations/stripe/types"

import type { CheckoutSessionRow } from "@/lib/donations/stripe/checkout-session-utils"

function resolveAttribution(
  metadata: DonationCheckoutMetadata,
  checkoutSession: CheckoutSessionRow | null
) {
  return {
    campaign_id: metadata.campaign_id ?? checkoutSession?.campaign_id ?? null,
    category_id: metadata.category_id ?? checkoutSession?.category_id ?? null,
    subcategory_id: metadata.subcategory_id ?? checkoutSession?.subcategory_id ?? null,
  }
}

export async function insertProcessorPaymentFromCheckout(
  supabase: SupabaseClient,
  input: {
    metadata: DonationCheckoutMetadata
    stripeCheckoutSessionId: string
    stripePaymentIntentId: string
    stripeChargeId?: string | null
    amountCents: number
    currency?: string | null
    paymentDate?: string | null
    senderName?: string | null
  }
): Promise<ProcessorPaymentInsertResult> {
  const checkoutSession = await loadCheckoutSession(supabase, {
    manarateeCheckoutId: input.metadata.manaratee_checkout_id,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
  })

  if (checkoutSession?.payment_id) {
    return {
      paymentId: checkoutSession.payment_id,
      created: false,
      checkoutSessionId: checkoutSession.id,
    }
  }

  const { data: existingByIntent } = await supabase
    .from("payments")
    .select("id")
    .eq("stripe_payment_intent_id", input.stripePaymentIntentId)
    .maybeSingle()

  if (existingByIntent?.id) {
    if (checkoutSession?.id) {
      await supabase
        .from("donation_checkout_sessions")
        .update({
          status: "complete",
          payment_id: existingByIntent.id,
          stripe_checkout_session_id: input.stripeCheckoutSessionId,
        })
        .eq("id", checkoutSession.id)
    }

    return {
      paymentId: existingByIntent.id,
      created: false,
      checkoutSessionId: checkoutSession?.id ?? null,
    }
  }

  const amount = input.amountCents / 100
  const attribution = resolveAttribution(input.metadata, checkoutSession)

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      organization_id: input.metadata.organization_id,
      donor_id: input.metadata.donor_id,
      contact_id: input.metadata.contact_id,
      pledge_id: null,
      recurring_donation_plan_id: null,
      sender_name: input.senderName ?? null,
      amount,
      payment_date: input.paymentDate ?? new Date().toISOString(),
      source: "stripe",
      source_type: "processor",
      status: "unallocated",
      is_verified: true,
      campaign_id: attribution.campaign_id,
      category_id: attribution.category_id,
      subcategory_id: attribution.subcategory_id,
      stripe_checkout_session_id: input.stripeCheckoutSessionId,
      stripe_payment_intent_id: input.stripePaymentIntentId,
      stripe_charge_id: input.stripeChargeId ?? null,
    })
    .select("id")
    .single()

  if (paymentError || !payment?.id) {
    throw new Error(paymentError?.message || "Could not insert processor payment")
  }

  if (checkoutSession?.id) {
    await supabase
      .from("donation_checkout_sessions")
      .update({
        status: "complete",
        payment_id: payment.id,
        stripe_checkout_session_id: input.stripeCheckoutSessionId,
        amount,
      })
      .eq("id", checkoutSession.id)
  }

  await maybeAutoGenerateAndEmailPaymentReceipt(
    supabase,
    input.metadata.organization_id,
    payment.id
  )

  return {
    paymentId: payment.id,
    created: true,
    checkoutSessionId: checkoutSession?.id ?? null,
  }
}

export async function recordProcessorEvent(
  supabase: SupabaseClient,
  input: {
    stripeEventId: string
    eventType: string
    stripeObjectId?: string | null
    organizationId?: string | null
    paymentId?: string | null
    checkoutSessionId?: string | null
    payload: Record<string, unknown>
    processingStatus?: "processed" | "ignored" | "failed"
    errorMessage?: string | null
  }
): Promise<{ duplicate: boolean; eventId?: string }> {
  const { data, error } = await supabase
    .from("payment_processor_events")
    .insert({
      organization_id: input.organizationId ?? null,
      stripe_event_id: input.stripeEventId,
      event_type: input.eventType,
      stripe_object_id: input.stripeObjectId ?? null,
      payment_id: input.paymentId ?? null,
      checkout_session_id: input.checkoutSessionId ?? null,
      payload: input.payload,
      processing_status: input.processingStatus ?? "processed",
      error_message: input.errorMessage ?? null,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      return { duplicate: true }
    }
    throw new Error(error.message)
  }

  return { duplicate: false, eventId: data.id }
}

export { markCheckoutSessionStatus } from "@/lib/donations/stripe/checkout-session-utils"

export async function handleCheckoutSessionCompleted(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  const metadata = parseDonationCheckoutMetadata(
    (session.metadata ?? {}) as Record<string, string>
  )

  if (!metadata) {
    return { handled: false as const, reason: "invalid_metadata" }
  }

  if (metadata.checkout_type === "recurring_setup") {
    const result = await handleRecurringCheckoutSessionCompleted(supabase, session)
    if ("handled" in result && result.handled === false) {
      return result
    }
    return { handled: true as const, checkoutType: "recurring_setup" as const, ...result }
  }

  if (metadata.checkout_type !== "one_time") {
    return { handled: false as const, reason: "unsupported_checkout_type" }
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id

  if (!paymentIntentId || !session.id) {
    return { handled: false as const, reason: "missing_payment_intent" }
  }

  const amountCents = session.amount_total ?? 0
  if (amountCents <= 0) {
    return { handled: false as const, reason: "invalid_amount" }
  }

  const result = await insertProcessorPaymentFromCheckout(supabase, {
    metadata,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    amountCents,
    currency: session.currency,
    paymentDate: new Date().toISOString(),
  })

  return { handled: true as const, ...result }
}

export async function handlePaymentIntentSucceeded(
  supabase: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent
) {
  const metadata = parseDonationCheckoutMetadata(
    (paymentIntent.metadata ?? {}) as Record<string, string>
  )

  if (!metadata || metadata.checkout_type !== "one_time") {
    return { handled: false as const, reason: "unsupported_checkout_type" }
  }

  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle()

  if (existing?.id) {
    return {
      handled: true as const,
      paymentId: existing.id,
      created: false,
      checkoutSessionId: null,
    }
  }

  const checkoutSessionId =
    typeof paymentIntent.metadata?.stripe_checkout_session_id === "string"
      ? paymentIntent.metadata.stripe_checkout_session_id
      : undefined

  const result = await insertProcessorPaymentFromCheckout(supabase, {
    metadata,
    stripeCheckoutSessionId: checkoutSessionId ?? `pi_fallback_${paymentIntent.id}`,
    stripePaymentIntentId: paymentIntent.id,
    stripeChargeId:
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id ?? null,
    amountCents: paymentIntent.amount_received || paymentIntent.amount,
    currency: paymentIntent.currency,
    paymentDate: new Date().toISOString(),
  })

  return { handled: true as const, ...result }
}
