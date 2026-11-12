export const RECURRING_FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "annually"] as const
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number]

export const RECURRING_STATUSES = [
  "pending_setup",
  "active",
  "paused",
  "past_due",
  "cancelled",
  "completed",
] as const
export type RecurringStatus = (typeof RECURRING_STATUSES)[number]

export type RecurringDonationPlan = {
  id: string
  organization_id: string
  donor_id: string
  contact_id: string | null
  campaign_id: string | null
  campaign_group_id: string | null
  category_id: string | null
  subcategory_id: string | null
  payment_method_id: string | null
  contact_payment_method_id: string | null
  amount: number
  frequency: RecurringFrequency
  status: RecurringStatus
  start_date: string
  next_payment_date: string
  end_date: string | null
  goal_amount: number | null
  pledge_id: string | null
  total_payments: number | null
  payments_made: number | null
  notes: string | null
  external_processor: string | null
  external_processor_id: string | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export type RecurringPlanWithDonor = RecurringDonationPlan & {
  donor_name: string | null
  donor_email: string | null
  donor_phone: string | null
  category_name: string | null
  fund_name: string | null
  campaign_name: string | null
  payment_method_label: string | null
  linked_payment_count: number
}

export type RecurringDashboardMetrics = {
  activeDonorCount: number
  activePlanCount: number
  onSchedulePlanCount: number
  pastDuePlanCount: number
  pastDueMonthlyAmount: number
  pausedPlanCount: number
  cancelledPlanCount: number
  monthlyRecurringRevenue: number
  annualRecurringRevenue: number
  actualRecurringRevenue: number
  upcomingThisMonth: number
}

export function recurringTodayDateOnly(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Active plans whose next charge date is today or later. Past dates are not expected income. */
export function isOnScheduleRecurringPlan(
  plan: { status?: string | null; next_payment_date?: string | null },
  today = recurringTodayDateOnly()
): boolean {
  if (String(plan.status || "").toLowerCase() !== "active") return false
  const next = String(plan.next_payment_date || "").slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(next) && next >= today
}

export type RecurringDonorSummary = {
  donorId: string
  activePlans: RecurringPlanWithDonor[]
  paymentHistory: Array<{
    id: string
    amount: number
    payment_date: string | null
    source: string | null
    recurring_donation_plan_id: string | null
  }>
  lifetimeRecurringGiving: number
}

export type RecurringReportingSummary = {
  recurringDonorCount: number
  totalRecurringRevenue: number
  byCampaign: Array<{ campaignId: string | null; campaignName: string; total: number; donorCount: number }>
  byDonor: Array<{ donorId: string; donorName: string; total: number; planCount: number }>
}

export function formatRecurringFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case "daily":
      return "Daily"
    case "weekly":
      return "Weekly"
    case "monthly":
      return "Monthly"
    case "quarterly":
      return "Quarterly"
    case "annually":
      return "Annually"
    default:
      return frequency
  }
}

export function formatRecurringStatusLabel(status: string): string {
  switch (status) {
    case "pending_setup":
      return "Pending Setup"
    case "past_due":
      return "Past Due"
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

export function monthlyEquivalentAmount(amount: number, frequency: RecurringFrequency): number {
  switch (frequency) {
    case "daily":
      return (amount * 365) / 12
    case "weekly":
      return (amount * 52) / 12
    case "monthly":
      return amount
    case "quarterly":
      return amount / 3
    case "annually":
      return amount / 12
    default:
      return amount
  }
}
