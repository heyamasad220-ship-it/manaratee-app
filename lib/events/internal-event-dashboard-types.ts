export type DashboardTimePeriod =
  | "today"
  | "this-week"
  | "this-month"
  | "all"
  | "past"

export interface EventManagementDashboardKpis {
  upcomingOneTimeCount: number
  upcomingRecurringCount: number
  childcareRequired: number
  volunteersRequired: number
  vendorsRequired: number
}

export interface DashboardUpcomingEventRow {
  id: string
  name: string
  startAt: string | null
  endAt: string | null
  href: string
  ticketed: boolean
  needsChildcare: boolean
  needsVolunteers: boolean
  needsVendors: boolean
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
  upcomingThisMonth: DashboardUpcomingEventRow[]
  attentionItems: DashboardAttentionItem[]
}
