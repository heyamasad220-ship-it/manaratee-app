export const PAYMENT_STATUSES = [
  "pending_review",
  "unallocated",
  "allocated",
  "unresolved",
  "voided",
  "refunded",
  "partially_refunded",
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PLEDGE_STATUSES = ["open", "partial", "fulfilled", "cancelled"] as const

export type PledgeStatus = (typeof PLEDGE_STATUSES)[number]

export type PledgeDisplayStatus = "Open" | "Partial" | "Fulfilled"

export function normalizePaymentStatus(value: string | null | undefined): PaymentStatus | string {
  if (!value) return "unallocated"
  return value.trim().toLowerCase().replace(/\s+/g, "_")
}

export function formatPaymentStatusLabel(status: string | null | undefined): string {
  const normalized = normalizePaymentStatus(status)
  return normalized.replaceAll("_", " ")
}

export function pledgeDisplayStatus(
  status: string | null | undefined,
  amountPledged: number,
  amountPaid: number
): PledgeDisplayStatus {
  const normalized = status?.toLowerCase()

  if (normalized === "fulfilled" || normalized === "paid") return "Fulfilled"
  if (normalized === "partial" || normalized === "partially_paid") return "Partial"
  if (normalized === "cancelled") return "Open"

  if (amountPledged > 0 && amountPaid >= amountPledged) return "Fulfilled"
  if (amountPaid > 0) return "Partial"

  return "Open"
}

export function pledgeStatusToDb(display: PledgeDisplayStatus): PledgeStatus {
  switch (display) {
    case "Fulfilled":
      return "fulfilled"
    case "Partial":
      return "partial"
    case "Open":
    default:
      return "open"
  }
}

export function formatPledgeStatusLabel(status: string | null | undefined): string {
  const normalized = status?.toLowerCase()
  if (normalized === "fulfilled" || normalized === "paid") return "Fulfilled"
  if (normalized === "partial" || normalized === "partially_paid") return "Partial"
  if (normalized === "cancelled") return "Cancelled"
  if (normalized === "open") return "Open"
  return status || "Open"
}
