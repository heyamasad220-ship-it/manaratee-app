/** Shared YYYY-MM period helpers for department operating finance matrices. */

export type DepartmentPeriodColumn = {
  periodKey: string
  label: string
}

export function shortMonthLabel(periodKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey)
  if (!match) return periodKey
  const year = Number(match[1])
  const month = Number(match[2])
  if (!year || month < 1 || month > 12) return periodKey
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
}

export function periodKeyFromDate(value: string | null | undefined) {
  if (!value) return null
  const match = /^(\d{4}-\d{2})/.exec(value)
  return match?.[1] ?? null
}

/** Default Sept → May range for the academic year containing `asOf` (or today). */
export function defaultAcademicPeriodKeys(asOf: Date = new Date()): string[] {
  const year = asOf.getUTCFullYear()
  const month = asOf.getUTCMonth() + 1
  // Before July → academic year started previous calendar year
  const startYear = month < 7 ? year - 1 : year
  const keys: string[] = []
  for (let m = 9; m <= 12; m += 1) {
    keys.push(`${startYear}-${String(m).padStart(2, "0")}`)
  }
  for (let m = 1; m <= 5; m += 1) {
    keys.push(`${startYear + 1}-${String(m).padStart(2, "0")}`)
  }
  return keys
}

export function mergePeriodKeys(...groups: Array<Iterable<string>>): DepartmentPeriodColumn[] {
  const set = new Set<string>()
  for (const group of groups) {
    for (const key of group) {
      if (/^\d{4}-\d{2}$/.test(key)) set.add(key)
    }
  }
  return [...set]
    .sort()
    .map((periodKey) => ({ periodKey, label: shortMonthLabel(periodKey) }))
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}
