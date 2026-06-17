/**
 * Stripe recurring donation webhook processor helpers for validation scripts.
 */
import { createClient } from "@supabase/supabase-js"

function parseMetadata(metadata) {
  if (!metadata?.organization_id || !metadata?.donor_id || !metadata?.contact_id) {
    return null
  }
  return {
    organization_id: metadata.organization_id,
    donor_id: metadata.donor_id,
    contact_id: metadata.contact_id,
    campaign_id: metadata.campaign_id ?? null,
    category_id: metadata.category_id ?? null,
    subcategory_id: metadata.subcategory_id ?? null,
    recurring_donation_plan_id: metadata.recurring_donation_plan_id ?? null,
    checkout_type: metadata.checkout_type,
    manaratee_checkout_id: metadata.manaratee_checkout_id,
  }
}

function stripePeriodEndToDateOnly(periodEndUnix) {
  if (!periodEndUnix) return null
  const date = new Date(periodEndUnix * 1000)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

async function maybeSyncDonorAffiliation(sb, input) {
  const organizationId = input.organizationId?.trim?.() ?? input.organizationId
  if (!organizationId || (!input.contactId && !input.donorId)) return

  try {
    let contactId = input.contactId ?? null
    if (!contactId && input.donorId) {
      const { data: donor } = await sb
        .from("donors")
        .select("contact_id")
        .eq("organization_id", organizationId)
        .eq("id", input.donorId)
        .maybeSingle()
      contactId = donor?.contact_id ?? null
    }
    if (!contactId) return

    const { count: paymentByContactCount } = await sb
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)

    let shouldSync = (paymentByContactCount ?? 0) > 0

    if (!shouldSync && input.donorId) {
      const { count: paymentByDonorCount } = await sb
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("donor_id", input.donorId)

      shouldSync = (paymentByDonorCount ?? 0) > 0
    }

    if (shouldSync) {
      const { error } = await sb.from("contact_roles").insert({
        organization_id: organizationId,
        contact_id: contactId,
        role: "donor",
        is_manual: false,
      })
      if (error && error.code !== "23505") {
        throw new Error(error.message)
      }
    }
  } catch (error) {
    console.error(
      `[validate-stripe] donation affiliation sync failed (${input.context}): ${
        error?.message || error
      }`
    )
  }
}

async function syncAffiliationForPlan(sb, input) {
  let organizationId = input.metadata?.organization_id ?? ""
  let contactId = input.metadata?.contact_id ?? null
  let donorId = input.metadata?.donor_id ?? null

  if (input.planId) {
    const { data: plan } = await sb
      .from("recurring_donation_plans")
      .select("organization_id, donor_id, contact_id")
      .eq("id", input.planId)
      .maybeSingle()

    if (plan) {
      organizationId = plan.organization_id
      contactId = plan.contact_id ?? contactId
      donorId = plan.donor_id ?? donorId
    }
  }

  await maybeSyncDonorAffiliation(sb, {
    organizationId,
    contactId,
    donorId,
    context: input.context,
  })
}

export async function simulateRecurringCheckoutCompleted(sb, session) {
  const metadata = parseMetadata(session.metadata)
  if (!metadata || metadata.checkout_type !== "recurring_setup") {
    throw new Error("invalid recurring metadata")
  }

  const subscriptionId = session.subscription
  if (!subscriptionId || !metadata.recurring_donation_plan_id) {
    throw new Error("missing subscription or plan id")
  }

  const nextPaymentDate =
    stripePeriodEndToDateOnly(session.subscription_period_end) ?? new Date().toISOString().slice(0, 10)

  const { error: planError } = await sb
    .from("recurring_donation_plans")
    .update({
      external_processor: "stripe",
      external_processor_id: subscriptionId,
      stripe_customer_id: session.customer ?? null,
      status: "active",
      next_payment_date: nextPaymentDate,
      notes: null,
    })
    .eq("id", metadata.recurring_donation_plan_id)

  if (planError) throw new Error(planError.message)

  const { data: checkoutAfter } = await sb
    .from("donation_checkout_sessions")
    .update({
      status: "complete",
      recurring_donation_plan_id: metadata.recurring_donation_plan_id,
    })
    .eq("id", metadata.manaratee_checkout_id)
    .select("id")
    .maybeSingle()

  await maybeSyncDonorAffiliation(sb, {
    organizationId: metadata.organization_id,
    contactId: metadata.contact_id,
    donorId: metadata.donor_id,
    context: `recurring checkout ${session.id}`,
  })

  return {
    planId: metadata.recurring_donation_plan_id,
    linked: true,
    checkoutSessionId: checkoutAfter?.id ?? metadata.manaratee_checkout_id,
  }
}

export async function simulateInvoicePaid(sb, invoice) {
  if (!invoice.id) throw new Error("missing invoice id")

  const amountPaid = invoice.amount_paid ?? 0
  if (amountPaid <= 0) throw new Error("zero amount")

  const { data: existingByInvoice } = await sb
    .from("payments")
    .select("id, recurring_donation_plan_id")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle()

  if (existingByInvoice?.id) {
    await syncAffiliationForPlan(sb, {
      planId: existingByInvoice.recurring_donation_plan_id,
      metadata: invoice.metadata,
      context: `invoice existing ${invoice.id}`,
    })

    return {
      paymentId: existingByInvoice.id,
      created: false,
      planId: existingByInvoice.recurring_donation_plan_id,
    }
  }

  const paymentIntentId = invoice.payment_intent ?? null
  if (paymentIntentId) {
    const { data: existingByIntent } = await sb
      .from("payments")
      .select("id, recurring_donation_plan_id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle()

    if (existingByIntent?.id) {
      await syncAffiliationForPlan(sb, {
        planId: existingByIntent.recurring_donation_plan_id,
        metadata: invoice.metadata,
        context: `invoice existing payment_intent ${paymentIntentId}`,
      })

      return {
        paymentId: existingByIntent.id,
        created: false,
        planId: existingByIntent.recurring_donation_plan_id,
      }
    }
  }

  const planId = invoice.metadata?.recurring_donation_plan_id
  if (!planId) throw new Error("missing plan id on invoice")

  const { data: plan, error: planError } = await sb
    .from("recurring_donation_plans")
    .select(
      "id, organization_id, donor_id, contact_id, campaign_id, category_id, subcategory_id, frequency, next_payment_date"
    )
    .eq("id", planId)
    .single()

  if (planError || !plan) throw new Error(planError?.message || "plan not found")

  const { data: payment, error: paymentError } = await sb
    .from("payments")
    .insert({
      organization_id: plan.organization_id,
      donor_id: plan.donor_id,
      contact_id: plan.contact_id,
      pledge_id: null,
      recurring_donation_plan_id: plan.id,
      amount: amountPaid / 100,
      payment_date: new Date().toISOString(),
      source: "stripe",
      source_type: "processor",
      status: "unallocated",
      is_verified: true,
      campaign_id: plan.campaign_id,
      category_id: plan.category_id,
      subcategory_id: plan.subcategory_id,
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: paymentIntentId,
      memo: `Recurring donation — ${plan.frequency}`,
    })
    .select("id")
    .single()

  if (paymentError || !payment?.id) {
    throw new Error(paymentError?.message || "payment insert failed")
  }

  const nextPaymentDate =
    stripePeriodEndToDateOnly(invoice.period_end) ?? plan.next_payment_date

  await sb
    .from("recurring_donation_plans")
    .update({ status: "active", next_payment_date: nextPaymentDate })
    .eq("id", plan.id)

  await syncAffiliationForPlan(sb, {
    planId: plan.id,
    metadata: invoice.metadata,
    context: `invoice new payment ${invoice.id}`,
  })

  return {
    paymentId: payment.id,
    created: true,
    planId: plan.id,
  }
}

export async function recordProcessorEvent(sb, input) {
  const { data, error } = await sb
    .from("payment_processor_events")
    .insert({
      organization_id: input.organizationId ?? null,
      stripe_event_id: input.stripeEventId,
      event_type: input.eventType,
      stripe_object_id: input.stripeObjectId ?? null,
      payment_id: input.paymentId ?? null,
      checkout_session_id: input.checkoutSessionId ?? null,
      payload: input.payload ?? {},
      processing_status: input.processingStatus ?? "processed",
      error_message: input.errorMessage ?? null,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") return { duplicate: true }
    throw new Error(error.message)
  }

  return { duplicate: false, eventId: data.id }
}

export { parseMetadata }
