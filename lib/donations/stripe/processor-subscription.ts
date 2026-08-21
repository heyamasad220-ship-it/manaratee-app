import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import { parseDonationCheckoutMetadata } from "@/lib/donations/stripe/metadata"
import { maybeSyncDonationAffiliationFromWebhook } from "@/lib/donations/stripe/processor-payment"
import { maybeAutoGenerateAndEmailPaymentReceipt } from "@/lib/donations/stripe/receipt-after-payment"
import {
  mapStripeSubscriptionStatus,
  resolveInvoiceSubscriptionId,
  resolveStripeCustomerId,
  resolveStripePaymentIntentId,
  resolveStripeSubscriptionId,
  resolveSubscriptionPeriodEnd,
  stripePeriodEndToDateOnly,
} from "@/lib/donations/stripe/recurring-stripe-utils"
import type {
  DonationCheckoutMetadata,
  RecurringInvoicePaymentResult,
  RecurringSubscriptionLinkResult,
} from "@/lib/donations/stripe/types"
import { markCheckoutSessionStatus } from "@/lib/donations/stripe/checkout-session-utils"

type RecurringPlanRow = {
  id: string
  organization_id: string
  donor_id: string
  contact_id: string | null
  campaign_id: string | null
  campaign_group_id: string | null
  attributed_group_contact_id: string | null
  category_id: string | null
  subcategory_id: string | null
  amount: number
  frequency: string
  status: string
  next_payment_date: string
  external_processor: string | null
  external_processor_id: string | null
}

const RECURRING_PLAN_SELECT =
  "id, organization_id, donor_id, contact_id, campaign_id, campaign_group_id, attributed_group_contact_id, category_id, subcategory_id, amount, frequency, status, next_payment_date, external_processor, external_processor_id"

async function loadRecurringPlan(
  supabase: SupabaseClient,
  input: { planId?: string | null; stripeSubscriptionId?: string | null }
): Promise<RecurringPlanRow | null> {
  if (input.planId) {
    const { data } = await supabase
      .from("recurring_donation_plans")
      .select(RECURRING_PLAN_SELECT)
      .eq("id", input.planId)
      .maybeSingle()
    if (data) return normalizeRecurringPlanRow(data)
  }

  if (input.stripeSubscriptionId) {
    const { data } = await supabase
      .from("recurring_donation_plans")
      .select(RECURRING_PLAN_SELECT)
      .eq("external_processor", "stripe")
      .eq("external_processor_id", input.stripeSubscriptionId)
      .maybeSingle()
    if (data) return normalizeRecurringPlanRow(data)
  }

  return null
}

function normalizeRecurringPlanRow(data: Record<string, unknown>): RecurringPlanRow {
  return {
    id: data.id as string,
    organization_id: data.organization_id as string,
    donor_id: data.donor_id as string,
    contact_id: (data.contact_id as string | null) ?? null,
    campaign_id: (data.campaign_id as string | null) ?? null,
    campaign_group_id: (data.campaign_group_id as string | null) ?? null,
    attributed_group_contact_id: (data.attributed_group_contact_id as string | null) ?? null,
    category_id: (data.category_id as string | null) ?? null,
    subcategory_id: (data.subcategory_id as string | null) ?? null,
    amount: Number(data.amount || 0),
    frequency: data.frequency as string,
    status: data.status as string,
    next_payment_date: data.next_payment_date as string,
    external_processor: (data.external_processor as string | null) ?? null,
    external_processor_id: (data.external_processor_id as string | null) ?? null,
  }
}

async function completeRecurringCheckoutSession(
  supabase: SupabaseClient,
  input: {
    manarateeCheckoutId?: string | null
    stripeCheckoutSessionId?: string | null
    recurringDonationPlanId: string
  }
) {
  let query = supabase.from("donation_checkout_sessions").update({
    status: "complete",
    recurring_donation_plan_id: input.recurringDonationPlanId,
  })

  if (input.manarateeCheckoutId) {
    query = query.eq("id", input.manarateeCheckoutId)
  } else if (input.stripeCheckoutSessionId) {
    query = query.eq("stripe_checkout_session_id", input.stripeCheckoutSessionId)
  } else {
    return null
  }

  const { data } = await query.select("id").maybeSingle()
  return data?.id ?? null
}

export async function handleRecurringCheckoutSessionCompleted(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<RecurringSubscriptionLinkResult | { handled: false; reason: string }> {
  const metadata = parseDonationCheckoutMetadata(
    (session.metadata ?? {}) as Record<string, string>
  )

  if (!metadata || metadata.checkout_type !== "recurring_setup") {
    return { handled: false, reason: "unsupported_checkout_type" }
  }

  const subscriptionId = resolveStripeSubscriptionId(session.subscription)
  if (!subscriptionId) {
    return { handled: false, reason: "missing_subscription" }
  }

  const planId = metadata.recurring_donation_plan_id
  if (!planId) {
    return { handled: false, reason: "missing_plan_id" }
  }

  const plan = await loadRecurringPlan(supabase, { planId })
  if (!plan) {
    return { handled: false, reason: "plan_not_found" }
  }

  const customerId = resolveStripeCustomerId(session.customer)
  const nextPaymentDate =
    stripePeriodEndToDateOnly(
      resolveSubscriptionPeriodEnd(session.subscription)
    ) ?? plan.next_payment_date

  const alreadyLinked =
    plan.external_processor === "stripe" && plan.external_processor_id === subscriptionId

  if (!alreadyLinked) {
    const { error } = await supabase
      .from("recurring_donation_plans")
      .update({
        external_processor: "stripe",
        external_processor_id: subscriptionId,
        stripe_customer_id: customerId,
        status: "active",
        next_payment_date: nextPaymentDate,
        notes: null,
      })
      .eq("id", planId)
      .eq("organization_id", metadata.organization_id)

    if (error) {
      throw new Error(error.message)
    }
  }

  const checkoutSessionId = await completeRecurringCheckoutSession(supabase, {
    manarateeCheckoutId: metadata.manaratee_checkout_id,
    stripeCheckoutSessionId: session.id,
    recurringDonationPlanId: planId,
  })

  await maybeSyncDonationAffiliationFromWebhook(supabase, {
    organizationId: metadata.organization_id,
    contactId: plan.contact_id ?? metadata.contact_id,
    donorId: plan.donor_id ?? metadata.donor_id,
    context: `recurring checkout ${session.id}`,
  })

  return {
    planId,
    linked: !alreadyLinked,
    checkoutSessionId,
  }
}

async function resolvePlanForInvoice(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice,
  metadata?: DonationCheckoutMetadata | null
): Promise<RecurringPlanRow | null> {
  if (metadata?.recurring_donation_plan_id) {
    const plan = await loadRecurringPlan(supabase, {
      planId: metadata.recurring_donation_plan_id,
    })
    if (plan) return plan
  }

  const subscriptionId = resolveInvoiceSubscriptionId(invoice)
  if (subscriptionId) {
    return loadRecurringPlan(supabase, { stripeSubscriptionId: subscriptionId })
  }

  return null
}

async function syncRecurringDonationAffiliation(
  supabase: SupabaseClient,
  input: {
    planId?: string | null
    metadata?: DonationCheckoutMetadata | null
    context: string
  }
) {
  let organizationId = input.metadata?.organization_id ?? ""
  let contactId = input.metadata?.contact_id ?? null
  let donorId = input.metadata?.donor_id ?? null

  if (input.planId) {
    const plan = await loadRecurringPlan(supabase, { planId: input.planId })
    if (plan) {
      organizationId = plan.organization_id
      contactId = plan.contact_id ?? contactId
      donorId = plan.donor_id ?? donorId
    }
  }

  await maybeSyncDonationAffiliationFromWebhook(supabase, {
    organizationId,
    contactId,
    donorId,
    context: input.context,
  })
}

export async function insertProcessorPaymentFromInvoice(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice,
  metadata?: DonationCheckoutMetadata | null
): Promise<RecurringInvoicePaymentResult | { handled: false; reason: string }> {
  if (!invoice.id) {
    return { handled: false, reason: "missing_invoice_id" }
  }

  const amountPaid = invoice.amount_paid ?? 0
  if (amountPaid <= 0) {
    return { handled: false, reason: "zero_amount" }
  }

  const rawInvoice = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }

  const { data: existingByInvoice } = await supabase
    .from("payments")
    .select("id, recurring_donation_plan_id")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle()

  if (existingByInvoice?.id) {
    await syncRecurringDonationAffiliation(supabase, {
      planId: existingByInvoice.recurring_donation_plan_id as string,
      metadata,
      context: `invoice existing ${invoice.id}`,
    })

    return {
      paymentId: existingByInvoice.id,
      created: false,
      planId: existingByInvoice.recurring_donation_plan_id as string,
    }
  }

  const paymentIntentId = resolveStripePaymentIntentId(invoice)
  if (paymentIntentId) {
    const { data: existingByIntent } = await supabase
      .from("payments")
      .select("id, recurring_donation_plan_id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle()

    if (existingByIntent?.id) {
      await syncRecurringDonationAffiliation(supabase, {
        planId: existingByIntent.recurring_donation_plan_id as string,
        metadata,
        context: `invoice existing payment_intent ${paymentIntentId}`,
      })

      return {
        paymentId: existingByIntent.id,
        created: false,
        planId: existingByIntent.recurring_donation_plan_id as string,
      }
    }
  }

  const subscriptionMetadata = parseDonationCheckoutMetadata(
    (typeof rawInvoice.subscription === "object" && rawInvoice.subscription
      ? (rawInvoice.subscription.metadata ?? {})
      : {}) as Record<string, string>
  )

  const plan = await resolvePlanForInvoice(supabase, invoice, metadata ?? subscriptionMetadata)
  if (!plan?.id) {
    return { handled: false, reason: "plan_not_found" }
  }

  const paymentDate = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
    : new Date().toISOString()

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      organization_id: plan.organization_id,
      donor_id: plan.donor_id,
      contact_id: plan.contact_id,
      pledge_id: null,
      recurring_donation_plan_id: plan.id,
      sender_name: null,
      amount: amountPaid / 100,
      payment_date: paymentDate,
      source: "stripe",
      source_type: "processor",
      status: "unallocated",
      is_verified: true,
      campaign_id: plan.campaign_id,
      campaign_group_id: plan.campaign_group_id,
      attributed_group_contact_id: plan.attributed_group_contact_id,
      category_id: plan.category_id,
      subcategory_id: plan.subcategory_id,
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: paymentIntentId,
      memo: `Recurring donation — ${plan.frequency}`,
    })
    .select("id")
    .single()

  if (paymentError || !payment?.id) {
    throw new Error(paymentError?.message || "Could not insert recurring processor payment")
  }

  const subscriptionId = resolveInvoiceSubscriptionId(invoice)
  let nextPaymentDate = plan.next_payment_date
  if (subscriptionId) {
    const periodEnd =
      resolveSubscriptionPeriodEnd(rawInvoice.subscription) ??
      invoice.lines?.data?.[0]?.period?.end ??
      null
    nextPaymentDate = stripePeriodEndToDateOnly(periodEnd) ?? plan.next_payment_date
  }

  await supabase
    .from("recurring_donation_plans")
    .update({
      status: "active",
      next_payment_date: nextPaymentDate,
    })
    .eq("id", plan.id)
    .eq("organization_id", plan.organization_id)

  await maybeAutoGenerateAndEmailPaymentReceipt(
    supabase,
    plan.organization_id,
    payment.id
  )

  await syncRecurringDonationAffiliation(supabase, {
    planId: plan.id,
    metadata: metadata ?? subscriptionMetadata,
    context: `invoice new payment ${invoice.id}`,
  })

  return {
    paymentId: payment.id,
    created: true,
    planId: plan.id,
  }
}

export async function handleInvoicePaid(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice
) {
  const metadata = parseDonationCheckoutMetadata(
    (invoice.metadata ?? {}) as Record<string, string>
  )

  const result = await insertProcessorPaymentFromInvoice(supabase, invoice, metadata)
  if ("handled" in result && result.handled === false) {
    return result
  }
  return { handled: true as const, ...result }
}

export async function handleInvoicePaymentFailed(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice
) {
  const subscriptionId = resolveInvoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    return { handled: false as const, reason: "missing_subscription" }
  }

  const plan = await loadRecurringPlan(supabase, { stripeSubscriptionId: subscriptionId })
  if (!plan?.id) {
    return { handled: false as const, reason: "plan_not_found" }
  }

  await supabase
    .from("recurring_donation_plans")
    .update({ status: "past_due" })
    .eq("id", plan.id)
    .eq("organization_id", plan.organization_id)

  return { handled: true as const, planId: plan.id, status: "past_due" as const }
}

export async function handleSubscriptionUpdated(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const plan = await loadRecurringPlan(supabase, {
    stripeSubscriptionId: subscription.id,
    planId: subscription.metadata?.recurring_donation_plan_id,
  })

  if (!plan?.id) {
    return { handled: false as const, reason: "plan_not_found" }
  }

  const mappedStatus = mapStripeSubscriptionStatus(subscription.status)
  const nextPaymentDate =
    stripePeriodEndToDateOnly(resolveSubscriptionPeriodEnd(subscription)) ??
    plan.next_payment_date

  await supabase
    .from("recurring_donation_plans")
    .update({
      status: mappedStatus,
      next_payment_date: nextPaymentDate,
      stripe_customer_id: resolveStripeCustomerId(subscription.customer),
    })
    .eq("id", plan.id)
    .eq("organization_id", plan.organization_id)

  return {
    handled: true as const,
    planId: plan.id,
    status: mappedStatus,
    nextPaymentDate,
  }
}

export async function handleSubscriptionDeleted(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription
) {
  const plan = await loadRecurringPlan(supabase, {
    stripeSubscriptionId: subscription.id,
    planId: subscription.metadata?.recurring_donation_plan_id,
  })

  if (!plan?.id) {
    return { handled: false as const, reason: "plan_not_found" }
  }

  await supabase
    .from("recurring_donation_plans")
    .update({ status: "cancelled" })
    .eq("id", plan.id)
    .eq("organization_id", plan.organization_id)

  return { handled: true as const, planId: plan.id, status: "cancelled" as const }
}

export async function handleRecurringCheckoutExpiredOrFailed(
  supabase: SupabaseClient,
  input: {
    manarateeCheckoutId?: string | null
    stripeCheckoutSessionId?: string | null
    status: "expired" | "failed"
  }
) {
  const checkoutSessionId = await markCheckoutSessionStatus(supabase, input)

  if (input.manarateeCheckoutId) {
    const { data: checkoutSession } = await supabase
      .from("donation_checkout_sessions")
      .select("recurring_donation_plan_id")
      .eq("id", input.manarateeCheckoutId)
      .maybeSingle()

    if (checkoutSession?.recurring_donation_plan_id) {
      await supabase
        .from("recurring_donation_plans")
        .update({ status: "cancelled", notes: `Checkout ${input.status}` })
        .eq("id", checkoutSession.recurring_donation_plan_id)
        .eq("status", "pending_setup")
    }
  }

  return checkoutSessionId
}
