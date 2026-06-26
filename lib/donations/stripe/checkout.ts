import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import { buildDonationCheckoutMetadata } from "@/lib/donations/stripe/metadata"
import {
  handleCheckoutSessionCompleted,
  handlePaymentIntentSucceeded,
  markCheckoutSessionStatus,
  recordProcessorEvent,
} from "@/lib/donations/stripe/processor-payment"
import { syncPaymentRefundFromStripeCharge } from "@/lib/donations/stripe/refund-payment"
import {
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleRecurringCheckoutExpiredOrFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "@/lib/donations/stripe/processor-subscription"
import type { CreateOneTimeDonationCheckoutInput } from "@/lib/donations/stripe/types"
import { getAppBaseUrl, getStripeServerClient } from "@/lib/stripe/stripe-server"

export async function createOneTimeDonationCheckout(
  supabase: SupabaseClient,
  input: CreateOneTimeDonationCheckoutInput
) {
  if (!input.amount || input.amount <= 0) {
    throw new Error("Amount must be greater than zero")
  }

  const amountCents = Math.round(input.amount * 100)
  if (amountCents < 50) {
    throw new Error("Minimum donation amount is $0.50")
  }

  const baseUrl = getAppBaseUrl()
  const successUrl =
    input.successUrl ??
    `${baseUrl}/customer/donation?checkout=success&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = input.cancelUrl ?? `${baseUrl}/customer/donation?checkout=cancelled`

  const { data: checkoutRow, error: checkoutError } = await supabase
    .from("donation_checkout_sessions")
    .insert({
      organization_id: input.organizationId,
      checkout_type: "one_time",
      donor_id: input.donorId,
      contact_id: input.contactId,
      campaign_id: input.campaignId ?? null,
      category_id: input.categoryId ?? null,
      subcategory_id: input.subcategoryId ?? null,
      amount: input.amount,
      currency: "USD",
      status: "open",
      metadata: {
        donor_email: input.donorEmail ?? null,
        donor_name: input.donorName ?? null,
      },
    })
    .select("id")
    .single()

  if (checkoutError || !checkoutRow?.id) {
    throw new Error(checkoutError?.message || "Could not create checkout session row")
  }

  const metadata = buildDonationCheckoutMetadata({
    organizationId: input.organizationId,
    donorId: input.donorId,
    contactId: input.contactId,
    campaignId: input.campaignId,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    checkoutType: "one_time",
    manarateeCheckoutId: checkoutRow.id,
  })

  const stripe = getStripeServerClient()
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: input.donorEmail?.trim() || undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "Donation",
            description: "One-time online donation",
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: metadata as unknown as Stripe.MetadataParam,
    payment_intent_data: {
      metadata: metadata as unknown as Stripe.MetadataParam,
    },
  })

  if (!session.url || !session.id) {
    throw new Error("Stripe did not return a checkout URL")
  }

  const { error: updateError } = await supabase
    .from("donation_checkout_sessions")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", checkoutRow.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    checkoutSessionId: checkoutRow.id,
    stripeCheckoutSessionId: session.id,
    checkoutUrl: session.url,
  }
}

function extractWebhookOrganizationId(event: Stripe.Event): string | null {
  const object = event.data.object as {
    metadata?: Record<string, string>
    subscription?: Stripe.Subscription | string | null
  }

  if (typeof object.metadata?.organization_id === "string") {
    return object.metadata.organization_id
  }

  if (
    typeof object.subscription === "object" &&
    object.subscription &&
    typeof object.subscription.metadata?.organization_id === "string"
  ) {
    return object.subscription.metadata.organization_id
  }

  return null
}

export async function processStripeDonationWebhookEvent(
  supabase: SupabaseClient,
  event: Stripe.Event
) {
  const payload = event.data.object as unknown as Record<string, unknown>
  const organizationId = extractWebhookOrganizationId(event)

  const eventRecord = await recordProcessorEvent(supabase, {
    stripeEventId: event.id,
    eventType: event.type,
    stripeObjectId:
      typeof (event.data.object as { id?: string }).id === "string"
        ? (event.data.object as { id?: string }).id!
        : null,
    organizationId,
    payload: payload as Record<string, unknown>,
    processingStatus: "processed",
  })

  if (eventRecord.duplicate) {
    return { ok: true as const, duplicate: true as const }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const result = await handleCheckoutSessionCompleted(
          supabase,
          event.data.object as Stripe.Checkout.Session
        )
        return { ok: true as const, duplicate: false as const, result }
      }
      case "payment_intent.succeeded": {
        const result = await handlePaymentIntentSucceeded(
          supabase,
          event.data.object as Stripe.PaymentIntent
        )
        return { ok: true as const, duplicate: false as const, result }
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const manarateeCheckoutId = paymentIntent.metadata?.manaratee_checkout_id
        const checkoutSessionId = await markCheckoutSessionStatus(supabase, {
          manarateeCheckoutId,
          status: "failed",
        })
        return {
          ok: true as const,
          duplicate: false as const,
          result: { handled: true, checkoutSessionId, status: "failed" },
        }
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = session.metadata ?? {}
        if (metadata.checkout_type === "recurring_setup") {
          const checkoutSessionId = await handleRecurringCheckoutExpiredOrFailed(supabase, {
            manarateeCheckoutId: metadata.manaratee_checkout_id,
            stripeCheckoutSessionId: session.id,
            status: "expired",
          })
          return {
            ok: true as const,
            duplicate: false as const,
            result: { handled: true, checkoutSessionId, status: "expired" },
          }
        }
        const checkoutSessionId = await markCheckoutSessionStatus(supabase, {
          manarateeCheckoutId: session.metadata?.manaratee_checkout_id,
          stripeCheckoutSessionId: session.id,
          status: "expired",
        })
        return {
          ok: true as const,
          duplicate: false as const,
          result: { handled: true, checkoutSessionId, status: "expired" },
        }
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const result = await handleInvoicePaid(
          supabase,
          event.data.object as Stripe.Invoice
        )
        return { ok: true as const, duplicate: false as const, result }
      }
      case "invoice.payment_failed": {
        const result = await handleInvoicePaymentFailed(
          supabase,
          event.data.object as Stripe.Invoice
        )
        return { ok: true as const, duplicate: false as const, result }
      }
      case "customer.subscription.updated": {
        const result = await handleSubscriptionUpdated(
          supabase,
          event.data.object as Stripe.Subscription
        )
        return { ok: true as const, duplicate: false as const, result }
      }
      case "customer.subscription.deleted": {
        const result = await handleSubscriptionDeleted(
          supabase,
          event.data.object as Stripe.Subscription
        )
        return { ok: true as const, duplicate: false as const, result }
      }
      case "charge.refunded": {
        const result = await syncPaymentRefundFromStripeCharge(
          supabase,
          event.data.object as Stripe.Charge
        )
        return { ok: true as const, duplicate: false as const, result }
      }
      default: {
        await supabase
          .from("payment_processor_events")
          .update({ processing_status: "ignored" })
          .eq("stripe_event_id", event.id)
        return { ok: true as const, duplicate: false as const, ignored: true as const }
      }
    }
  } catch (error) {
    await supabase
      .from("payment_processor_events")
      .update({
        processing_status: "failed",
        error_message: error instanceof Error ? error.message : "Webhook handler failed",
      })
      .eq("stripe_event_id", event.id)

    throw error
  }
}
