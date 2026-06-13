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
  while (toDateOnly(cursor) < today && guard < 500) {
    cursor = calculateNextPaymentDate(cursor, frequency)
    guard += 1
  }
  return cursor
}
