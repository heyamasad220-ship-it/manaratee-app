export const MEMBERSHIP_STATUSES = [
  "pending",
  "active",
  "lapsed",
  "cancelled",
] as const

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number]

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  pending: "Pending",
  active: "Active",
  lapsed: "Lapsed",
  cancelled: "Cancelled",
}

export const MEMBERSHIP_STATUS_COLORS: Record<MembershipStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  lapsed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
}

export function isMembershipStatus(value: string): value is MembershipStatus {
  return (MEMBERSHIP_STATUSES as readonly string[]).includes(value)
}

export function formatMembershipStatus(status?: string | null) {
  if (status && isMembershipStatus(status)) {
    return MEMBERSHIP_STATUS_LABELS[status]
  }
  return status ? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "-"
}

export function addMonthsToDate(dateString: string, months: number) {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result.toISOString().slice(0, 10)
}
