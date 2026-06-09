import type { InternalEventStatus } from "./internal-event-status"

export type DashboardTimePeriod = "today" | "this-week" | "this-month" | "this-year"

export interface EventManagementDashboardKpis {
  draftCount: number
  scheduledCount: number
  childcareRequired: number
  volunteersRequired: number
  vendorsRequired: number
  ticketedEvents: number
}

export interface DashboardEventRow {
  id: string
  name: string
  departmentName: string
  locationLabel: string | null
  eventDate: string | null
  status: InternalEventStatus
  href: string
}

export interface DashboardScheduleRow {
  id: string
  name: string
  timeLabel: string
  locationLabel: string | null
  status: InternalEventStatus
  href: string
}

export interface DashboardAlert {
  id: string
  type: "warning" | "info"
  message: string
  eventDate: string
  action: string
  href: string
}

export interface DashboardActionItem {
  id: string
  eventName: string
  eventDate: string
  actionRequired: string
  daysUntil: number
  priority: "high" | "medium" | "low"
  href: string
}

export interface EventManagementDashboardData {
  kpis: EventManagementDashboardKpis
  recentEvents: DashboardEventRow[]
  todaysSchedule: DashboardScheduleRow[]
  operationalAlerts: DashboardAlert[]
  eventsNeedingAction: DashboardActionItem[]
}
