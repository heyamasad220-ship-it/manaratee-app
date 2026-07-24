/**
 * Clamp ISO date (YYYY-MM-DD or timestamp) into a program's start/end window.
 * Used so late cash receipts still attribute to the academic year / season.
 */
export function clampDateToProgramYear(
  dateValue: string | null | undefined,
  programStart: string | null | undefined,
  programEnd: string | null | undefined
): string | null {
  if (!dateValue) return null
  const day = String(dateValue).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null

  const start = programStart ? String(programStart).slice(0, 10) : null
  const end = programEnd ? String(programEnd).slice(0, 10) : null

  if (end && /^\d{4}-\d{2}-\d{2}$/.test(end) && day > end) return end
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start) && day < start) return start
  return day
}

export function periodKeyClampedToProgramYear(
  dateValue: string | null | undefined,
  programStart: string | null | undefined,
  programEnd: string | null | undefined
): string | null {
  const clamped = clampDateToProgramYear(dateValue, programStart, programEnd)
  return clamped ? clamped.slice(0, 7) : null
}
