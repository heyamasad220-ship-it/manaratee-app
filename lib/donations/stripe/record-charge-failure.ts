import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

type ChargeKind = "one_time" | "pledge" | "recurring"

type ChargeFailureInsert = {
  organization_id: string
  occurred_at: string
  amount: number | null
  currency: string
  donor_id: string | null
  contact_id: string | null
  campaign_id: string | null
  pledge_id: string | null
  recurring_donation_plan_id: string | null
  checkout_session_id: string | null
  charge_kind: ChargeKind
  stripe_payment_intent_id: string | null
  stripe_invoice_id: string | null
  stripe_charge_id: string | null
  decline_code: string | null
  failure_code: string | null
  failure_message: string | null
  card_brand: string | null
  card_last4: string | null
}

function optionalId(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim()
  return trimmed || null
}

function centsToAmount(cents: number | null | undefined) {
  if (cents == null || !Number.isFinite(cents)) return null
  return cents / 100
}

function chargeKindFromCheckout(checkoutType: string | null | undefined, pledgeId: string | null, planId: string | null): ChargeKind {
  if (checkoutType === "recurring_setup" || planId) return "recurring"
  if (checkoutType === "pledge" || pledgeId) return "pledge"
  return "one_time"
}

type DeclineError = {
  code?: string | null
  decline_code?: string | null
  message?: string | null
  charge?: string | { id?: string | null } | null
  payment_method?: unknown
}

function cardFromPaymentMethod(paymentMethod: unknown) {
  if (!paymentMethod || typeof paymentMethod !== "object") {
    return { brand: null, last4: null }
  }
  const card = (paymentMethod as { card?: { brand?: string | null; last4?: string | null } | null }).card
  return {
    brand: card?.brand ?? null,
    last4: card?.last4 ?? null,
  }
}

function chargeIdFromError(error: DeclineError | null | undefined) {
  const charge = error?.charge
  if (!charge) return null
  return typeof charge === "string" ? charge : charge.id ?? null
}

async function failureAlreadyRecorded(
  supabase: SupabaseClient,
  input: { paymentIntentId?: string | null; invoiceId?: string | null }
) {
  if (input.paymentIntentId) {
    const { data } = await supabase
      .from("donation_charge_failures")
      .select("id")
      .eq("stripe_payment_intent_id", input.paymentIntentId)
      .maybeSingle()
    if (data?.id) return true
  }
  if (input.invoiceId) {
    const { data } = await supabase
      .from("donation_charge_failures")
      .select("id")
      .eq("stripe_invoice_id", input.invoiceId)
      .maybeSingle()
    if (data?.id) return true
  }
  return false
}

async function insertChargeFailure(supabase: SupabaseClient, row: ChargeFailureInsert) {
  if (await failureAlreadyRecorded(supabase, {
    paymentIntentId: row.stripe_payment_intent_id,
    invoiceId: row.stripe_invoice_id,
  })) {
    return { created: false as const }
  }

  const { error } = await supabase.from("donation_charge_failures").insert(row)
  if (error) {
    if (error.code === "23505") return { created: false as const }
    throw new Error(error.message)
  }
  return { created: true as const }
}

export async function recordChargeFailureFromPaymentIntent(
  supabase: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent
) {
  const metadata = paymentIntent.metadata ?? {}
  const checkoutId = optionalId(metadata.manaratee_checkout_id)
  let checkout: {
    id: string
    organization_id: string
    donor_id: string | null
    contact_id: string | null
    campaign_id: string | null
    pledge_id: string | null
    recurring_donation_plan_id: string | null
    checkout_type: string | null
    amount: number | null
    currency: string | null
  } | null = null

  if (checkoutId) {
    const { data } = await supabase
      .from("donation_checkout_sessions")
      .select(
        "id, organization_id, donor_id, contact_id, campaign_id, pledge_id, recurring_donation_plan_id, checkout_type, amount, currency"
      )
      .eq("id", checkoutId)
      .maybeSingle()
    checkout = data
  }

  const organizationId = optionalId(metadata.organization_id) ?? checkout?.organization_id ?? null
  if (!organizationId || !paymentIntent.id) {
    return { created: false as const, skipped: "missing_organization" as const }
  }

  const lastError = (paymentIntent.last_payment_error ?? null) as DeclineError | null
  const card = cardFromPaymentMethod(lastError?.payment_method)
  const pledgeId = optionalId(metadata.pledge_id) ?? checkout?.pledge_id ?? null
  const planId = optionalId(metadata.recurring_donation_plan_id) ?? checkout?.recurring_donation_plan_id ?? null

  return insertChargeFailure(supabase, {
    organization_id: organizationId,
    occurred_at: new Date().toISOString(),
    amount: centsToAmount(paymentIntent.amount) ?? (checkout?.amount != null ? Number(checkout.amount) : null),
    currency: (paymentIntent.currency || checkout?.currency || "usd").toUpperCase(),
    donor_id: optionalId(metadata.donor_id) ?? checkout?.donor_id ?? null,
    contact_id: optionalId(metadata.contact_id) ?? checkout?.contact_id ?? null,
    campaign_id: optionalId(metadata.campaign_id) ?? checkout?.campaign_id ?? null,
    pledge_id: pledgeId,
    recurring_donation_plan_id: planId,
    checkout_session_id: checkout?.id ?? null,
    charge_kind: chargeKindFromCheckout(metadata.checkout_type ?? checkout?.checkout_type, pledgeId, planId),
    stripe_payment_intent_id: paymentIntent.id,
    stripe_invoice_id: null,
    stripe_charge_id: chargeIdFromError(lastError),
    decline_code: lastError?.decline_code ?? null,
    failure_code: lastError?.code ?? null,
    failure_message: lastError?.message ?? null,
    card_brand: card.brand,
    card_last4: card.last4,
  })
}

export async function recordChargeFailureFromInvoice(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice,
  plan: {
    id: string
    organization_id: string
    donor_id: string
    contact_id: string | null
    campaign_id: string | null
    pledge_id: string | null
    amount: number
  }
) {
  if (!invoice.id) return { created: false as const, skipped: "missing_invoice" as const }

  const raw = invoice as Stripe.Invoice & {
    payment_intent?: string | Stripe.PaymentIntent | null
    last_finalization_error?: { code?: string | null; message?: string | null } | null
  }
  const paymentIntent = raw.payment_intent && typeof raw.payment_intent === "object" ? raw.payment_intent : null
  const paymentIntentId =
    typeof raw.payment_intent === "string" ? raw.payment_intent : paymentIntent?.id ?? null
  const lastError = (paymentIntent?.last_payment_error ?? null) as DeclineError | null
  const card = cardFromPaymentMethod(lastError?.payment_method)
  const amountDue = centsToAmount(invoice.amount_due)

  return insertChargeFailure(supabase, {
    organization_id: plan.organization_id,
    occurred_at: new Date().toISOString(),
    amount: amountDue != null && amountDue > 0 ? amountDue : Number(plan.amount || 0),
    currency: (invoice.currency || "usd").toUpperCase(),
    donor_id: plan.donor_id,
    contact_id: plan.contact_id,
    campaign_id: plan.campaign_id,
    pledge_id: plan.pledge_id,
    recurring_donation_plan_id: plan.id,
    checkout_session_id: null,
    charge_kind: "recurring",
    stripe_payment_intent_id: paymentIntentId,
    stripe_invoice_id: invoice.id,
    stripe_charge_id: chargeIdFromError(lastError),
    decline_code: lastError?.decline_code ?? null,
    failure_code: lastError?.code ?? raw.last_finalization_error?.code ?? null,
    failure_message: lastError?.message ?? raw.last_finalization_error?.message ?? null,
    card_brand: card.brand,
    card_last4: card.last4,
  })
}
