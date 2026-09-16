export function ticketOrderCheckoutDonationCents(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return 0
  }
  const raw = (metadata as Record<string, unknown>).checkoutDonationCents
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

export function splitTicketOrderRevenue(input: {
  status?: string | null
  totalCents?: number | null
  refundedAmountCents?: number | null
  checkoutDonationCents?: number | null
  netRevenueCents: number
}) {
  const net = Math.max(Number(input.netRevenueCents || 0), 0)
  const donation = Math.min(
    Math.max(Number(input.checkoutDonationCents || 0), 0),
    net
  )
  return {
    ticketRevenueCents: net - donation,
    checkoutDonationCents: donation,
  }
}
