import type { CustomerDashboardCampaign } from "@/components/customer/customer-dashboard-campaigns"

export const CUSTOMER_DASHBOARD_FEATURED_CAMPAIGN_LIMIT = 2
export const CUSTOMER_DASHBOARD_ACTIVITY_LIMIT = 5

export type CustomerDashboardSummaryCard = {
  key: string
  title: string
  value: string
  href?: string
  accent: "emerald" | "primary" | "amber"
}

export type CustomerDashboardAttentionItem = {
  id: string
  title: string
  description: string
  href: string
  actionLabel: string
}

export type CustomerDashboardActivityItem = {
  id: string
  occurredAt: string
  dateLabel: string
  title: string
  subtitle: string
  amountLabel: string | null
}

export type CustomerDashboardPageData = {
  donationsEnabled: boolean
  summaryCards: CustomerDashboardSummaryCard[]
  attentionItems: CustomerDashboardAttentionItem[]
  featuredCampaigns: CustomerDashboardCampaign[]
  recentActivity: CustomerDashboardActivityItem[]
}
