import { EVENT_MANAGEMENT_EVENTS_PATH } from "@/lib/events/event-management-section-path"
import { eventHasEnded } from "@/lib/events/internal-event-format"
import { toWorkspaceEventStatus } from "@/lib/events/internal-event-status"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"

export type EventManagementEventsStatusFilter = "active" | "draft" | "past" | "all"

export type EventManagementEventsFilters = {
  q: string
  department: string
  status: EventManagementEventsStatusFilter
}

export const DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS: EventManagementEventsFilters =
  {
    q: "",
    department: "all",
    status: "active",
  }

export const EVENT_MANAGEMENT_EVENTS_STATUS_FILTER_ITEMS: Array<{
  value: EventManagementEventsStatusFilter
  label: string
}> = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
]

const STATUS_FILTER_VALUES = new Set(
  EVENT_MANAGEMENT_EVENTS_STATUS_FILTER_ITEMS.map((item) => item.value)
)

function getParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string
) {
  if (params instanceof URLSearchParams) {
    return params.get(key) || ""
  }
  const value = params[key]
  return Array.isArray(value) ? value[0] || "" : value || ""
}

export function parseEventManagementEventsFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): EventManagementEventsFilters {
  const status = getParam(params, "status")
  return {
    q: getParam(params, "q"),
    department: getParam(params, "department") || "all",
    status: STATUS_FILTER_VALUES.has(status as EventManagementEventsStatusFilter)
      ? (status as EventManagementEventsStatusFilter)
      : DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS.status,
  }
}

export function buildEventManagementEventsHref(
  filters: EventManagementEventsFilters
) {
  const params = new URLSearchParams()
  if (filters.q.trim()) params.set("q", filters.q.trim())
  if (filters.department && filters.department !== "all") {
    params.set("department", filters.department)
  }
  if (filters.status && filters.status !== DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS.status) {
    params.set("status", filters.status)
  }
  const query = params.toString()
  return query
    ? `${EVENT_MANAGEMENT_EVENTS_PATH}?${query}`
    : EVENT_MANAGEMENT_EVENTS_PATH
}

function matchesEventSearch(
  event: InternalEventWithRelations,
  query: string
) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    event.name,
    event.departments?.name || "",
    event.event_types?.name || "",
    event.location_label || "",
    ...(event.venueNames ?? []),
    event.venues?.name || "",
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(q)
}

function matchesEventStatus(
  event: InternalEventWithRelations,
  status: EventManagementEventsStatusFilter,
  now = new Date()
) {
  if (status === "all") return true
  if (status === "draft") {
    return toWorkspaceEventStatus(event.status) === "draft"
  }
  if (status === "past") {
    return eventHasEnded(event, now)
  }
  return (
    toWorkspaceEventStatus(event.status) !== "draft" &&
    !eventHasEnded(event, now)
  )
}

function sortEventsForStatus(
  events: InternalEventWithRelations[],
  status: EventManagementEventsStatusFilter
) {
  const copy = [...events]
  if (status === "past") {
    return copy.sort((left, right) => {
      const leftTime = left.start_at ? new Date(left.start_at).getTime() : 0
      const rightTime = right.start_at ? new Date(right.start_at).getTime() : 0
      return rightTime - leftTime
    })
  }
  return copy.sort((left, right) => {
    const leftTime = left.start_at
      ? new Date(left.start_at).getTime()
      : Number.MAX_SAFE_INTEGER
    const rightTime = right.start_at
      ? new Date(right.start_at).getTime()
      : Number.MAX_SAFE_INTEGER
    return leftTime - rightTime
  })
}

export function filterEventManagementEvents(
  events: InternalEventWithRelations[],
  filters: EventManagementEventsFilters,
  now = new Date()
) {
  const filtered = events.filter((event) => {
    if (!matchesEventSearch(event, filters.q)) return false
    if (
      filters.department !== "all" &&
      event.department_id !== filters.department
    ) {
      return false
    }
    return matchesEventStatus(event, filters.status, now)
  })
  return sortEventsForStatus(filtered, filters.status)
}
