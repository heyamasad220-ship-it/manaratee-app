import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import { getTicketedEventsOverview } from "@/lib/tickets/ticketing-overview-queries"
import { summarizeTicketedEventsOverview } from "@/lib/tickets/ticketing-overview-types"

import {
  daysUntil,
  eventHasEnded,
  formatEventDate,
} from "./internal-event-format"
import type {
  DashboardTimePeriod,
  DashboardAttentionItem,
  EventManagementDashboardData,
} from "./internal-event-dashboard-types"
import type { InternalEventWithRelations } from "./internal-event-types"
import { INTERNAL_EVENT_STATUSES } from "./internal-event-status"
import {
  getInternalEvents,
  getPendingInternalEventRequests,
} from "./internal-event-queries"

function getPeriodRange(period: Exclude<DashboardTimePeriod, "all" | "past">) {
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

  // this-month
  start.setDate(1)
  end.setMonth(start.getMonth() + 1, 0)
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

function isListableStatus(status: string) {
  return (
    status !== INTERNAL_EVENT_STATUSES.cancelled &&
    status !== INTERNAL_EVENT_STATUSES.declined
  )
}

function sortByStartAsc(a: InternalEventWithRelations, b: InternalEventWithRelations) {
  const aTime = a.start_at ? new Date(a.start_at).getTime() : Number.MAX_SAFE_INTEGER
  const bTime = b.start_at ? new Date(b.start_at).getTime() : Number.MAX_SAFE_INTEGER
  return aTime - bTime
}

function sortByStartDesc(a: InternalEventWithRelations, b: InternalEventWithRelations) {
  const aTime = a.start_at ? new Date(a.start_at).getTime() : 0
  const bTime = b.start_at ? new Date(b.start_at).getTime() : 0
  return bTime - aTime
}

/** Period-scoped event list for Overview (upcoming, or past when period is past). */
export function filterEventsForDashboardPeriod(
  events: InternalEventWithRelations[],
  period: DashboardTimePeriod,
  now = new Date()
): InternalEventWithRelations[] {
  const active = events.filter((event) => isListableStatus(event.status))

  if (period === "past") {
    return active.filter((event) => eventHasEnded(event, now)).sort(sortByStartDesc)
  }

  const upcoming = active.filter((event) => !eventHasEnded(event, now))

  if (period === "all") {
    return upcoming.sort(sortByStartAsc)
  }

  const { start, end } = getPeriodRange(period)
  return upcoming
    .filter((event) => eventOverlapsPeriod(event, start, end))
    .sort(sortByStartAsc)
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
  const inPeriod = filterEventsForDashboardPeriod(events, period)
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
        href: `${href}?tab=youth`,
        priority,
        kind: "childcare",
      })
    }

    if (event.requires_volunteers) {
      add({
        id: `${event.id}-volunteers`,
        title: event.name,
        description: "Assign staff or volunteers to tasks",
        meta: eventDateLabel,
        href: `${href}?tab=staff`,
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
  const periodEvents = filterEventsForDashboardPeriod(events, period)

  const kpis = {
    scheduledCount: periodEvents.filter(
      (event) => event.status === INTERNAL_EVENT_STATUSES.scheduled
    ).length,
    childcareRequired: periodEvents.filter(
      (event) =>
        event.requires_childcare === true && isOperationalEvent(event.status)
    ).length,
    volunteersRequired: periodEvents.filter(
      (event) =>
        event.requires_volunteers === true && isOperationalEvent(event.status)
    ).length,
    vendorsRequired: periodEvents.filter(
      (event) =>
        event.requires_vendors === true && isOperationalEvent(event.status)
    ).length,
    ticketedEvents: periodEvents.filter(
      (event) => event.requires_ticketing === true && isOperationalEvent(event.status)
    ).length,
  }

  return {
    kpis,
    ticketSales: {
      totalTicketedEvents: 0,
      activeTicketedEvents: 0,
      ticketsIssued: 0,
      revenueCents: 0,
      currency: "USD",
    },
    attentionItems: buildAttentionItems(events, pendingRequests, period),
  }
}

export async function getEventManagementDashboard(
  period: DashboardTimePeriod = "all",
  preloadedEvents?: InternalEventWithRelations[]
): Promise<EventManagementDashboardData> {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return buildDashboardFromEvents([], [], period)
  }

  const [events, pendingRequests, ticketedEvents] = await Promise.all([
    preloadedEvents
      ? Promise.resolve(preloadedEvents)
      : getInternalEvents(),
    getPendingInternalEventRequests(),
    getTicketedEventsOverview(),
  ])

  const dashboard = buildDashboardFromEvents(events, pendingRequests, period)
  const ticketSales = summarizeTicketedEventsOverview(ticketedEvents)

  return {
    ...dashboard,
    ticketSales: {
      totalTicketedEvents: ticketSales.totalEvents,
      activeTicketedEvents: ticketSales.activeEvents,
      ticketsIssued: ticketSales.ticketsIssued,
      revenueCents: ticketSales.revenueCents,
      currency: ticketSales.currency,
    },
  }
}

export function parseDashboardTimePeriod(
  value: string | undefined
): DashboardTimePeriod {
  if (
    value === "today" ||
    value === "this-week" ||
    value === "this-month" ||
    value === "all" ||
    value === "past"
  ) {
    return value
  }

  // Legacy bookmark
  if (value === "this-year") {
    return "all"
  }

  return "all"
}
