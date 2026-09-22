/** Default wall-clock zone for Event Management / bazaar date+time fields. */
export const DEFAULT_EVENT_TIMEZONE = "America/Chicago"

function normalizeClock(time: string | null | undefined): string {
  const raw = (time || "12:00:00").trim()
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`
  if (/^\d{2}:\d{2}:\d{2}/.test(raw)) return raw.slice(0, 8)
  return "12:00:00"
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)

  const value: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== "literal") value[part.type] = part.value
  }

  const asUtcFromWall = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second)
  )

  return asUtcFromWall - instant.getTime()
}

/**
 * Convert a local calendar date + clock (no timezone) into an ISO timestamptz.
 * Bazaar rows store date/time separately; Event Management stores start_at/end_at.
 */
export function wallTimeToIso(
  date: string | null | undefined,
  time: string | null | undefined,
  timeZone = DEFAULT_EVENT_TIMEZONE
): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return null
  const clock = normalizeClock(time)
  const naiveUtc = new Date(`${date.trim()}T${clock}Z`)
  if (Number.isNaN(naiveUtc.getTime())) return null

  const first = new Date(naiveUtc.getTime() - timeZoneOffsetMs(naiveUtc, timeZone))
  const adjusted = new Date(naiveUtc.getTime() - timeZoneOffsetMs(first, timeZone))
  return adjusted.toISOString()
}

export function isoToDateKey(
  iso: string | null | undefined,
  timeZone = DEFAULT_EVENT_TIMEZONE
): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10) || null
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const value: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== "literal") value[part.type] = part.value
  }
  if (!value.year || !value.month || !value.day) return iso.slice(0, 10)
  return `${value.year}-${value.month}-${value.day}`
}

/** True when `iso` falls in the same calendar month as `now` in the given zone. */
export function isSameYearMonth(
  iso: string | null | undefined,
  now = new Date(),
  timeZone = DEFAULT_EVENT_TIMEZONE
): boolean {
  const dateKey = isoToDateKey(iso, timeZone)
  const todayKey = isoToDateKey(now.toISOString(), timeZone)
  if (!dateKey || !todayKey) return false
  return dateKey.slice(0, 7) === todayKey.slice(0, 7)
}

export function isoToClock(
  iso: string | null | undefined,
  timeZone = DEFAULT_EVENT_TIMEZONE
): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const value: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== "literal") value[part.type] = part.value
  }
  if (!value.hour || !value.minute) return null
  return `${value.hour}:${value.minute}:${value.second || "00"}`
}
