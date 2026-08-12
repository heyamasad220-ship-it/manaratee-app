import type { ProgramOfferingBillingPeriod } from "@/lib/programs/program-billing-types"

/** Day-of-month from offering start (billing day), capped at 28 for SQL helper. */
export function billingDayFromStartDate(
  startDate: string | null | undefined
): number | null {
  if (!startDate) return null
  const day = Number(startDate.slice(8, 10))
  if (!Number.isFinite(day) || day < 1) return null
  return Math.min(28, day)
}

export function formatBillingDayLabel(day: number | null): string {
  if (day == null) return "—"
  const j = day % 10
  const k = day % 100
  const suffix =
    j === 1 && k !== 11
      ? "st"
      : j === 2 && k !== 12
        ? "nd"
        : j === 3 && k !== 13
          ? "rd"
          : "th"
  return `${day}${suffix} of each month`
}

/**
 * Due date for a billing period month using the offering billing day
 * (same day-of-month as program start, capped at 28).
 */
export function resolveBillingPeriodDueDate(
  periodStart: string | null | undefined,
  billingDay: number | null
): string | null {
  if (!periodStart) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodStart)
  if (!match) return periodStart
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Math.min(Math.max(billingDay ?? Number(match[3]) ?? 1, 1), 28)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function getBillablePeriods(
  periods: ProgramOfferingBillingPeriod[]
): ProgramOfferingBillingPeriod[] {
  return periods.filter((period) => period.period_status === "active")
}

export function getBillingScheduleSummary(
  periods: ProgramOfferingBillingPeriod[],
  startDate: string | null | undefined
) {
  const billingDay = billingDayFromStartDate(startDate)
  const billable = getBillablePeriods(periods)
  const first = billable[0] ?? periods[0] ?? null
  const last = billable[billable.length - 1] ?? periods[periods.length - 1] ?? null

  return {
    billingDay,
    firstBillingDate: resolveBillingPeriodDueDate(first?.period_start, billingDay),
    lastBillingDate: resolveBillingPeriodDueDate(last?.period_start, billingDay),
    durationMonths: billable.length,
    totalMonths: periods.length,
    skippedMonths: periods.length - billable.length,
  }
}
