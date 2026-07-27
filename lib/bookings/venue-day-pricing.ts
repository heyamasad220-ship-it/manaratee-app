/** Day-of-week pricing for venues. 0 = Sunday … 6 = Saturday (matches JS Date#getDay). */

export type VenueDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type VenueDayScheduleInput = {
  dayOfWeek: VenueDayOfWeek
  open: boolean
  startTime: string
  endTime: string
  flatPrice: number
  hourlyPrice: number
}

export type VenueDayScheduleFormRow = {
  dayOfWeek: VenueDayOfWeek
  open: boolean
  startTime: string
  endTime: string
  flatPrice: string
  hourlyPrice: string
}

export const VENUE_DAY_ORDER: VenueDayOfWeek[] = [0, 1, 2, 3, 4, 5, 6]

export const VENUE_DAY_LABELS: Record<VenueDayOfWeek, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
}

export function buildDefaultVenueDaySchedule(input?: {
  startTime?: string | null
  endTime?: string | null
  baseFlat?: number
  baseHourly?: number
  peakFlat?: number
  peakHourly?: number
}): VenueDayScheduleFormRow[] {
  const start = (input?.startTime || "08:00").slice(0, 5)
  const end = (input?.endTime || "22:00").slice(0, 5)
  const baseFlat = String(input?.baseFlat ?? 0)
  const baseHourly = String(input?.baseHourly ?? 0)
  const peakFlat = String(input?.peakFlat ?? input?.baseFlat ?? 0)
  const peakHourly = String(input?.peakHourly ?? input?.baseHourly ?? 0)

  return VENUE_DAY_ORDER.map((dayOfWeek) => {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6
    return {
      dayOfWeek,
      open: true,
      startTime: start,
      endTime: end,
      flatPrice: isWeekend ? peakFlat : baseFlat,
      hourlyPrice: isWeekend ? peakHourly : baseHourly,
    }
  })
}

export function dayScheduleFromPricingRows(
  rows: Array<{
    day_of_week: number
    start_time: string
    end_time: string
    flat_price: number | string
    hourly_price: number | string
    is_active: boolean
  }>,
  fallback?: Parameters<typeof buildDefaultVenueDaySchedule>[0]
): VenueDayScheduleFormRow[] {
  const defaults = buildDefaultVenueDaySchedule(fallback)
  if (!rows.length) return defaults

  const byDay = new Map(rows.map((row) => [row.day_of_week, row]))

  return defaults.map((day) => {
    const row = byDay.get(day.dayOfWeek)
    if (!row || row.is_active === false) {
      return { ...day, open: false }
    }
    return {
      dayOfWeek: day.dayOfWeek,
      open: true,
      startTime: String(row.start_time).slice(0, 5),
      endTime: String(row.end_time).slice(0, 5),
      flatPrice: String(Number(row.flat_price || 0)),
      hourlyPrice: String(Number(row.hourly_price || 0)),
    }
  })
}

export function formScheduleToInput(
  rows: VenueDayScheduleFormRow[]
): VenueDayScheduleInput[] {
  return rows.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    open: row.open,
    startTime: row.startTime,
    endTime: row.endTime,
    flatPrice: Math.max(0, Number(row.flatPrice || 0)),
    hourlyPrice: Math.max(0, Number(row.hourlyPrice || 0)),
  }))
}

/** Derive legacy venue columns from the weekly schedule for backward compatibility. */
export function deriveLegacyPricingFromDaySchedule(rows: VenueDayScheduleInput[]) {
  const openRows = rows.filter((row) => row.open)
  const weekday = openRows.find((row) => row.dayOfWeek >= 1 && row.dayOfWeek <= 4)
  const weekend = openRows.find(
    (row) => row.dayOfWeek === 0 || row.dayOfWeek === 5 || row.dayOfWeek === 6
  )
  const first = openRows[0]

  return {
    base_price: weekday?.flatPrice ?? first?.flatPrice ?? 0,
    hourly_rate: weekday?.hourlyPrice ?? first?.hourlyPrice ?? 0,
    peak_flat_price: weekend?.flatPrice ?? weekday?.flatPrice ?? first?.flatPrice ?? 0,
    peak_hourly_rate:
      weekend?.hourlyPrice ?? weekday?.hourlyPrice ?? first?.hourlyPrice ?? 0,
    availability_start: first?.startTime ?? null,
    availability_end: first?.endTime ?? null,
  }
}

export function formatVenueDayHours(row: {
  open: boolean
  startTime: string
  endTime: string
}) {
  if (!row.open) return "Closed"
  return `${row.startTime} – ${row.endTime}`
}
