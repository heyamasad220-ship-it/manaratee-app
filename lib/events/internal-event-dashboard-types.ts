import type { InternalEventStatus } from "./internal-event-status"

export type DashboardTimePeriod =
  | "today"
  | "this-week"
  | "this-month"
  | "all"
  | "past"

export interface EventManagementDashboardKpis {
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
  attentionItems: DashboardAttentionItem[]
}
