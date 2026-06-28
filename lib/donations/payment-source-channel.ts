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

export function formatPaymentSourceLabel(channel: string | null | undefined): string {
  const normalized = normalizePaymentSourceChannel(channel)
  if (normalized === "paypal") return "PayPal"
  if (normalized === "square") return "Square"
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

/** True when the configured payment method should use Stripe Checkout (card), not a portal DB insert. */
export function isStripeCheckoutPaymentMethod(displayName: string | null | undefined): boolean {
  return normalizePaymentSourceChannel(displayName) === "stripe"
}
