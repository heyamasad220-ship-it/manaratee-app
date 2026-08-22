export const DONATION_RANGE_PRESETS = ["7d", "30d", "90d", "1y", "all"] as const

export type DonationRangePreset = (typeof DONATION_RANGE_PRESETS)[number]

export const DONATION_RANGE_LABELS: Record<DonationRangePreset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last year",
  all: "All time",
}

export function isDonationRangePreset(value: string | null | undefined): value is DonationRangePreset {
  return DONATION_RANGE_PRESETS.includes(value as DonationRangePreset)
}

export function parseDonationRangeParam(
  value: string | null | undefined,
  fallback: DonationRangePreset
): DonationRangePreset {
  return isDonationRangePreset(value) ? value : fallback
}

export function resolveDonationRangeBounds(
  preset: DonationRangePreset,
  now = new Date()
): { dateFrom: string | null; dateTo: string | null; label: string } {
  const label = DONATION_RANGE_LABELS[preset]
  if (preset === "all") {
    return { dateFrom: null, dateTo: null, label }
  }

  const end = new Date(now)
  const dateTo = toDateOnly(end)
  const start = new Date(now)

  if (preset === "7d") start.setDate(start.getDate() - 6)
  else if (preset === "30d") start.setDate(start.getDate() - 29)
  else if (preset === "90d") start.setDate(start.getDate() - 89)
  else start.setFullYear(start.getFullYear() - 1)

  return { dateFrom: toDateOnly(start), dateTo, label }
}

function toDateOnly(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function donationRangeSearchParams(
  current: URLSearchParams,
  range: DonationRangePreset,
  defaultRange: DonationRangePreset
) {
  const next = new URLSearchParams(current.toString())
  if (range === defaultRange) next.delete("range")
  else next.set("range", range)
  return next
}
