/** Keep in sync with lib/donations/payment-source-channel.ts */
export const PAYMENT_SOURCE_CHANNELS = [
  "cash",
  "check",
  "zelle",
  "venmo",
  "paypal",
  "stripe",
  "import",
  "manual",
]

const CHANNEL_SET = new Set(PAYMENT_SOURCE_CHANNELS)

export function normalizePaymentSourceChannel(displayName) {
  const raw = String(displayName ?? "").trim()
  if (!raw) return "manual"

  const lower = raw.toLowerCase()
  if (CHANNEL_SET.has(lower)) return lower

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
