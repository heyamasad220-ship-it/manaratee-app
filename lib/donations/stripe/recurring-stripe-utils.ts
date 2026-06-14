import type Stripe from "stripe"

import type { RecurringStripeFrequency } from "@/lib/donations/stripe/types"

export function stripeRecurringInterval(
  frequency: RecurringStripeFrequency
): Pick<Stripe.PriceCreateParams.Recurring, "interval" | "interval_count"> {
  switch (frequency) {
    case "monthly":
      return { interval: "month", interval_count: 1 }
    case "quarterly":
      return { interval: "month", interval_count: 3 }
    case "annually":
      return { interval: "year", interval_count: 1 }
    default:
      return { interval: "month", interval_count: 1 }
  }
}

export function stripePeriodEndToDateOnly(periodEndUnix: number | null | undefined): string | null {
  if (!periodEndUnix) return null
  const date = new Date(periodEndUnix * 1000)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function mapStripeSubscriptionStatus(
  stripeStatus: string
): "active" | "paused" | "past_due" | "cancelled" | "completed" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active"
    case "paused":
      return "paused"
    case "past_due":
    case "unpaid":
      return "past_due"
    case "canceled":
      return "cancelled"
    case "incomplete_expired":
      return "cancelled"
    default:
      return "active"
  }
}

export function resolveStripeSubscriptionId(
  value: string | Stripe.Subscription | null | undefined
): string | null {
  if (!value) return null
  return typeof value === "string" ? value : value.id ?? null
}

export function resolveInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
    parent?: {
      subscription_details?: { subscription?: string | Stripe.Subscription | null }
    } | null
  }

  const direct = resolveStripeSubscriptionId(raw.subscription)
  if (direct) return direct

  return resolveStripeSubscriptionId(raw.parent?.subscription_details?.subscription)
}

export function resolveStripeCustomerId(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null {
  if (!value) return null
  return typeof value === "string" ? value : value.id ?? null
}

export function resolveStripePaymentIntentId(
  invoice: Stripe.Invoice
): string | null {
  const raw = invoice as Stripe.Invoice & {
    payment_intent?: string | Stripe.PaymentIntent | null
  }
  const paymentIntent = raw.payment_intent
  if (!paymentIntent) return null
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id ?? null
}

export function resolveSubscriptionPeriodEnd(
  subscription: Stripe.Subscription | string | null | undefined
): number | null {
  if (!subscription || typeof subscription === "string") return null
  const raw = subscription as Stripe.Subscription & { current_period_end?: number }
  return raw.current_period_end ?? null
}
