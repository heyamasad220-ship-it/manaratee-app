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

/** Hours-only schedule row for customer booking calendars (no pricing). */
export type VenuePublicDayHours = {
  dayOfWeek: number
  open: boolean
  startTime: string
  endTime: string
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

/** Parse "HH:MM" / "HH:MM:SS" into hour + fraction (0–24). */
export function parseVenueTimeToHours(time: string): number {
  const match = String(time || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})/)
  if (!match) return 0
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0
  return hour + minute / 60
}

/**
 * Hour rows that can start a booking for an open window.
 * Example: 08:00–22:00 → 8..21 (last slot ends at close).
 */
export function bookableStartHoursForWindow(
  startTime: string,
  endTime: string
): number[] {
  const start = parseVenueTimeToHours(startTime)
  const end = parseVenueTimeToHours(endTime)
  if (!(end > start)) return []

  const firstHour = Math.floor(start)
  const lastStartHour = Math.ceil(end) - 1
  const hours: number[] = []
  for (let hour = firstHour; hour <= lastStartHour; hour += 1) {
    if (hour >= 0 && hour <= 23) {
      hours.push(hour)
    }
  }
  return hours
}

export function getVenueDayHoursForDate(
  daySchedule: Array<{
    dayOfWeek: number
    open: boolean
    startTime: string
    endTime: string
  }> | null | undefined,
  date: Date
): { open: boolean; startTime: string; endTime: string } | null {
  if (!daySchedule?.length) return null
  const dayOfWeek = date.getDay()
  const row = daySchedule.find((day) => day.dayOfWeek === dayOfWeek)
  if (!row) return null
  return {
    open: row.open,
    startTime: row.startTime,
    endTime: row.endTime,
  }
}

/** True when a one-hour slot starting at `hour` fits inside the open window. */
export function isVenueHourBookable(
  dayHours: { open: boolean; startTime: string; endTime: string } | null,
  hour: number
): boolean {
  if (!dayHours?.open) return false
  const start = parseVenueTimeToHours(dayHours.startTime)
  const end = parseVenueTimeToHours(dayHours.endTime)
  if (!(end > start)) return false
  return hour >= Math.floor(start) && hour < end
}

export function resolveCalendarHourRange(
  schedules: Array<{ open: boolean; startTime: string; endTime: string } | null>
): { startHour: number; endHourInclusive: number } {
  let minStart = Number.POSITIVE_INFINITY
  let maxEnd = Number.NEGATIVE_INFINITY

  for (const schedule of schedules) {
    if (!schedule?.open) continue
    const hours = bookableStartHoursForWindow(schedule.startTime, schedule.endTime)
    if (!hours.length) continue
    minStart = Math.min(minStart, hours[0])
    maxEnd = Math.max(maxEnd, hours[hours.length - 1])
  }

  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
    // Match admin default day schedule (08:00–22:00).
    return { startHour: 8, endHourInclusive: 21 }
  }

  return { startHour: minStart, endHourInclusive: maxEnd }
}
