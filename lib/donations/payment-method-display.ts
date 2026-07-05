import type { SupabaseClient } from "@supabase/supabase-js"

import {
  extractStripeCardLast4FromProcessorPayload,
  formatFinancialTimelinePaymentMethod,
  normalizePaymentSourceChannel,
} from "@/lib/donations/payment-source-channel"

export type PaymentMethodDisplayFields = {
  source?: string | null
  stripe_payment_intent_id?: string | null
  method_display?: string | null
}

export async function loadStripeCardLast4ByPaymentIntentIds(
  supabase: SupabaseClient,
  organizationId: string,
  paymentIntentIds: string[]
) {
  const map = new Map<string, string>()
  const uniqueIds = [...new Set(paymentIntentIds.filter(Boolean))]
  if (uniqueIds.length === 0) return map

  const { data, error } = await supabase
    .from("payment_processor_events")
    .select("stripe_object_id, payload")
    .eq("organization_id", organizationId)
    .in("stripe_object_id", uniqueIds)
    .in("event_type", ["payment_intent.succeeded", "checkout.session.completed"])
    .order("created_at", { ascending: false })

  if (error) {
    console.warn("Could not load Stripe card metadata for payments:", error.message)
    return map
  }

  for (const row of data || []) {
    const intentId = String(row.stripe_object_id || "").trim()
    if (!intentId || map.has(intentId)) continue

    const last4 = extractStripeCardLast4FromProcessorPayload(row.payload)
    if (last4) map.set(intentId, last4)
  }

  return map
}

export function resolvePaymentMethodDisplayLabel(
  payment: Pick<PaymentMethodDisplayFields, "source" | "stripe_payment_intent_id">,
  stripeCardLast4ByIntentId: Map<string, string>
): string | null {
  const intentId = payment.stripe_payment_intent_id?.trim() || null
  const stripeCardLast4 = intentId ? stripeCardLast4ByIntentId.get(intentId) ?? null : null

  return formatFinancialTimelinePaymentMethod({
    source: payment.source,
    stripeCardLast4,
  })
}

export async function attachPaymentMethodDisplayLabels<
  T extends PaymentMethodDisplayFields,
>(supabase: SupabaseClient, organizationId: string, payments: T[]): Promise<T[]> {
  if (payments.length === 0) return payments

  const stripeCardLast4ByIntentId = await loadStripeCardLast4ByPaymentIntentIds(
    supabase,
    organizationId,
    payments
      .filter((payment) => normalizePaymentSourceChannel(payment.source) === "stripe")
      .map((payment) => payment.stripe_payment_intent_id ?? null)
  )

  for (const payment of payments) {
    payment.method_display = resolvePaymentMethodDisplayLabel(payment, stripeCardLast4ByIntentId)
  }

  return payments
}
