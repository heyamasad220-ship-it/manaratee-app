import type { RecurringFrequency } from "@/lib/donations/recurring-donation-types"

function toDateOnly(value: string | Date): Date {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const plain = value.includes("T") ? value.slice(0, 10) : value
  const [year, month, day] = plain.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function formatDateOnly(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function calculateNextPaymentDate(
  fromDate: string | Date,
  frequency: RecurringFrequency
): string {
  const base = toDateOnly(fromDate)
  const next = new Date(base)

  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1)
      break
    case "weekly":
      next.setDate(next.getDate() + 7)
      break
    case "monthly":
      next.setMonth(next.getMonth() + 1)
      break
    case "quarterly":
      next.setMonth(next.getMonth() + 3)
      break
    case "annually":
      next.setFullYear(next.getFullYear() + 1)
      break
  }

  return formatDateOnly(next)
}

export function initialNextPaymentDate(
  startDate: string,
  frequency: RecurringFrequency
): string {
  const start = toDateOnly(startDate)
  const today = toDateOnly(new Date())

  if (start >= today) return formatDateOnly(start)

  let cursor = formatDateOnly(start)
  let guard = 0
  while (toDateOnly(cursor) < today && guard < 2000) {
    cursor = calculateNextPaymentDate(cursor, frequency)
    guard += 1
  }
  return cursor
}

const MAX_RECURRING_INSTALLMENTS = 600

export function lastRecurringDateFromCount(
  startDate: string,
  frequency: RecurringFrequency,
  totalPayments: number
): string | null {
  if (!startDate.trim() || totalPayments < 1) return null
  let cursor = startDate.trim()
  for (let index = 1; index < totalPayments; index += 1) {
    cursor = calculateNextPaymentDate(cursor, frequency)
  }
  return cursor
}

export function paymentCountFromLastRecurringDate(
  startDate: string,
  frequency: RecurringFrequency,
  endDate: string
): number {
  const first = startDate.trim()
  const last = endDate.trim()
  if (!first || !last || last < first) return 0
  if (last === first) return 1

  let count = 1
  let cursor = first
  while (count < MAX_RECURRING_INSTALLMENTS) {
    const next = calculateNextPaymentDate(cursor, frequency)
    if (next > last) break
    cursor = next
    count += 1
  }
  return count
}

export function buildRecurringPlanSchedule(input: {
  frequency: RecurringFrequency
  startDate: string
  numberOfPayments?: number | null
  endDate?: string | null
}):
  | { ok: true; totalPayments: number; endDate: string }
  | { ok: false; error: string } {
  const startDate = input.startDate.trim()
  if (!startDate) {
    return { ok: false, error: "Choose a start date." }
  }

  const countFromInput = Number(input.numberOfPayments)
  const hasCount = Number.isInteger(countFromInput) && countFromInput >= 2
  const endDate = input.endDate?.trim() || ""

  let totalPayments = 0
  if (hasCount) {
    totalPayments = countFromInput
  } else if (endDate) {
    totalPayments = paymentCountFromLastRecurringDate(startDate, input.frequency, endDate)
    if (totalPayments < 2) {
      return { ok: false, error: "End date must be on or after the second payment." }
    }
  } else {
    return { ok: false, error: "Enter the number of installments or an end date." }
  }

  return {
    ok: true,
    totalPayments,
    endDate: lastRecurringDateFromCount(startDate, input.frequency, totalPayments) || endDate,
  }
}
