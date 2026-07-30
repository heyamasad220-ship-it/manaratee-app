/** Shared deep-link into Facilities calendar to open the event request drawer. */

/** Primary CTA label for opening the Facilities event create drawer. */
export const CREATE_EVENT_CTA_LABEL = "Create event"

/** Event Management collaboration calendar (read-only). */
export const MASTER_CALENDAR_LABEL = "Master Calendar"

/** Outline CTA that opens the Master Calendar. */
export const VIEW_MASTER_CALENDAR_CTA_LABEL = "View Master Calendar"

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
