/**
 * Stripe one-time donation webhook processor helpers for validation scripts.
 */
import { createClient } from "@supabase/supabase-js"

function optionalUuid(value) {
  const trimmed = String(value ?? "").trim()
  return trimmed || null
}

function parseMetadata(metadata) {
  if (!metadata?.organization_id || !metadata?.donor_id || !metadata?.contact_id) {
    return null
  }
  return {
    organization_id: metadata.organization_id,
    donor_id: metadata.donor_id,
    contact_id: metadata.contact_id,
    campaign_id: optionalUuid(metadata.campaign_id),
    category_id: optionalUuid(metadata.category_id),
    subcategory_id: optionalUuid(metadata.subcategory_id),
    checkout_type: metadata.checkout_type,
    manaratee_checkout_id: metadata.manaratee_checkout_id,
  }
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

async function loadCheckoutSession(sb, { manarateeCheckoutId, stripeCheckoutSessionId }) {
  if (manarateeCheckoutId) {
    const { data } = await sb
      .from("donation_checkout_sessions")
      .select("id, organization_id, donor_id, contact_id, campaign_id, category_id, subcategory_id, payment_id, status")
      .eq("id", manarateeCheckoutId)
      .maybeSingle()
    if (data) return data
  }
  if (stripeCheckoutSessionId) {
    const { data } = await sb
      .from("donation_checkout_sessions")
      .select("id, organization_id, donor_id, contact_id, campaign_id, category_id, subcategory_id, payment_id, status")
      .eq("stripe_checkout_session_id", stripeCheckoutSessionId)
      .maybeSingle()
    if (data) return data
  }
  return null
}

export async function insertProcessorPaymentFromCheckout(sb, input) {
  const checkoutSession = await loadCheckoutSession(sb, {
    manarateeCheckoutId: input.metadata.manaratee_checkout_id,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
  })

  if (checkoutSession?.payment_id) {
    await maybeSyncDonorAffiliation(sb, {
      organizationId: input.metadata.organization_id,
      contactId: input.metadata.contact_id,
      donorId: input.metadata.donor_id,
      context: `checkout existing payment ${input.stripeCheckoutSessionId}`,
    })

    return {
      paymentId: checkoutSession.payment_id,
      created: false,
      checkoutSessionId: checkoutSession.id,
    }
  }

  const { data: existingByIntent } = await sb
    .from("payments")
    .select("id")
    .eq("stripe_payment_intent_id", input.stripePaymentIntentId)
    .maybeSingle()

  if (existingByIntent?.id) {
    if (checkoutSession?.id) {
      await sb
        .from("donation_checkout_sessions")
        .update({
          status: "complete",
          payment_id: existingByIntent.id,
          stripe_checkout_session_id: input.stripeCheckoutSessionId,
        })
        .eq("id", checkoutSession.id)
    }

    await maybeSyncDonorAffiliation(sb, {
      organizationId: input.metadata.organization_id,
      contactId: input.metadata.contact_id,
      donorId: input.metadata.donor_id,
      context: `payment_intent existing ${input.stripePaymentIntentId}`,
    })

    return {
      paymentId: existingByIntent.id,
      created: false,
      checkoutSessionId: checkoutSession?.id ?? null,
    }
  }

  const amount = input.amountCents / 100
  const { data: payment, error } = await sb
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
      campaign_id: input.metadata.campaign_id ?? checkoutSession?.campaign_id ?? null,
      category_id: input.metadata.category_id ?? checkoutSession?.category_id ?? null,
      subcategory_id: input.metadata.subcategory_id ?? checkoutSession?.subcategory_id ?? null,
      stripe_checkout_session_id: input.stripeCheckoutSessionId,
      stripe_payment_intent_id: input.stripePaymentIntentId,
      stripe_charge_id: input.stripeChargeId ?? null,
    })
    .select("id")
    .single()

  if (error || !payment?.id) {
    throw new Error(error?.message || "payment insert failed")
  }

  if (checkoutSession?.id) {
    await sb
      .from("donation_checkout_sessions")
      .update({
        status: "complete",
        payment_id: payment.id,
        stripe_checkout_session_id: input.stripeCheckoutSessionId,
        amount,
      })
      .eq("id", checkoutSession.id)
  }

  await maybeSyncDonorAffiliation(sb, {
    organizationId: input.metadata.organization_id,
    contactId: input.metadata.contact_id,
    donorId: input.metadata.donor_id,
    context: `checkout new payment ${input.stripeCheckoutSessionId}`,
  })

  return {
    paymentId: payment.id,
    created: true,
    checkoutSessionId: checkoutSession?.id ?? null,
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

export async function simulateCheckoutCompleted(sb, session) {
  const metadata = parseMetadata(session.metadata)
  if (!metadata || metadata.checkout_type !== "one_time") {
    throw new Error("invalid metadata")
  }

  return insertProcessorPaymentFromCheckout(sb, {
    metadata,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: session.payment_intent,
    amountCents: session.amount_total,
    paymentDate: new Date().toISOString(),
  })
}

export { parseMetadata }
