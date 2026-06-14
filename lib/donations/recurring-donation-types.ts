export const RECURRING_FREQUENCIES = ["weekly", "monthly", "quarterly", "annually"] as const
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
  category_id: string | null
  subcategory_id: string | null
  payment_method_id: string | null
  amount: number
  frequency: RecurringFrequency
  status: RecurringStatus
  start_date: string
  next_payment_date: string
  end_date: string | null
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
  campaign_name: string | null
}

export type RecurringDashboardMetrics = {
  activeDonorCount: number
  activePlanCount: number
  pausedPlanCount: number
  cancelledPlanCount: number
  monthlyRecurringRevenue: number
  annualRecurringRevenue: number
  actualRecurringRevenue: number
  upcomingThisMonth: number
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
