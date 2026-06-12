import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import {
  daysUntil,
  formatEventDate,
  formatEventTimeRange,
  isSameLocalDay,
} from "./internal-event-format"
import type {
  DashboardTimePeriod,
  DashboardAttentionItem,
  EventManagementDashboardData,
} from "./internal-event-dashboard-types"
import type { InternalEventWithRelations } from "./internal-event-types"
import { INTERNAL_EVENT_STATUSES } from "./internal-event-status"
import { getPendingInternalEventRequests } from "./internal-event-queries"

const EVENT_SELECT = `
  *,
  departments:department_id ( id, name, color ),
  event_types:event_type_id ( id, name ),
  venues:venue_id ( id, name )
`

function getPeriodRange(period: DashboardTimePeriod) {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  if (period === "today") {
    return { start, end }
  }

  if (period === "this-week") {
    const day = start.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + diff)
    end.setTime(start.getTime())
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (period === "this-month") {
    start.setDate(1)
    end.setMonth(start.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  start.setMonth(0, 1)
  end.setMonth(11, 31)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function eventOverlapsPeriod(
  event: InternalEventWithRelations,
  start: Date,
  end: Date
) {
  const eventStart = event.start_at ? new Date(event.start_at) : null
  const eventEnd = event.end_at ? new Date(event.end_at) : eventStart
  const createdAt = new Date(event.created_at)

  if (eventStart && eventEnd) {
    return eventStart <= end && eventEnd >= start
  }

  if (eventStart) {
    return eventStart >= start && eventStart <= end
  }

  return createdAt >= start && createdAt <= end
}

function getActionPriority(days: number): "high" | "medium" | "low" {
  if (days <= 7) return "high"
  if (days <= 21) return "medium"
  return "low"
}

function isOperationalEvent(status: string) {
  return (
    status !== INTERNAL_EVENT_STATUSES.cancelled &&
    status !== INTERNAL_EVENT_STATUSES.declined &&
    status !== INTERNAL_EVENT_STATUSES.draft
  )
}

function buildAttentionItems(
  events: InternalEventWithRelations[],
  pendingRequests: InternalEventWithRelations[],
  period: DashboardTimePeriod
): DashboardAttentionItem[] {
  const { start, end } = getPeriodRange(period)
  const inPeriod = events.filter((event) => eventOverlapsPeriod(event, start, end))
  const items: DashboardAttentionItem[] = []
  const seen = new Set<string>()

  function add(item: DashboardAttentionItem) {
    if (seen.has(item.id)) return
    seen.add(item.id)
    items.push(item)
  }

  for (const request of pendingRequests) {
    add({
      id: `${request.id}-approval`,
      title: request.name,
      description: "Event request awaiting supervisor approval",
      meta: formatEventDate(request.start_at || request.submitted_at || request.created_at),
      href: `/event-management/${request.id}`,
      priority: "high",
      kind: "approval",
    })
  }

  for (const event of inPeriod) {
    const href = `/event-management/${event.id}`
    const eventDateLabel = formatEventDate(event.start_at)
    const until = event.start_at ? daysUntil(new Date(event.start_at)) : 999
    const priority = event.start_at
      ? getActionPriority(until)
      : ("low" as const)

    if (event.status === INTERNAL_EVENT_STATUSES.draft) {
      if (!event.start_at) {
        add({
          id: `${event.id}-schedule`,
          title: event.name,
          description: "Add schedule and publish event",
          meta: eventDateLabel,
          href: `/event-management/${event.id}/edit`,
          priority: "medium",
          kind: "schedule",
        })
      } else if (until >= 0 && until <= 14) {
        add({
          id: `${event.id}-draft-upcoming`,
          title: event.name,
          description: `Still in draft — starts in ${until} day${until === 1 ? "" : "s"}`,
          meta: eventDateLabel,
          href,
          priority: until <= 7 ? "high" : "medium",
          kind: "draft",
        })
      } else {
        add({
          id: `${event.id}-draft`,
          title: event.name,
          description: "Confirm details and schedule event",
          meta: eventDateLabel,
          href,
          priority,
          kind: "draft",
        })
      }
    }

    if (
      event.status === INTERNAL_EVENT_STATUSES.scheduled &&
      !event.location_label &&
      !event.venue_id
    ) {
      add({
        id: `${event.id}-location`,
        title: event.name,
        description: "Assign location",
        meta: eventDateLabel,
        href: `/event-management/${event.id}/edit`,
        priority,
        kind: "location",
      })
    }

    if (!isOperationalEvent(event.status) || until < 0) {
      continue
    }

    if (event.requires_childcare) {
      add({
        id: `${event.id}-childcare`,
        title: event.name,
        description: "Assign childcare providers and registrations",
        meta: eventDateLabel,
        href: `${href}?tab=childcare`,
        priority,
        kind: "childcare",
      })
    }

    if (event.requires_volunteers) {
      add({
        id: `${event.id}-volunteers`,
        title: event.name,
        description: "Review volunteer sign-ups and roles",
        meta: eventDateLabel,
        href: `${href}?tab=volunteers`,
        priority,
        kind: "volunteers",
      })
    }

    if (event.requires_vendors) {
      add({
        id: `${event.id}-vendors`,
        title: event.name,
        description: "Confirm vendors for this event",
        meta: eventDateLabel,
        href: `${href}?tab=vendors`,
        priority,
        kind: "vendors",
      })
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  return items
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 12)
}

function buildDashboardFromEvents(
  events: InternalEventWithRelations[],
  pendingRequests: InternalEventWithRelations[],
  period: DashboardTimePeriod
): EventManagementDashboardData {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const activeEvents = events.filter(
    (event) => event.status !== INTERNAL_EVENT_STATUSES.cancelled
  )

  const kpis = {
    draftCount: activeEvents.filter(
      (event) => event.status === INTERNAL_EVENT_STATUSES.draft
    ).length,
    scheduledCount: activeEvents.filter(
      (event) => event.status === INTERNAL_EVENT_STATUSES.scheduled
    ).length,
    childcareRequired: activeEvents.filter(
      (event) =>
        event.requires_childcare === true && isOperationalEvent(event.status)
    ).length,
    volunteersRequired: activeEvents.filter(
      (event) =>
        event.requires_volunteers === true && isOperationalEvent(event.status)
    ).length,
    vendorsRequired: activeEvents.filter(
      (event) =>
        event.requires_vendors === true && isOperationalEvent(event.status)
    ).length,
    ticketedEvents: activeEvents.filter(
      (event) => event.requires_ticketing === true && isOperationalEvent(event.status)
    ).length,
  }

  const recentEvents = [...activeEvents]
    .sort((a, b) => {
      const aTime = a.start_at ? new Date(a.start_at).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b.start_at ? new Date(b.start_at).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })
    .slice(0, 8)
    .map((event) => ({
      id: event.id,
      name: event.name,
      departmentName: event.departments?.name || "No department",
      locationLabel: event.venues?.name || event.location_label,
      eventDate: event.start_at,
      status: event.status,
      href: `/event-management/${event.id}`,
    }))

  const todaysSchedule = events
    .filter((event) => {
      if (!event.start_at) return false
      if (event.status === INTERNAL_EVENT_STATUSES.cancelled) return false
      return isSameLocalDay(new Date(event.start_at), today)
    })
    .sort(
      (a, b) =>
        new Date(a.start_at!).getTime() - new Date(b.start_at!).getTime()
    )
    .map((event) => ({
      id: event.id,
      name: event.name,
      timeLabel: formatEventTimeRange(event.start_at, event.end_at),
      locationLabel: event.venues?.name || event.location_label,
      status: event.status,
      href: `/event-management/${event.id}`,
    }))

  const attentionItems = buildAttentionItems(events, pendingRequests, period)

  return {
    kpis,
    recentEvents,
    todaysSchedule,
    attentionItems,
  }
}

export async function getEventManagementDashboard(
  period: DashboardTimePeriod = "this-week"
): Promise<EventManagementDashboardData> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return buildDashboardFromEvents([], [], period)
  }

  const [eventsResult, pendingRequests] = await Promise.all([
    supabase
      .from("internal_events")
      .select(EVENT_SELECT)
      .eq("organization_id", organizationId)
      .order("start_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    getPendingInternalEventRequests(),
  ])

  const { data, error } = eventsResult

  if (error) {
    console.error(error)
    throw new Error("Failed to load event dashboard")
  }

  return buildDashboardFromEvents(
    (data || []) as InternalEventWithRelations[],
    pendingRequests,
    period
  )
}

export function parseDashboardTimePeriod(
  value: string | undefined
): DashboardTimePeriod {
  if (
    value === "today" ||
    value === "this-week" ||
    value === "this-month" ||
    value === "this-year"
  ) {
    return value
  }

  return "this-week"
}
