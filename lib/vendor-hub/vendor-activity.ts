/** Vendors with Last Activity older than this window are inactive. */
export const VENDOR_INACTIVE_AFTER_MS = 1000 * 60 * 60 * 24 * 365 * 2

export function vendorLastActivityAt(input: {
  last_activity_at?: string | null
  created_at?: string | null
}) {
  return input.last_activity_at || input.created_at || null
}

/** Earliest valid timestamp among candidates (first activity). */
export function vendorFirstActivityAt(
  candidates: Array<string | null | undefined>
): string | null {
  let earliestMs: number | null = null
  let earliestValue: string | null = null

  for (const value of candidates) {
    if (!value) continue
    const trimmed = String(value).trim()
    if (!trimmed) continue
    const ms = new Date(trimmed).getTime()
    if (Number.isNaN(ms)) continue
    if (earliestMs === null || ms < earliestMs) {
      earliestMs = ms
      earliestValue = trimmed.length === 10 ? `${trimmed}T12:00:00.000Z` : trimmed
    }
  }

  return earliestValue
}

export function vendorInactiveCutoffDate(now = Date.now()) {
  return new Date(now - VENDOR_INACTIVE_AFTER_MS)
}

/** True when Last Activity is older than 2 years (or missing). */
export function isVendorInactiveByLastActivity(
  lastActivity: string | null | undefined,
  now = Date.now()
) {
  if (!lastActivity) return true
  const time = new Date(lastActivity).getTime()
  if (Number.isNaN(time)) return true
  return time < now - VENDOR_INACTIVE_AFTER_MS
}
