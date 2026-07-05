/** Lowercase channel keys allowed by payments_source_check. */
export const PAYMENT_SOURCE_CHANNELS = [
  "cash",
  "check",
  "square",
  "zelle",
  "venmo",
  "paypal",
  "stripe",
  "import",
  "manual",
] as const

export type PaymentSourceChannel = (typeof PAYMENT_SOURCE_CHANNELS)[number]

const CHANNEL_SET = new Set<string>(PAYMENT_SOURCE_CHANNELS)

/**
 * Map a configured payment method display name to a DB-safe payments.source channel key.
 * Staff UI and import already use these keys; the customer portal must normalize labels.
 */
export function normalizePaymentSourceChannel(
  displayName: string | null | undefined
): PaymentSourceChannel {
  const raw = String(displayName ?? "").trim()
  if (!raw) return "manual"

  const lower = raw.toLowerCase()
  if (CHANNEL_SET.has(lower)) return lower as PaymentSourceChannel

  if (lower.includes("credit card") || lower.includes("creditcard")) {
    return "stripe"
  }

  for (const channel of PAYMENT_SOURCE_CHANNELS) {
    if (channel !== "manual" && lower.includes(channel)) {
      return channel
    }
  }

  return "manual"
}

const PAYMENT_SOURCE_LABELS: Record<PaymentSourceChannel, string> = {
  cash: "Cash",
  check: "Check",
  square: "Square",
  zelle: "Zelle",
  venmo: "Venmo",
  paypal: "PayPal",
  stripe: "Stripe",
  import: "Import",
  manual: "Manual",
}

export function formatPaymentSourceLabel(channel: string | null | undefined): string {
  const normalized = normalizePaymentSourceChannel(channel)
  return PAYMENT_SOURCE_LABELS[normalized]
}

/** Financial activity Method column: hide generic manual/import labels; show card last4 for Stripe. */
export function formatFinancialTimelinePaymentMethod(input: {
  source?: string | null
  stripeCardLast4?: string | null
}): string | null {
  const channel = normalizePaymentSourceChannel(input.source)
  if (channel === "manual" || channel === "import") return null

  if (channel === "stripe") {
    const last4 = String(input.stripeCardLast4 ?? "")
      .replace(/\D/g, "")
      .slice(-4)
    return last4.length === 4 ? `•••• ${last4}` : "Stripe"
  }

  return formatPaymentSourceLabel(channel)
}

export function extractStripeCardLast4FromProcessorPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null

  const last4FromCard = (card: unknown): string | null => {
    if (!card || typeof card !== "object") return null
    const raw = String((card as Record<string, unknown>).last4 ?? "").replace(/\D/g, "")
    return raw.length === 4 ? raw : null
  }

  const root = payload as Record<string, unknown>
  const charges = root.charges as { data?: unknown[] } | undefined
  if (Array.isArray(charges?.data)) {
    for (const charge of charges.data) {
      if (!charge || typeof charge !== "object") continue
      const paymentMethodDetails = (charge as Record<string, unknown>)
        .payment_method_details as Record<string, unknown> | undefined
      const fromCharge = last4FromCard(paymentMethodDetails?.card)
      if (fromCharge) return fromCharge
    }
  }

  const paymentMethodDetails = root.payment_method_details as Record<string, unknown> | undefined
  const fromDetails = last4FromCard(paymentMethodDetails?.card)
  if (fromDetails) return fromDetails

  const paymentMethod = root.payment_method as Record<string, unknown> | undefined
  const fromPaymentMethod = last4FromCard(paymentMethod?.card)
  if (fromPaymentMethod) return fromPaymentMethod

  return null
}

/** True when the configured payment method should use Stripe Checkout (card), not a portal DB insert. */
export function isStripeCheckoutPaymentMethod(displayName: string | null | undefined): boolean {
  return normalizePaymentSourceChannel(displayName) === "stripe"
}
