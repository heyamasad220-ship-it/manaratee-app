"use server"

import { createClient } from "@/lib/supabase/server"
import {
  buildRecurringDashboardMetrics,
  buildRecurringDonorSummary,
  buildRecurringReportingSummary,
  fetchRecurringPlans,
} from "@/lib/donations/recurring-donation-data"
import {
  calculateNextPaymentDate,
  initialNextPaymentDate,
} from "@/lib/donations/recurring-donation-schedule"
import type {
  RecurringFrequency,
  RecurringStatus,
} from "@/lib/donations/recurring-donation-types"

async function getOrgIdForUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, orgId: null as string | null, userId: null as string | null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()

  return { supabase, orgId: profile?.organization_id ?? null, userId: user.id }
}

export async function getRecurringDashboardAction() {
  const { supabase, orgId } = await getOrgIdForUser()
  if (!orgId) return { success: false as const, error: "No organization" }
  try {
    const [metrics, plans] = await Promise.all([
      buildRecurringDashboardMetrics(supabase, orgId),
      fetchRecurringPlans(supabase, orgId),
    ])
    return { success: true as const, metrics, plans }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function createRecurringDonationPlanAction(input: {
  donorId: string
  contactId?: string | null
  campaignId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  paymentMethodId?: string | null
  amount: number
  frequency: RecurringFrequency
  startDate: string
  notes?: string | null
}) {
  const { supabase, orgId } = await getOrgIdForUser()
  if (!orgId) return { success: false as const, error: "No organization" }
  if (!input.amount || input.amount <= 0) {
    return { success: false as const, error: "Amount must be greater than zero" }
  }

  const nextPaymentDate = initialNextPaymentDate(input.startDate, input.frequency)

  const { data, error } = await supabase
    .from("recurring_donation_plans")
    .insert({
      organization_id: orgId,
      donor_id: input.donorId,
      contact_id: input.contactId ?? null,
      campaign_id: input.campaignId ?? null,
      category_id: input.categoryId ?? null,
      subcategory_id: input.subcategoryId ?? null,
      payment_method_id: input.paymentMethodId ?? null,
      amount: input.amount,
      frequency: input.frequency,
      status: "active",
      start_date: input.startDate,
      next_payment_date: nextPaymentDate,
      notes: input.notes ?? null,
    })
    .select("id")
    .single()

  if (error) return { success: false as const, error: error.message }
  return { success: true as const, planId: data.id }
}

export async function updateRecurringPlanStatusAction(
  planId: string,
  status: RecurringStatus
) {
  const { supabase, orgId } = await getOrgIdForUser()
  if (!orgId) return { success: false as const, error: "No organization" }

  const patch: Record<string, unknown> = { status }
  if (status === "cancelled") {
    patch.end_date = new Date().toISOString().slice(0, 10)
  }
  if (status === "completed") {
    patch.end_date = new Date().toISOString().slice(0, 10)
  }

  const { error } = await supabase
    .from("recurring_donation_plans")
    .update(patch)
    .eq("id", planId)
    .eq("organization_id", orgId)

  if (error) return { success: false as const, error: error.message }
  return { success: true as const, status }
}

export async function recordRecurringDonationPaymentAction(input: {
  planId: string
  amount?: number
  paymentDate?: string
  source?: string
  memo?: string
}) {
  const { supabase, orgId } = await getOrgIdForUser()
  if (!orgId) return { success: false as const, error: "No organization" }

  const { data: plan, error: planError } = await supabase
    .from("recurring_donation_plans")
    .select("*")
    .eq("id", input.planId)
    .eq("organization_id", orgId)
    .single()

  if (planError || !plan) {
    return { success: false as const, error: planError?.message || "Plan not found" }
  }

  if (plan.status !== "active" && plan.status !== "paused") {
    return { success: false as const, error: "Only active or paused plans can receive payments" }
  }

  const amount = input.amount ?? Number(plan.amount)
  const paymentDate = input.paymentDate
    ? `${input.paymentDate}T12:00:00`
    : new Date().toISOString()

  const { data: donor } = await supabase
    .from("donors")
    .select("full_name, email, contact_id")
    .eq("id", plan.donor_id)
    .maybeSingle()

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      organization_id: orgId,
      donor_id: plan.donor_id,
      contact_id: plan.contact_id ?? donor?.contact_id ?? null,
      campaign_id: plan.campaign_id,
      category_id: plan.category_id,
      subcategory_id: plan.subcategory_id,
      pledge_id: null,
      recurring_donation_plan_id: plan.id,
      sender_name: donor?.full_name || donor?.email || null,
      amount,
      payment_date: paymentDate,
      source: input.source || "cash",
      source_type: "manual",
      memo: input.memo || `Recurring donation — ${plan.frequency}`,
      status: "unallocated",
      is_verified: false,
    })
    .select("id, amount")
    .single()

  if (paymentError) return { success: false as const, error: paymentError.message }

  const nextPaymentDate = calculateNextPaymentDate(
    plan.next_payment_date,
    plan.frequency as RecurringFrequency
  )

  const { error: updateError } = await supabase
    .from("recurring_donation_plans")
    .update({
      next_payment_date: nextPaymentDate,
      status: plan.status === "paused" ? "paused" : "active",
    })
    .eq("id", plan.id)
    .eq("organization_id", orgId)

  if (updateError) return { success: false as const, error: updateError.message }

  return {
    success: true as const,
    payment,
    nextPaymentDate,
  }
}

export async function getDonorRecurringSummaryAction(donorId: string) {
  const { supabase, orgId } = await getOrgIdForUser()
  if (!orgId) return { success: false as const, error: "No organization" }
  try {
    const summary = await buildRecurringDonorSummary(supabase, orgId, donorId)
    return { success: true as const, summary }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getRecurringReportingSummaryAction() {
  const { supabase, orgId } = await getOrgIdForUser()
  if (!orgId) return { success: false as const, error: "No organization" }
  try {
    const summary = await buildRecurringReportingSummary(supabase, orgId)
    return { success: true as const, summary }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
