import {
  PROGRAM_SCHEDULE_DAY_LABELS,
  type ProgramScheduleDayOfWeek,
} from "@/lib/programs/program-schedule-types"

const WEEKDAYS: ProgramScheduleDayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]

const DAY_ORDER: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

const JS_DAY_TO_SCHEDULE: ProgramScheduleDayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

export type VisualScheduleItem = {
  id: string
  offeringId: string | null
  offeringName: string
  dayOfWeek: string
  startTime: string
  endTime: string
  instructorName: string | null
  spaceName: string | null
  href: string | null
}

export type WeeklyScheduleDayColumn = {
  dayOfWeek: ProgramScheduleDayOfWeek
  label: string
  isToday: boolean
  items: VisualScheduleItem[]
}

export function timeToMinutes(value: string) {
  if (!value) return 0

  if (value.includes(":") && !/am|pm/i.test(value)) {
    const [hours, minutes] = value.split(":").map(Number)
    return (Number(hours) || 0) * 60 + (Number(minutes) || 0)
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

export function formatScheduleTime(value: string) {
  if (!value) return ""
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return value
  const hour = Number(match[1])
  const minute = match[2]
  if (!Number.isFinite(hour)) return value
  const suffix = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${suffix}`
}

export function formatScheduleTimeRange(startTime: string, endTime: string) {
  const start = formatScheduleTime(startTime)
  const end = formatScheduleTime(endTime)
  if (start && end) return `${start} – ${end}`
  return start || end || ""
}

export function formatScheduleDay(value: string) {
  const key = value.toLowerCase() as ProgramScheduleDayOfWeek
  return PROGRAM_SCHEDULE_DAY_LABELS[key] || (value ? value.charAt(0).toUpperCase() + value.slice(1) : "")
}

export function getTodayScheduleDay(
  now: Date = new Date()
): ProgramScheduleDayOfWeek {
  return JS_DAY_TO_SCHEDULE[now.getDay()] || "monday"
}

/**
 * Weekdays Mon–Fri when any weekday class exists.
 * Saturday / Sunday only appear when the program actually schedules them.
 */
export function getActiveScheduleDays(
  items: Array<{ dayOfWeek: string }>
): ProgramScheduleDayOfWeek[] {
  const present = new Set(
    items.map((item) => item.dayOfWeek.toLowerCase()).filter(Boolean)
  )
  const days: ProgramScheduleDayOfWeek[] = []
  const hasWeekday = WEEKDAYS.some((day) => present.has(day))

  if (hasWeekday) {
    days.push(...WEEKDAYS)
  }

  if (present.has("saturday")) days.push("saturday")
  if (present.has("sunday")) days.push("sunday")

  return days
}

function sortItemsForDay(items: VisualScheduleItem[]) {
  return [...items].sort(compareVisualScheduleItems)
}

export function compareVisualScheduleItems(
  a: VisualScheduleItem,
  b: VisualScheduleItem
) {
  const dayDiff =
    (DAY_ORDER[a.dayOfWeek.toLowerCase()] || 99) -
    (DAY_ORDER[b.dayOfWeek.toLowerCase()] || 99)
  if (dayDiff !== 0) return dayDiff
  const timeDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  if (timeDiff !== 0) return timeDiff
  return a.offeringName.localeCompare(b.offeringName, undefined, {
    sensitivity: "base",
  })
}

export function sortVisualScheduleItems(items: VisualScheduleItem[]) {
  return [...items].sort(compareVisualScheduleItems)
}

export function buildWeeklyScheduleColumns(
  items: VisualScheduleItem[],
  options?: { todayDayOfWeek?: ProgramScheduleDayOfWeek }
): WeeklyScheduleDayColumn[] {
  const today = options?.todayDayOfWeek ?? getTodayScheduleDay()
  const days = getActiveScheduleDays(items)
  const byDay = new Map<string, VisualScheduleItem[]>()

  for (const item of items) {
    const day = item.dayOfWeek.toLowerCase()
    const list = byDay.get(day) || []
    list.push(item)
    byDay.set(day, list)
  }

  return days.map((dayOfWeek) => ({
    dayOfWeek,
    label: PROGRAM_SCHEDULE_DAY_LABELS[dayOfWeek],
    isToday: dayOfWeek === today,
    items: sortItemsForDay(byDay.get(dayOfWeek) || []),
  }))
}
