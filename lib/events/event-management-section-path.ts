import { MASTER_CALENDAR_LABEL } from "@/lib/events/facility-event-request-href"

export const EVENT_MANAGEMENT_PATH = "/event-management"
export const EVENT_MANAGEMENT_EVENTS_PATH = `${EVENT_MANAGEMENT_PATH}/events`
export const EVENT_MANAGEMENT_CALENDAR_PATH = `${EVENT_MANAGEMENT_PATH}/calendar`
export const EVENT_MANAGEMENT_TICKETING_PATH = `${EVENT_MANAGEMENT_PATH}/ticketing`
export const EVENT_MANAGEMENT_TICKETING_EVENTS_PATH = `${EVENT_MANAGEMENT_TICKETING_PATH}/events`
export const EVENT_MANAGEMENT_TICKETING_ORDERS_PATH = `${EVENT_MANAGEMENT_TICKETING_PATH}/orders`
export const EVENT_MANAGEMENT_TICKETING_CHECK_IN_PATH = `${EVENT_MANAGEMENT_TICKETING_PATH}/check-in`
export const EVENT_MANAGEMENT_TICKETING_SETTINGS_PATH = `${EVENT_MANAGEMENT_TICKETING_PATH}/settings`
export const EVENT_MANAGEMENT_CHECK_IN_LEGACY_PATH = `${EVENT_MANAGEMENT_PATH}/check-in`
/** Canonical org-wide door desk: Ticketing → Check-in. */
export const EVENT_MANAGEMENT_CHECK_IN_PATH =
  EVENT_MANAGEMENT_TICKETING_CHECK_IN_PATH

export type EventTicketingSection =
  | "tickets"
  | "checkout"
  | "orders"
  | "check-in"
  | "reports"

/** Sections on the event workspace Ticketing tab. */
export type EventTicketingPanelSection = "settings" | "orders" | "check-in"

/** Legacy route kept so old links redirect into the event workspace. */
export function eventTicketingWorkspacePath(eventId: string) {
  return `/event-management/${eventId}/ticketing`
}

export function parseEventTicketingPanelSection(
  value: string | null | undefined
): EventTicketingPanelSection {
  if (value === "orders" || value === "reports" || value === "attendees") return "orders"
  if (value === "check-in" || value === "checkin") return "check-in"
  return "settings"
}

export function eventTicketingWorkspaceHref(
  eventId: string,
  section: EventTicketingSection | EventTicketingPanelSection = "settings"
) {
  const panel = parseEventTicketingPanelSection(section)
  const params = new URLSearchParams()
  params.set("tab", "ticketing")
  if (panel !== "settings") params.set("section", panel)
  return `/event-management/${eventId}?${params.toString()}`
}

/**
 * When an event URL should open Ticketing inside the workspace, returns that
 * href. Returns null when the URL is already the canonical Ticketing address.
 */
export function canonicalEventWorkspaceTicketingHref(
  eventId: string,
  tab: string | null | undefined,
  section: string | null | undefined
): string | null {
  if (tab === "ticketing") {
    const panel = parseEventTicketingPanelSection(section)
    const canonicalSection = panel === "settings" ? null : panel
    if ((section ?? null) === canonicalSection) return null
    return eventTicketingWorkspaceHref(eventId, panel)
  }
  const legacy = legacyEventTicketSection(tab, section)
  if (!legacy) return null
  return eventTicketingWorkspaceHref(eventId, legacy)
}

/** Old ticket URLs open the event workspace Ticketing tab. */
export function legacyEventTicketSection(
  tab: string | null | undefined,
  section: string | null | undefined
): EventTicketingSection | null {
  if (tab === "orders" || tab === "attendees") return "orders"
  if (tab === "tickets" || tab === "ticketing" || tab === "registration") {
    return "tickets"
  }
  if (
    tab === "settings" &&
    (section === "tickets" || section === "ticketing" || section === "registration")
  ) {
    return "tickets"
  }
  if (tab === "settings" && section === "checkout") return "checkout"
  return null
}

export function parseEventTicketingSection(
  value: string | null | undefined
): EventTicketingSection {
  if (value === "checkout" || value === "orders" || value === "reports") {
    return value
  }
  if (value === "check-in" || value === "checkin") return "check-in"
  return "tickets"
}

/** @deprecated Section tabs removed — Events and Master Calendar are sidebar items. */
export type EventManagementSectionTabId = "overview" | "calendar"

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

export { MASTER_CALENDAR_LABEL }
