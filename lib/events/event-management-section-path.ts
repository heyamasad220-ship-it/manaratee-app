import { MASTER_CALENDAR_LABEL } from "@/lib/events/facility-event-request-href"

export const EVENT_MANAGEMENT_PATH = "/event-management"
export const EVENT_MANAGEMENT_CALENDAR_PATH = `${EVENT_MANAGEMENT_PATH}/calendar`

export type EventManagementSectionTabId = "overview" | "calendar"

export type EventManagementSectionTab = {
  id: EventManagementSectionTabId
  label: string
  href: string
}

export const EVENT_MANAGEMENT_SECTION_TABS: EventManagementSectionTab[] = [
  {
    id: "overview",
    label: "Overview",
    href: EVENT_MANAGEMENT_PATH,
  },
  {
    id: "calendar",
    label: MASTER_CALENDAR_LABEL,
    href: EVENT_MANAGEMENT_CALENDAR_PATH,
  },
]

export function resolveEventManagementSectionTab(
  pathname: string
): EventManagementSectionTabId {
  if (
    pathname === EVENT_MANAGEMENT_CALENDAR_PATH ||
    pathname.startsWith(`${EVENT_MANAGEMENT_CALENDAR_PATH}/`)
  ) {
    return "calendar"
  }
  return "overview"
}

export function eventManagementMasterCalendarHref(options?: {
  month?: string | null
  departmentId?: string | null
  returnTo?: string | null
}) {
  const params = new URLSearchParams()
  if (options?.month) params.set("month", options.month)
  if (options?.departmentId) params.set("department", options.departmentId)
  if (options?.returnTo) params.set("returnTo", options.returnTo)
  const query = params.toString()
  return query
    ? `${EVENT_MANAGEMENT_CALENDAR_PATH}?${query}`
    : EVENT_MANAGEMENT_CALENDAR_PATH
}
