/** Recurrence for internal event requests (stored on `internal_events.recurrence_config`). */

export const EVENT_RECURRENCE_FREQUENCIES = ["daily", "weekly", "monthly"] as const
export type EventRecurrenceFrequency = (typeof EVENT_RECURRENCE_FREQUENCIES)[number]

export const EVENT_RECURRENCE_END_TYPES = ["date", "count"] as const
export type EventRecurrenceEndType = (typeof EVENT_RECURRENCE_END_TYPES)[number]

export type EventRecurrenceConfig = {
  enabled: boolean
  frequency: EventRecurrenceFrequency
  interval: number
  /** 0 = Sunday … 6 = Saturday (weekly) */
  weekdays?: number[]
  endType: EventRecurrenceEndType
  /** YYYY-MM-DD when endType is date */
  endDate?: string | null
  endCount?: number | null
  /** YYYY-MM-DD dates to skip */
  exceptions?: string[]
  seriesId?: string | null
}

export type EventOccurrence = {
  startAt: Date
  endAt: Date
}

export const MAX_EVENT_OCCURRENCES = 100

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  )
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate()
  const next = new Date(date)
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(day, lastDay))
  next.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds())
  return next
}

export function isEventRecurrenceFrequency(
  value: string | null | undefined
): value is EventRecurrenceFrequency {
  return (
    value === "daily" || value === "weekly" || value === "monthly"
  )
}

export function normalizeEventRecurrenceConfig(
  input: Partial<EventRecurrenceConfig> | Record<string, unknown> | null | undefined
): EventRecurrenceConfig | null {
  if (!input || typeof input !== "object") return null

  const enabled = (input as EventRecurrenceConfig).enabled === true
  if (!enabled) {
    return { enabled: false, frequency: "weekly", interval: 1, endType: "count", endCount: 1 }
  }

  const frequencyRaw = String((input as EventRecurrenceConfig).frequency || "weekly")
  const frequency = isEventRecurrenceFrequency(frequencyRaw) ? frequencyRaw : "weekly"
  const interval = Math.max(
    1,
    Math.min(99, Number((input as EventRecurrenceConfig).interval) || 1)
  )
  const endType: EventRecurrenceEndType =
    (input as EventRecurrenceConfig).endType === "date" ? "date" : "count"

  const weekdays = Array.isArray((input as EventRecurrenceConfig).weekdays)
    ? Array.from(
        new Set(
          ((input as EventRecurrenceConfig).weekdays || [])
            .map((d) => Number(d))
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        )
      ).sort((a, b) => a - b)
    : []

  const exceptions = Array.isArray((input as EventRecurrenceConfig).exceptions)
    ? Array.from(
        new Set(
          ((input as EventRecurrenceConfig).exceptions || [])
            .map((d) => String(d).trim())
            .filter((d) => Boolean(parseDateKey(d)))
        )
      ).sort()
    : []

  const endDate =
    typeof (input as EventRecurrenceConfig).endDate === "string"
      ? (input as EventRecurrenceConfig).endDate
      : null
  const endCount = Math.max(
    1,
    Math.min(
      MAX_EVENT_OCCURRENCES,
      Number((input as EventRecurrenceConfig).endCount) || 10
    )
  )

  return {
    enabled: true,
    frequency,
    interval,
    weekdays: frequency === "weekly" ? weekdays : undefined,
    endType,
    endDate: endType === "date" ? endDate : null,
    endCount: endType === "count" ? endCount : null,
    exceptions,
    seriesId:
      typeof (input as EventRecurrenceConfig).seriesId === "string"
        ? (input as EventRecurrenceConfig).seriesId
        : null,
  }
}

/**
 * Expand first occurrence start/end into a list of occurrence windows.
 * Duration is preserved from the first occurrence.
 */
export function expandEventOccurrences(
  startAt: Date,
  endAt: Date,
  config: EventRecurrenceConfig | null | undefined
): EventOccurrence[] {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return []
  }

  const durationMs = Math.max(0, endAt.getTime() - startAt.getTime())
  const normalized = normalizeEventRecurrenceConfig(config)

  if (!normalized?.enabled) {
    return [{ startAt: new Date(startAt), endAt: new Date(endAt) }]
  }

  if (normalized.frequency === "weekly" && (normalized.weekdays?.length || 0) === 0) {
    throw new Error("Select at least one weekday for weekly recurrence.")
  }

  if (normalized.endType === "date" && !normalized.endDate) {
    throw new Error("Choose an end date for the recurring series.")
  }

  const exceptionSet = new Set(normalized.exceptions || [])
  const seriesEnd =
    normalized.endType === "date" && normalized.endDate
      ? parseDateKey(normalized.endDate)
      : null

  if (normalized.endType === "date" && !seriesEnd) {
    throw new Error("Invalid recurrence end date.")
  }

  const results: EventOccurrence[] = []
  const maxCount =
    normalized.endType === "count"
      ? Math.min(MAX_EVENT_OCCURRENCES, normalized.endCount || 1)
      : MAX_EVENT_OCCURRENCES

  const pushIfValid = (occurrenceStart: Date) => {
    if (seriesEnd) {
      const key = toDateKey(occurrenceStart)
      const endKey = toDateKey(seriesEnd)
      if (key > endKey) return false
    }

    const key = toDateKey(occurrenceStart)
    if (exceptionSet.has(key)) return true

    results.push({
      startAt: new Date(occurrenceStart),
      endAt: new Date(occurrenceStart.getTime() + durationMs),
    })
    return results.length < maxCount
  }

  if (normalized.frequency === "daily") {
    let cursor = new Date(startAt)
    let guard = 0
    while (results.length < maxCount && guard < MAX_EVENT_OCCURRENCES * 3) {
      guard += 1
      if (!pushIfValid(cursor)) break
      cursor = addDays(cursor, normalized.interval)
      if (seriesEnd && toDateKey(cursor) > toDateKey(seriesEnd)) break
    }
    return results
  }

  if (normalized.frequency === "monthly") {
    let cursor = new Date(startAt)
    let guard = 0
    while (results.length < maxCount && guard < MAX_EVENT_OCCURRENCES * 3) {
      guard += 1
      if (!pushIfValid(cursor)) break
      cursor = addMonthsClamped(cursor, normalized.interval)
      if (seriesEnd && toDateKey(cursor) > toDateKey(seriesEnd)) break
    }
    return results
  }

  // Weekly: walk calendar days; keep weeks that match interval from start week
  const weekdays = new Set(normalized.weekdays || [])
  const startWeek = stripToWeekStart(startAt)
  const startTime = {
    h: startAt.getHours(),
    m: startAt.getMinutes(),
    s: startAt.getSeconds(),
    ms: startAt.getMilliseconds(),
  }

  let cursor = new Date(startAt)
  cursor.setHours(0, 0, 0, 0)
  let guard = 0

  while (results.length < maxCount && guard < 2000) {
    guard += 1
    if (seriesEnd && toDateKey(cursor) > toDateKey(seriesEnd)) break

    if (weekdays.has(cursor.getDay())) {
      const weekStart = stripToWeekStart(cursor)
      const weeksFromStart = Math.round(
        (weekStart.getTime() - startWeek.getTime()) / (7 * 24 * 60 * 60 * 1000)
      )
      if (weeksFromStart >= 0 && weeksFromStart % normalized.interval === 0) {
        const occurrenceStart = new Date(cursor)
        occurrenceStart.setHours(startTime.h, startTime.m, startTime.s, startTime.ms)
        if (occurrenceStart.getTime() >= startAt.getTime()) {
          if (!pushIfValid(occurrenceStart)) break
        }
      }
    }

    cursor = addDays(cursor, 1)
  }

  return results
}

function stripToWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

export function formatEventRecurrenceSummary(
  startAt: Date,
  endAt: Date,
  config: EventRecurrenceConfig | null | undefined
): string {
  const normalized = normalizeEventRecurrenceConfig(config)
  if (!normalized?.enabled) {
    return "Does not repeat"
  }

  const interval = normalized.interval
  let rule = ""
  if (normalized.frequency === "daily") {
    rule = interval === 1 ? "Every day" : `Every ${interval} days`
  } else if (normalized.frequency === "weekly") {
    const days = (normalized.weekdays || [])
      .map((d) => WEEKDAY_LABELS[d] || "")
      .filter(Boolean)
      .join(", ")
    rule =
      interval === 1
        ? `Every week on ${days || "—"}`
        : `Every ${interval} weeks on ${days || "—"}`
  } else {
    rule = interval === 1 ? "Every month" : `Every ${interval} months`
  }

  const occurrences = expandEventOccurrences(startAt, endAt, normalized)
  const endText =
    normalized.endType === "date" && normalized.endDate
      ? `End by ${normalized.endDate}`
      : `End after ${normalized.endCount || occurrences.length} occurrence(s)`

  const sample = occurrences
    .slice(0, 5)
    .map((o) => toDateKey(o.startAt))
    .join(", ")

  const more =
    occurrences.length > 5 ? ` (+${occurrences.length - 5} more)` : ""

  return `${rule}. ${endText}. Occurrences: ${sample}${more}.`
}
