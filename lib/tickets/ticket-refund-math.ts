export function ticketOrderRefundedCents(input: {
  status?: string | null
  totalCents?: number | null
  refundedAmountCents?: number | null
}) {
  const total = Math.max(Number(input.totalCents || 0), 0)
  const recorded = Math.max(Number(input.refundedAmountCents || 0), 0)
  if (input.status === "refunded" && recorded === 0) {
    return total
  }
  return Math.min(recorded, total)
}

export function ticketOrderRemainingCents(input: {
  status?: string | null
  totalCents?: number | null
  refundedAmountCents?: number | null
}) {
  const total = Math.max(Number(input.totalCents || 0), 0)
  return Math.max(total - ticketOrderRefundedCents(input), 0)
}

export function ticketOrderNetRevenueCents(input: {
  status?: string | null
  totalCents?: number | null
  refundedAmountCents?: number | null
}) {
  const status = input.status || ""
  if (status !== "completed" && status !== "partially_refunded" && status !== "refunded") {
    return 0
  }
  return ticketOrderRemainingCents(input)
}

export function nextTicketOrderRefundStatus(totalCents: number, refundedCents: number) {
  const total = Math.max(totalCents, 0)
  const refunded = Math.max(refundedCents, 0)
  if (refunded <= 0) return "completed" as const
  if (refunded >= total) return "refunded" as const
  return "partially_refunded" as const
}

export function dollarsToTicketCents(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.round(amount * 100)
}

export function ticketCentsToDollarInput(cents: number) {
  return (Math.max(cents, 0) / 100).toFixed(2)
}
