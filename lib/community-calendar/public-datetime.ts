/** Format like "September 12, 2026". */
export function formatCommunityEventDateLabel(input: {
  eventDate: string | null
  startAt: string | null
}) {
  const sourceIso = input.startAt || (input.eventDate ? `${input.eventDate}T12:00:00` : null)
  if (!sourceIso) return null

  const date = new Date(sourceIso)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(input.startAt ? {} : { timeZone: "UTC" }),
  })
}

/** Format like "Saturday 11 a.m." from a date key + optional start time. */
export function formatCommunityEventDayTime(input: {
  eventDate: string | null
  startAt: string | null
  startLabel: string | null
}) {
  const sourceIso = input.startAt || (input.eventDate ? `${input.eventDate}T12:00:00` : null)
  if (!sourceIso) return null

  const date = new Date(sourceIso)
  if (Number.isNaN(date.getTime())) return null

  const weekday = date.toLocaleDateString(undefined, {
    weekday: "long",
    ...(input.startAt ? {} : { timeZone: "UTC" }),
  })

  let timePart: string | null = null
  if (input.startAt) {
    timePart = date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })
  } else if (input.startLabel) {
    timePart = formatLooseTimeLabel(input.startLabel)
  }

  if (!timePart) return weekday

  const compact = timePart
    .replace(/\s?(AM|PM)/i, (_, meridian: string) => ` ${meridian.toLowerCase().replace("m", ".m.")}`)
    .replace(/:00(?=\s)/, "")

  return `${weekday} ${compact}`
}

function formatLooseTimeLabel(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  // HH:MM:SS or HH:MM from Postgres time
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed)
  if (!match) return trimmed
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return trimmed
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

export type CommunityBrowseTab = "all" | "today" | "weekend"

function toDateKeyInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** Saturday–Sunday of the current or upcoming weekend in the given time zone. */
export function getUpcomingWeekendDateKeys(
  now = new Date(),
  timeZone = "America/Chicago"
): { start: string; end: string } {
  const todayKey = toDateKeyInTimeZone(now, timeZone)
  const [y, m, d] = todayKey.split("-").map(Number)
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 18, 0, 0))
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(noonUtc)
  const dayIndex =
    weekday === "Sun"
      ? 0
      : weekday === "Mon"
        ? 1
        : weekday === "Tue"
          ? 2
          : weekday === "Wed"
            ? 3
            : weekday === "Thu"
              ? 4
              : weekday === "Fri"
                ? 5
                : 6

  // Days until this week's Saturday (0 if Saturday, 6 if Sunday → next Saturday? On Sunday use this Sunday only as end of weekend that started yesterday)
  let daysToSaturday: number
  if (dayIndex === 0) {
    // Sunday — weekend is yesterday Sat + today
    daysToSaturday = -1
  } else if (dayIndex === 6) {
    daysToSaturday = 0
  } else {
    daysToSaturday = 6 - dayIndex
  }

  const saturday = new Date(noonUtc)
  saturday.setUTCDate(saturday.getUTCDate() + daysToSaturday)
  const sunday = new Date(saturday)
  sunday.setUTCDate(sunday.getUTCDate() + 1)

  return {
    start: toDateKeyInTimeZone(saturday, timeZone),
    end: toDateKeyInTimeZone(sunday, timeZone),
  }
}

export function getTodayDateKey(now = new Date(), timeZone = "America/Chicago") {
  return toDateKeyInTimeZone(now, timeZone)
}

export function eventMatchesBrowseTab(
  eventDate: string | null,
  tab: CommunityBrowseTab,
  now = new Date(),
  timeZone = "America/Chicago"
) {
  if (tab === "all") return true
  if (!eventDate) return false
  if (tab === "today") return eventDate === getTodayDateKey(now, timeZone)
  const weekend = getUpcomingWeekendDateKeys(now, timeZone)
  return eventDate >= weekend.start && eventDate <= weekend.end
}
