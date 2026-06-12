const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

export function parseTimeToMinutes(value: string) {
  if (!value) return 0

  if (value.includes(":") && !value.toLowerCase().includes("m")) {
    const [hours, minutes] = value.split(":").map(Number)
    return hours * 60 + (minutes || 0)
  }

  const match = value.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i)
  if (!match) return 0

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const period = match[3].toUpperCase()

  if (period === "PM" && hours !== 12) hours += 12
  if (period === "AM" && hours === 12) hours = 0

  return hours * 60 + minutes
}

export function combineDateAndTime(date: Date, time: string) {
  const result = new Date(date)
  const minutes = parseTimeToMinutes(time)
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return result
}

export function getWeekStart(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  return start
}

export function getWeekEnd(date: Date) {
  const end = getWeekStart(date)
  end.setDate(end.getDate() + 7)
  end.setMilliseconds(end.getMilliseconds() - 1)
  return end
}

export function getDayEnd(date: Date) {
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return end
}

export function parseCalendarDate(value: string | undefined, fallback = new Date()) {
  if (!value) return new Date(fallback)

  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return new Date(fallback)
  }

  return parsed
}

export function toDateParam(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function dayNameToIndex(dayOfWeek: string) {
  return DAY_NAME_TO_INDEX[dayOfWeek.trim().toLowerCase()] ?? null
}

export function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
) {
  return startA < endB && endA > startB
}

export function formatHourLabel(hour: number) {
  const ampm = hour >= 12 ? "PM" : "AM"
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:00 ${ampm}`
}

export function formatCalendarToolbarDate(date: Date) {
  const days = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ]
  const months = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ]

  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export function formatCalendarHeading(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function formatTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)

  const startLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
  const endLabel = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  return `${startLabel} – ${endLabel}`
}
