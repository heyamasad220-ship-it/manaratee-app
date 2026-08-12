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

/** Staff-facing label for the payments list pledge column (Yes / No). */
export function formatPaymentPledgeColumnLabel(status: string | null | undefined): string {
  const normalized = normalizePaymentStatus(status)

  switch (normalized) {
    case "allocated":
      return "Yes"
    case "unallocated":
      return "No"
    case "pending_review":
      return "Pending review"
    case "unresolved":
      return "Unresolved"
    case "voided":
      return "Voided"
    case "refunded":
      return "Refunded"
    case "partially_refunded":
      return "Partially refunded"
    default:
      return formatPaymentStatusLabel(status)
  }
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

/** Contact Financial Activity payment Status column. */
export function formatFinancialActivityPaymentStatus(input: {
  status?: string | null
  amount?: number | null
  refunded_amount?: number | null
}): "Succeeded" | "Failed" | "Refunded" | "Partially Refunded" {
  const normalized = normalizePaymentStatus(input.status)
  const amount = Number(input.amount || 0)
  const refundedAmount = Number(input.refunded_amount || 0)

  if (normalized === "voided" || normalized === "pending_review" || normalized === "unresolved") {
    return "Failed"
  }

  if (normalized === "refunded" || (amount > 0 && refundedAmount >= amount)) {
    return "Refunded"
  }

  if (normalized === "partially_refunded" || (refundedAmount > 0 && refundedAmount < amount)) {
    return "Partially Refunded"
  }

  return "Succeeded"
}

export function financialActivityStatusBadgeClass(status: string) {
  switch (status) {
    case "Succeeded":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
    case "Failed":
      return "border-red-200 bg-red-50 text-red-700 hover:bg-red-50"
    case "Voided":
      return "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-100"
    case "Refunded":
    case "Partially Refunded":
      return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50"
    default:
      return undefined
  }
}
