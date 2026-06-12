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

export interface DashboardAttentionItem {
  id: string
  title: string
  description: string
  meta: string
  href: string
  priority: "high" | "medium" | "low"
  kind: "approval" | "childcare" | "volunteers" | "vendors" | "draft" | "schedule" | "location"
}

export interface EventManagementDashboardData {
  kpis: EventManagementDashboardKpis
  recentEvents: DashboardEventRow[]
  todaysSchedule: DashboardScheduleRow[]
  attentionItems: DashboardAttentionItem[]
}
