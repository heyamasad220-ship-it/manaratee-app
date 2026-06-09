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
  EventManagementDashboardData,
} from "./internal-event-dashboard-types"
import type { InternalEventWithRelations } from "./internal-event-types"
import { INTERNAL_EVENT_STATUSES } from "./internal-event-status"

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

function buildDashboardFromEvents(
  events: InternalEventWithRelations[],
  period: DashboardTimePeriod
): EventManagementDashboardData {
  const { start, end } = getPeriodRange(period)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const inPeriod = events.filter((event) => eventOverlapsPeriod(event, start, end))
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
    childcareRequired: 0,
    volunteersRequired: 0,
    vendorsRequired: 0,
    ticketedEvents: 0,
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

  const operationalAlerts = inPeriod
    .flatMap((event) => {
      const alerts: EventManagementDashboardData["operationalAlerts"] = []
      const href = `/event-management/${event.id}`

      if (event.status !== INTERNAL_EVENT_STATUSES.draft) {
        return alerts
      }

      if (!event.start_at) {
        alerts.push({
          id: `${event.id}-schedule`,
          type: "warning",
          message: `${event.name} is missing a start date`,
          eventDate: formatEventDate(event.created_at),
          action: "Edit Event",
          href,
        })
        return alerts
      }

      const until = daysUntil(new Date(event.start_at))
      if (until >= 0 && until <= 14) {
        alerts.push({
          id: `${event.id}-draft-upcoming`,
          type: until <= 7 ? "warning" : "info",
          message: `${event.name} is still in draft and starts in ${until} day${until === 1 ? "" : "s"}`,
          eventDate: formatEventDate(event.start_at),
          action: "Review Event",
          href,
        })
      }

      if (!event.location_label && !event.venue_id) {
        alerts.push({
          id: `${event.id}-location`,
          type: "info",
          message: `${event.name} has no location assigned`,
          eventDate: formatEventDate(event.start_at),
          action: "Add Location",
          href: `/event-management/${event.id}/edit`,
        })
      }

      return alerts
    })
    .slice(0, 6)

  const eventsNeedingAction = inPeriod
    .filter((event) => event.status !== INTERNAL_EVENT_STATUSES.cancelled)
    .flatMap((event) => {
      const href = `/event-management/${event.id}`
      const items: EventManagementDashboardData["eventsNeedingAction"] = []

      if (event.status === INTERNAL_EVENT_STATUSES.draft) {
        items.push({
          id: `${event.id}-draft`,
          eventName: event.name,
          eventDate: formatEventDate(event.start_at),
          actionRequired: event.start_at
            ? "Confirm details and schedule event"
            : "Add schedule and publish event",
          daysUntil: event.start_at ? daysUntil(new Date(event.start_at)) : 999,
          priority: event.start_at
            ? getActionPriority(daysUntil(new Date(event.start_at)))
            : "low",
          href,
        })
      }

      if (
        event.status === INTERNAL_EVENT_STATUSES.scheduled &&
        !event.location_label &&
        !event.venue_id
      ) {
        items.push({
          id: `${event.id}-location`,
          eventName: event.name,
          eventDate: formatEventDate(event.start_at),
          actionRequired: "Assign location",
          daysUntil: event.start_at ? daysUntil(new Date(event.start_at)) : 999,
          priority: event.start_at
            ? getActionPriority(daysUntil(new Date(event.start_at)))
            : "medium",
          href: `/event-management/${event.id}/edit`,
        })
      }

      return items
    })
    .filter((item) => item.daysUntil >= 0 && item.daysUntil <= 90)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 8)

  return {
    kpis,
    recentEvents,
    todaysSchedule,
    operationalAlerts,
    eventsNeedingAction,
  }
}

export async function getEventManagementDashboard(
  period: DashboardTimePeriod = "this-week"
): Promise<EventManagementDashboardData> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return buildDashboardFromEvents([], period)
  }

  const { data, error } = await supabase
    .from("internal_events")
    .select(EVENT_SELECT)
    .eq("organization_id", organizationId)
    .order("start_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) {
    console.error(error)
    throw new Error("Failed to load event dashboard")
  }

  return buildDashboardFromEvents(
    (data || []) as InternalEventWithRelations[],
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
