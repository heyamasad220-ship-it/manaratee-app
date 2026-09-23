export const BOOTH_REQUEST_LIFECYCLES = new Set([
  "applied",
  "under_review",
  "waitlisted",
])

export type OverviewBoothPerformanceRow = {
  available: number
  total: number
  allocated: number
}

export type OverviewVendorSaleRow = {
  boothFee: number
  paid: number
}

export type OverviewParticipationRow = {
  contactId: string
  businessName: string
  eventCount: number
  lastEventName: string
  lastEventDate: string | null
}

export type OverviewReturningVendor = {
  contactId: string
  vendorName: string
  eventCount: number
  lastEventName: string
  lastEventDate: string | null
}

export type OverviewRecentOrder = {
  id: string
  contactId: string | null
  vendorName: string
  boothLabel: string
  amountPaid: number
  paidAt: string | null
}

export function countBoothRequests(lifecycleStatuses: Array<string | null | undefined>) {
  return lifecycleStatuses.filter((status) =>
    BOOTH_REQUEST_LIFECYCLES.has((status || "").toLowerCase())
  ).length
}

export function sumBoothsOpen(rows: OverviewBoothPerformanceRow[]) {
  return rows.reduce((sum, row) => sum + Math.max(0, row.available), 0)
}

export function sumBoothsTotal(rows: OverviewBoothPerformanceRow[]) {
  return rows.reduce((sum, row) => sum + Math.max(0, row.total), 0)
}

export function countUnpaidBooths(rows: OverviewVendorSaleRow[]) {
  return rows.filter((row) => Number(row.paid || 0) + 0.009 < Number(row.boothFee || 0)).length
}

export function visibleBoothTypes<T extends OverviewBoothPerformanceRow>(rows: T[]) {
  return rows.filter((row) => row.total > 0 || row.allocated > 0)
}

export function formatBoothOrderLabel(
  boothType: string | null | undefined,
  boothNumber: string | null | undefined
) {
  const type = (boothType || "").trim()
  const number = (boothNumber || "").trim()
  if (type && number) return `${type} · ${number}`
  return type || number || "Booth"
}

export function pickRecentOrders(rows: OverviewRecentOrder[], limit = 8): OverviewRecentOrder[] {
  return [...rows]
    .sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || ""))
    .slice(0, limit)
}

export function pickReturningVendors(
  rows: OverviewParticipationRow[],
  limit = 10
): OverviewReturningVendor[] {
  return [...rows]
    .sort((a, b) => {
      if (b.eventCount !== a.eventCount) return b.eventCount - a.eventCount
      return a.businessName.localeCompare(b.businessName)
    })
    .slice(0, limit)
    .map((row) => ({
      contactId: row.contactId,
      vendorName: row.businessName,
      eventCount: row.eventCount,
      lastEventName: row.lastEventName,
      lastEventDate: row.lastEventDate,
    }))
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/** Format a YYYY-MM-DD calendar date without timezone shift. */
export function formatCalendarDate(
  value?: string | null,
  options?: { weekday?: boolean }
) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return value
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return value
  const utc = new Date(Date.UTC(year, month - 1, day))
  const dateLabel = `${MONTHS[month - 1]} ${day}, ${year}`
  if (!options?.weekday) return dateLabel
  return `${WEEKDAYS[utc.getUTCDay()]}, ${dateLabel}`
}

/** Format a stored clock like 11:00:00 into 11:00 AM. */
export function formatClock(value?: string | null) {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return value
  let hours = Number(match[1])
  const minutes = match[2]
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) return value
  const period = hours >= 12 ? "PM" : "AM"
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${period}`
}
