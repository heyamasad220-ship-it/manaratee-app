import {
  PROGRAM_SCHEDULE_DAY_LABELS,
  type ProgramScheduleItem,
} from "@/lib/programs/program-schedule-types"

const DAY_ORDER: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

function formatTimeClock(value: string | null | undefined) {
  if (!value) return ""
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value).trim())
  if (!match) return String(value)
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return String(value)
  const period = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 || 12
  return `${hour12}:${String(minute).padStart(2, "0")}${period}`
}

export type OfferingScheduleSummaryLines = {
  days: string | null
  time: string | null
  location: string | null
}

/**
 * Stacked schedule lines for offering overview cards.
 * Example:
 *   Tuesday & Thursday
 *   9:00AM - 11:00AM
 *   Conference Room 1
 */
export function getOfferingScheduleSummaryLines(
  items: ProgramScheduleItem[],
  venues?: Array<{ id: string; name: string }>
): OfferingScheduleSummaryLines | null {
  if (!items.length) return null

  const venueNameById = new Map(
    (venues || []).map((venue) => [venue.id, venue.name])
  )

  const days = [
    ...new Set(
      items
        .map((item) => String(item.day_of_week || "").toLowerCase())
        .filter((day) =>
          Boolean(
            PROGRAM_SCHEDULE_DAY_LABELS[
              day as keyof typeof PROGRAM_SCHEDULE_DAY_LABELS
            ]
          )
        )
    ),
  ].sort((a, b) => (DAY_ORDER[a] || 99) - (DAY_ORDER[b] || 99))

  const dayLabel =
    days.length === 0
      ? null
      : days.length === 1
        ? PROGRAM_SCHEDULE_DAY_LABELS[
            days[0] as keyof typeof PROGRAM_SCHEDULE_DAY_LABELS
          ]
        : days.length === 2
          ? `${PROGRAM_SCHEDULE_DAY_LABELS[days[0] as keyof typeof PROGRAM_SCHEDULE_DAY_LABELS]} & ${PROGRAM_SCHEDULE_DAY_LABELS[days[1] as keyof typeof PROGRAM_SCHEDULE_DAY_LABELS]}`
          : days
              .map(
                (day) =>
                  PROGRAM_SCHEDULE_DAY_LABELS[
                    day as keyof typeof PROGRAM_SCHEDULE_DAY_LABELS
                  ]
              )
              .join(", ")

  const timeRanges = [
    ...new Set(
      items
        .map((item) => {
          const start = formatTimeClock(item.start_time)
          const end = formatTimeClock(item.end_time)
          if (!start || !end) return ""
          return `${start} - ${end}`
        })
        .filter(Boolean)
    ),
  ]
  const timeLabel =
    timeRanges.length === 0
      ? null
      : timeRanges.length === 1
        ? timeRanges[0]
        : timeRanges.join(", ")

  const locations = [
    ...new Set(
      items
        .map((item) => {
          const venueName =
            item.venue_id != null ? venueNameById.get(item.venue_id) : null
          return (venueName || item.location || "").trim()
        })
        .filter(Boolean)
    ),
  ]
  const locationLabel =
    locations.length === 0
      ? null
      : locations.length === 1
        ? locations[0]
        : locations.join(", ")

  if (!dayLabel && !timeLabel && !locationLabel) return null

  return {
    days: dayLabel,
    time: timeLabel,
    location: locationLabel,
  }
}

/**
 * Single-line schedule summary (lists, tooltips).
 */
export function formatOfferingScheduleSummary(
  items: ProgramScheduleItem[],
  venues?: Array<{ id: string; name: string }>
): string | null {
  const lines = getOfferingScheduleSummaryLines(items, venues)
  if (!lines) return null
  return [lines.days, lines.time, lines.location].filter(Boolean).join(" · ")
}

const DAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

function formatTimeClockSpaced(value: string | null | undefined) {
  if (!value) return ""
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value).trim())
  if (!match) return String(value)
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return String(value)
  const period = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 || 12
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`
}

/**
 * Compact admin-table schedule, e.g. `Sun · 10:00 AM–2:00 PM` or `Tue/Thu · 10:00 AM–12:00 PM`.
 */
export function formatOfferingScheduleCompact(
  items: Array<{
    day_of_week?: string | null
    start_time?: string | null
    end_time?: string | null
  }>
): string | null {
  if (!items.length) return null

  const days = [
    ...new Set(
      items
        .map((item) => String(item.day_of_week || "").toLowerCase())
        .filter((day) => Boolean(DAY_SHORT[day]))
    ),
  ].sort((a, b) => (DAY_ORDER[a] || 99) - (DAY_ORDER[b] || 99))

  const dayLabel =
    days.length === 0 ? null : days.map((day) => DAY_SHORT[day]).join("/")

  const timeRanges = [
    ...new Set(
      items
        .map((item) => {
          const start = formatTimeClockSpaced(item.start_time)
          const end = formatTimeClockSpaced(item.end_time)
          if (!start || !end) return ""
          return `${start}–${end}`
        })
        .filter(Boolean)
    ),
  ]
  const timeLabel =
    timeRanges.length === 0
      ? null
      : timeRanges.length === 1
        ? timeRanges[0]
        : timeRanges.join(", ")

  if (!dayLabel && !timeLabel) return null
  if (dayLabel && timeLabel) return `${dayLabel} · ${timeLabel}`
  return dayLabel || timeLabel
}
