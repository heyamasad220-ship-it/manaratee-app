/** Shared deep-link into Facilities calendar to open the event request drawer. */

/** Primary CTA label for opening the Facilities event create drawer. */
export const CREATE_EVENT_CTA_LABEL = "Create event"

/** Departments collaboration calendar (read-only). */
export const MASTER_CALENDAR_LABEL = "Master Calendar"

/** Outline CTA that opens the Master Calendar. */
export const VIEW_MASTER_CALENDAR_CTA_LABEL = "View Master Calendar"

/** Outline CTA that opens Facilities calendar for room conflicts / availability. */
export const CHECK_SPACE_AVAILABILITY_CTA_LABEL = "Check space availability"

export function buildFacilitiesBookSpaceHref(options?: {
  departmentId?: string | null
  returnTo?: string | null
  openNew?: boolean
  venueId?: string | null
  start?: string | null
  end?: string | null
  date?: string | null
}): string {
  const params = new URLSearchParams()
  if (options?.departmentId) params.set("department", options.departmentId)
  if (options?.returnTo) params.set("returnTo", options.returnTo)
  if (options?.openNew !== false) params.set("openNew", "1")
  if (options?.venueId) params.set("venueId", options.venueId)
  if (options?.start) params.set("start", options.start)
  if (options?.end) params.set("end", options.end)
  if (options?.date) params.set("date", options.date)

  const query = params.toString()
  return query ? `/facilities/calendar?${query}` : "/facilities/calendar"
}

/** Facilities calendar for viewing availability (no create drawer). */
export function buildFacilitiesCalendarHref(options?: {
  departmentId?: string | null
  returnTo?: string | null
  /** Comma-separated `sources=` filter; omit for all sources. */
  sources?: string | null
}): string {
  const params = new URLSearchParams()
  if (options?.departmentId) params.set("department", options.departmentId)
  if (options?.returnTo) params.set("returnTo", options.returnTo)
  if (options?.sources) params.set("sources", options.sources)
  const query = params.toString()
  return query ? `/facilities/calendar?${query}` : "/facilities/calendar"
}
