import { EVENT_MANAGEMENT_EVENTS_PATH } from "@/lib/events/event-management-section-path"
import {
  formatEventRecurrenceSchedule,
  isInternalEventRecurring,
} from "@/lib/events/event-recurrence"
import {
  eventHasEnded,
  eventHasNotStarted,
  formatEventTimeRange,
} from "@/lib/events/internal-event-format"
import {
  INTERNAL_EVENT_STATUSES,
  toWorkspaceEventStatus,
} from "@/lib/events/internal-event-status"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"

export type EventManagementEventsStatusFilter = "active" | "draft" | "past" | "all"
export type EventManagementEventsTicketedFilter = "all" | "ticketed"
export type EventManagementEventsRecurrenceFilter = "one_time" | "recurring"

export type EventManagementEventsFilters = {
  q: string
  department: string
  status: EventManagementEventsStatusFilter
  ticketed: EventManagementEventsTicketedFilter
  category: string
  recurrence: EventManagementEventsRecurrenceFilter
}

export const DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS: EventManagementEventsFilters =
  {
    q: "",
    department: "all",
    status: "active",
    ticketed: "all",
    category: "all",
    recurrence: "one_time",
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

export const EVENT_MANAGEMENT_EVENTS_TICKETED_FILTER_ITEMS: Array<{
  value: EventManagementEventsTicketedFilter
  label: string
}> = [
  { value: "all", label: "All events" },
  { value: "ticketed", label: "Ticketed" },
]

export const EVENT_MANAGEMENT_EVENTS_RECURRENCE_FILTER_ITEMS: Array<{
  value: EventManagementEventsRecurrenceFilter
  label: string
}> = [
  { value: "one_time", label: "One-time" },
  { value: "recurring", label: "Recurring" },
]

const STATUS_FILTER_VALUES = new Set(
  EVENT_MANAGEMENT_EVENTS_STATUS_FILTER_ITEMS.map((item) => item.value)
)
const TICKETED_FILTER_VALUES = new Set(
  EVENT_MANAGEMENT_EVENTS_TICKETED_FILTER_ITEMS.map((item) => item.value)
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
  const ticketed = getParam(params, "ticketed")
  const recurrence = getParam(params, "recurrence")
  return {
    q: getParam(params, "q"),
    department: getParam(params, "department") || "all",
    status: STATUS_FILTER_VALUES.has(status as EventManagementEventsStatusFilter)
      ? (status as EventManagementEventsStatusFilter)
      : DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS.status,
    ticketed: TICKETED_FILTER_VALUES.has(
      ticketed as EventManagementEventsTicketedFilter
    )
      ? (ticketed as EventManagementEventsTicketedFilter)
      : DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS.ticketed,
    category: getParam(params, "category") || "all",
    recurrence:
      recurrence === "recurring" ? "recurring" : "one_time",
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
  if (filters.ticketed && filters.ticketed !== DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS.ticketed) {
    params.set("ticketed", filters.ticketed)
  }
  if (filters.category && filters.category !== "all") {
    params.set("category", filters.category)
  }
  if (filters.recurrence === "recurring") {
    params.set("recurrence", "recurring")
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
    event.coordinator?.full_name || "",
    event.coordinator?.email || "",
    event.coordinator?.phone || "",
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

function eventStartTime(event: InternalEventWithRelations) {
  return event.start_at
    ? new Date(event.start_at).getTime()
    : Number.POSITIVE_INFINITY
}

function sortEventsByStartAsc(events: InternalEventWithRelations[]) {
  return [...events].sort((left, right) => {
    const delta = eventStartTime(left) - eventStartTime(right)
    if (delta !== 0) return delta
    return (left.name || "").localeCompare(right.name || "")
  })
}

function sortEventsByStartDesc(events: InternalEventWithRelations[]) {
  return [...events].sort((left, right) => {
    const delta = eventStartTime(right) - eventStartTime(left)
    if (delta !== 0) return delta
    return (left.name || "").localeCompare(right.name || "")
  })
}

function sortEventManagementEvents(
  events: InternalEventWithRelations[],
  status: EventManagementEventsStatusFilter,
  now: Date
) {
  if (status === "past") {
    return sortEventsByStartDesc(events)
  }
  if (status === "all") {
    const upcoming = sortEventsByStartAsc(
      events.filter((event) => !eventHasEnded(event, now))
    )
    const past = sortEventsByStartDesc(
      events.filter((event) => eventHasEnded(event, now))
    )
    return [...upcoming, ...past]
  }
  return sortEventsByStartAsc(events)
}

function eventIsTicketed(event: InternalEventWithRelations) {
  return event.requires_ticketing === true
}

function matchesTicketedFilter(
  event: InternalEventWithRelations,
  ticketed: EventManagementEventsTicketedFilter | undefined
) {
  if (!ticketed || ticketed === "all") return true
  return eventIsTicketed(event)
}

function matchesCategoryFilter(
  event: InternalEventWithRelations,
  category: string | undefined
) {
  if (!category || category === "all") return true
  if (!eventIsTicketed(event)) return false
  if (category === "none") return !event.ticketing_category_id
  return event.ticketing_category_id === category
}

function matchesRecurrenceFilter(
  event: InternalEventWithRelations,
  recurrence: EventManagementEventsRecurrenceFilter | undefined,
  recurringKeys: Set<string>
) {
  if (!recurrence) return true
  const inSeries = recurringKeys.has(seriesGroupKey(event))
  return recurrence === "recurring" ? inSeries : !inSeries
}

function recurringSeriesKeys(events: InternalEventWithRelations[]) {
  const counts = new Map<string, number>()
  const keys = new Set<string>()
  for (const event of events) {
    const key = seriesGroupKey(event)
    counts.set(key, (counts.get(key) || 0) + 1)
    if (isInternalEventRecurring(event.recurrence_config)) {
      keys.add(key)
    }
  }
  for (const [key, count] of counts) {
    if (count > 1) keys.add(key)
  }
  return keys
}

function matchesSharedEventFilters(
  event: InternalEventWithRelations,
  filters: EventManagementEventsFilters,
  recurringKeys: Set<string>
) {
  if (!matchesEventSearch(event, filters.q)) return false
  if (
    filters.department !== "all" &&
    event.department_id !== filters.department
  ) {
    return false
  }
  if (!matchesTicketedFilter(event, filters.ticketed)) return false
  if (!matchesCategoryFilter(event, filters.category)) return false
  if (!matchesRecurrenceFilter(event, filters.recurrence, recurringKeys)) {
    return false
  }
  return true
}

export function filterEventManagementEvents(
  events: InternalEventWithRelations[],
  filters: EventManagementEventsFilters,
  now = new Date()
) {
  const recurringKeys = recurringSeriesKeys(events)
  const filtered = events.filter((event) => {
    if (!matchesSharedEventFilters(event, filters, recurringKeys)) return false
    return matchesEventStatus(event, filters.status, now)
  })
  return sortEventManagementEvents(filtered, filters.status, now)
}

function seriesGroupKey(event: InternalEventWithRelations) {
  const seriesId =
    event.recurrence_config &&
    typeof event.recurrence_config === "object" &&
    typeof event.recurrence_config.seriesId === "string"
      ? event.recurrence_config.seriesId.trim()
      : ""
  if (seriesId) return `series:${seriesId}`
  return `name:${(event.name || "").trim().toLowerCase()}`
}

function normalizedEventName(name: string) {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase()
}

function weekdayFromEvent(event: InternalEventWithRelations) {
  if (!event.start_at) return null
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: event.timezone || "America/Chicago",
  }).format(new Date(event.start_at))
  const index = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ].indexOf(weekday)
  return index >= 0 ? index : null
}

export type EventManagementSearchSeriesSummary = {
  name: string
  remainingCount: number
  totalCount: number
  schedule: string
  time: string
}

function formatSeriesSchedule(
  members: InternalEventWithRelations[],
  sample: InternalEventWithRelations
) {
  const fromConfig = formatEventRecurrenceSchedule(sample.recurrence_config)
  if (fromConfig) return fromConfig
  const weekdays = Array.from(
    new Set(
      members
        .map(weekdayFromEvent)
        .filter((day): day is number => day != null)
    )
  )
  if (weekdays.length === 1) {
    return `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekdays[0]]}`
  }
  return members.length === 1 ? "One-time" : "Custom dates"
}

export type EventManagementRecurringSeries = {
  key: string
  event: InternalEventWithRelations
  schedule: string
  remainingCount: number
  totalCount: number
}

function pickSeriesDisplayEvent(
  members: InternalEventWithRelations[],
  status: EventManagementEventsStatusFilter,
  now: Date
) {
  const upcoming = sortEventsByStartAsc(
    members.filter(
      (event) =>
        !eventHasEnded(event, now) &&
        toWorkspaceEventStatus(event.status) !== "draft"
    )
  )
  const drafts = sortEventsByStartAsc(
    members.filter((event) => toWorkspaceEventStatus(event.status) === "draft")
  )
  const past = sortEventsByStartDesc(
    members.filter((event) => eventHasEnded(event, now))
  )

  if (status === "draft") return drafts[0] || null
  if (status === "past") return upcoming.length > 0 ? null : past[0] || null
  if (status === "all") return upcoming[0] || past[0] || drafts[0] || null
  return upcoming[0] || null
}

export function listEventManagementRecurringSeries(
  events: InternalEventWithRelations[],
  filters: EventManagementEventsFilters,
  now = new Date()
): EventManagementRecurringSeries[] {
  const recurringKeys = recurringSeriesKeys(events)
  const groups = new Map<string, InternalEventWithRelations[]>()

  for (const event of events) {
    const key = seriesGroupKey(event)
    if (!recurringKeys.has(key)) continue
    if (!matchesEventSearch(event, filters.q)) continue
    if (
      filters.department !== "all" &&
      event.department_id !== filters.department
    ) {
      continue
    }
    if (!matchesTicketedFilter(event, filters.ticketed)) continue
    if (!matchesCategoryFilter(event, filters.category)) continue
    const group = groups.get(key) || []
    group.push(event)
    groups.set(key, group)
  }

  const rows: EventManagementRecurringSeries[] = []
  for (const [key, members] of groups) {
    const display = pickSeriesDisplayEvent(members, filters.status, now)
    if (!display) continue
    const remaining = members.filter((event) => !eventHasEnded(event, now))
    rows.push({
      key,
      event: display,
      schedule: formatSeriesSchedule(members, display),
      remainingCount: remaining.length,
      totalCount: members.length,
    })
  }

  const sorted = [...rows].sort((left, right) => {
    const delta = eventStartTime(left.event) - eventStartTime(right.event)
    if (delta !== 0) {
      return filters.status === "past" ? -delta : delta
    }
    return (left.event.name || "").localeCompare(right.event.name || "")
  })
  return sorted
}

export function getEventManagementSearchSeriesSummary(
  events: InternalEventWithRelations[],
  filters: EventManagementEventsFilters,
  now = new Date()
): EventManagementSearchSeriesSummary | null {
  if (!filters.q.trim()) return null

  const recurringKeys = recurringSeriesKeys(events)
  const matches = events.filter((event) =>
    matchesSharedEventFilters(event, filters, recurringKeys)
  )
  if (matches.length === 0) return null

  const names = new Set(matches.map((event) => normalizedEventName(event.name)))
  const keys = new Set(matches.map(seriesGroupKey))
  if (names.size !== 1 && keys.size !== 1) return null

  const remaining = sortEventsByStartAsc(
    matches.filter((event) => !eventHasEnded(event, now))
  )
  const sample = remaining[0] || sortEventsByStartAsc(matches)[0]
  return {
    name: sample.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || sample.name,
    remainingCount: remaining.length,
    totalCount: matches.length,
    schedule: formatSeriesSchedule(matches, sample),
    time: formatEventTimeRange(sample.start_at, sample.end_at),
  }
}

export type UpcomingEventsByRecurrence = {
  oneTimeCount: number
  recurringCount: number
}

/** Upcoming catalog counts: one-time dates plus one count per recurring series. */
export function countUpcomingEventsByRecurrence(
  events: InternalEventWithRelations[],
  now = new Date()
): UpcomingEventsByRecurrence {
  const listable = events.filter(
    (event) =>
      event.status !== INTERNAL_EVENT_STATUSES.cancelled &&
      event.status !== INTERNAL_EVENT_STATUSES.declined
  )
  const recurringKeys = recurringSeriesKeys(listable)
  const upcomingRecurringKeys = new Set<string>()
  let oneTimeCount = 0

  for (const event of listable) {
    if (!eventHasNotStarted(event, now)) continue
    const key = seriesGroupKey(event)
    if (recurringKeys.has(key)) {
      upcomingRecurringKeys.add(key)
    } else {
      oneTimeCount += 1
    }
  }

  return {
    oneTimeCount,
    recurringCount: upcomingRecurringKeys.size,
  }
}
