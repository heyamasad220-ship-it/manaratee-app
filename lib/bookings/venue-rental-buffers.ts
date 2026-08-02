export const MAX_BUFFER_MINUTES = 24 * 60

export type VenueRentalBufferPair = {
  setupMinutes: number
  cleanupMinutes: number
}

export function clampBufferMinutes(value: unknown, fallback = 0): number {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, MAX_BUFFER_MINUTES)
}

/** Convert hours (UI) to minutes for storage. */
export function hoursToBufferMinutes(hours: unknown): number {
  const parsed = Number(hours)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return clampBufferMinutes(Math.round(parsed * 60))
}

export function bufferMinutesToHours(minutes: number): number {
  return Math.round((clampBufferMinutes(minutes) / 60) * 100) / 100
}

/** Empty string → inherit org default (null). Otherwise hours → minutes. */
export function parseOptionalBufferHours(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return hoursToBufferMinutes(trimmed)
}

/** null/undefined → empty input (inherit). */
export function optionalBufferMinutesToHoursInput(
  minutes: number | null | undefined
): string {
  if (minutes == null) return ""
  return String(bufferMinutesToHours(minutes))
}

export function shiftIsoByMinutes(iso: string, minutes: number): string {
  const date = new Date(iso)
  date.setTime(date.getTime() + minutes * 60_000)
  return date.toISOString()
}
