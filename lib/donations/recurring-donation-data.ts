import type { SupabaseClient } from "@supabase/supabase-js"
import {
  monthlyEquivalentAmount,
  type RecurringDashboardMetrics,
  type RecurringDonationPlan,
  type RecurringDonorSummary,
  type RecurringPlanWithDonor,
  type RecurringReportingSummary,
  type RecurringStatus,
} from "@/lib/donations/recurring-donation-types"

function isVoidedPayment(status: string | null | undefined): boolean {
  return String(status || "").toLowerCase() === "voided"
}

export async function fetchRecurringPlans(
  supabase: SupabaseClient,
  organizationId: string,
  filters?: { status?: RecurringStatus; donorId?: string }
): Promise<RecurringPlanWithDonor[]> {
  let query = supabase
    .from("recurring_donation_plans")
    .select(
      "*, donors(full_name, email), contacts(phone), donation_categories(name), donation_subcategories(name), campaigns(name)"
    )
    .eq("organization_id", organizationId)
    .order("next_payment_date", { ascending: true })

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.donorId) query = query.eq("donor_id", filters.donorId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const linkedPaymentCountByPlanId = new Map<string, number>()
  let paymentFrom = 0

  while (true) {
    const { data: paymentRows, error: paymentError } = await supabase
      .from("payments")
      .select("recurring_donation_plan_id, status")
      .eq("organization_id", organizationId)
      .not("recurring_donation_plan_id", "is", null)
      .range(paymentFrom, paymentFrom + 999)

    if (paymentError) throw new Error(paymentError.message)
    if (!paymentRows?.length) break

    for (const payment of paymentRows) {
      if (isVoidedPayment(payment.status)) continue
      const planId = payment.recurring_donation_plan_id as string
      linkedPaymentCountByPlanId.set(planId, (linkedPaymentCountByPlanId.get(planId) || 0) + 1)
    }

    if (paymentRows.length < 1000) break
    paymentFrom += 1000
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    organization_id: row.organization_id,
    donor_id: row.donor_id,
    contact_id: row.contact_id,
    campaign_id: row.campaign_id,
    category_id: row.category_id,
    subcategory_id: row.subcategory_id,
    payment_method_id: row.payment_method_id,
    amount: Number(row.amount || 0),
    frequency: row.frequency,
    status: row.status,
    start_date: row.start_date,
    next_payment_date: row.next_payment_date,
    end_date: row.end_date,
    total_payments: row.total_payments == null ? null : Number(row.total_payments),
    payments_made: row.payments_made == null ? null : Number(row.payments_made),
    notes: row.notes,
    external_processor: row.external_processor,
    external_processor_id: row.external_processor_id,
    stripe_customer_id: row.stripe_customer_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    donor_name: row.donors?.full_name ?? null,
    donor_email: row.donors?.email ?? null,
    donor_phone: row.contacts?.phone ?? null,
    category_name: row.donation_categories?.name ?? null,
    fund_name: row.donation_subcategories?.name ?? null,
    campaign_name: row.campaigns?.name ?? null,
    linked_payment_count: linkedPaymentCountByPlanId.get(row.id) || 0,
  }))
}

export async function buildRecurringDashboardMetrics(
  supabase: SupabaseClient,
  organizationId: string,
  preloadedPlans?: RecurringPlanWithDonor[]
): Promise<RecurringDashboardMetrics> {
  const plans = preloadedPlans ?? (await fetchRecurringPlans(supabase, organizationId))

  const activePlans = plans.filter((p) => p.status === "active")
  const pausedPlans = plans.filter((p) => p.status === "paused")
  const cancelledPlans = plans.filter((p) => p.status === "cancelled")

  const activeDonorIds = new Set(activePlans.map((p) => p.donor_id))

  let monthlyRecurringRevenue = 0
  for (const plan of activePlans) {
    monthlyRecurringRevenue += monthlyEquivalentAmount(plan.amount, plan.frequency)
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const upcomingThisMonth = activePlans.filter((plan) => {
    const next = new Date(plan.next_payment_date + "T00:00:00")
    return next >= monthStart && next <= monthEnd
  }).length

  const { data: recurringPayments } = await supabase
    .from("payments")
    .select("amount, status")
    .eq("organization_id", organizationId)
    .not("recurring_donation_plan_id", "is", null)

  const actualRecurringRevenue = (recurringPayments || [])
    .filter((p) => !isVoidedPayment(p.status))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  return {
    activeDonorCount: activeDonorIds.size,
    activePlanCount: activePlans.length,
    pausedPlanCount: pausedPlans.length,
    cancelledPlanCount: cancelledPlans.length,
    monthlyRecurringRevenue,
    annualRecurringRevenue: monthlyRecurringRevenue * 12,
    actualRecurringRevenue,
    upcomingThisMonth,
  }
}

export async function buildRecurringDonorSummary(
  supabase: SupabaseClient,
  organizationId: string,
  donorId: string
): Promise<RecurringDonorSummary> {
  const activePlans = await fetchRecurringPlans(supabase, organizationId, { donorId })

  const { data: payments, error } = await supabase
    .from("payments")
    .select("id, amount, payment_date, source, status, recurring_donation_plan_id")
    .eq("organization_id", organizationId)
    .eq("donor_id", donorId)
    .not("recurring_donation_plan_id", "is", null)
    .order("payment_date", { ascending: false })

  if (error) throw new Error(error.message)

  const paymentHistory = (payments || [])
    .filter((p) => !isVoidedPayment(p.status))
    .map((p) => ({
      id: p.id,
      amount: Number(p.amount || 0),
      payment_date: p.payment_date,
      source: p.source,
      recurring_donation_plan_id: p.recurring_donation_plan_id,
    }))

  const lifetimeRecurringGiving = paymentHistory.reduce((sum, p) => sum + p.amount, 0)

  return {
    donorId,
    activePlans: activePlans.filter((p) => p.status === "active" || p.status === "paused"),
    paymentHistory,
    lifetimeRecurringGiving,
  }
}

export async function buildRecurringReportingSummary(
  supabase: SupabaseClient,
  organizationId: string
): Promise<RecurringReportingSummary> {
  const { fetchRecurringReportSummary } = await import("@/lib/donations/campaign-analytics")
  return fetchRecurringReportSummary(supabase, organizationId)
}
