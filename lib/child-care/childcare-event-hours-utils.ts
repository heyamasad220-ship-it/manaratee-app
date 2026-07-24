/**
 * Estimate hours from display times like "12:00 PM" / "14:30".
 * Returns null when parsing fails.
 */
export function estimateHoursFromTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): number | null {
  const start = parseClockToMinutes(startTime)
  const end = parseClockToMinutes(endTime)
  if (start == null || end == null || end <= start) return null
  const hours = Math.round(((end - start) / 60) * 100) / 100
  if (hours <= 0 || hours > 24) return null
  return hours
}

function parseClockToMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim()
  const match12 =
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed) ||
    /^(\d{1,2})\s*(AM|PM)$/i.exec(trimmed)
  if (match12) {
    let hour = Number(match12[1])
    const minute = match12[2] && /^\d{2}$/.test(match12[2]) ? Number(match12[2]) : 0
    const meridiem = (match12[3] || match12[2] || "").toUpperCase()
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    if (meridiem === "PM" && hour < 12) hour += 12
    if (meridiem === "AM" && hour === 12) hour = 0
    return hour * 60 + minute
  }
  const match24 = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (match24) {
    const hour = Number(match24[1])
    const minute = Number(match24[2])
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
      return null
    }
    return hour * 60 + minute
  }
  return null
}
