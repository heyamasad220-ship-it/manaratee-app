"use server"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
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
import { validateOpenDonationFund } from "@/lib/donations/donation-fund-status"

export async function getRecurringDashboardAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  try {
    const plans = await fetchRecurringPlans(access.supabase, access.orgId)
    const metrics = await buildRecurringDashboardMetrics(
      access.supabase,
      access.orgId,
      plans
    )
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
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access
  if (!input.amount || input.amount <= 0) {
    return { success: false as const, error: "Amount must be greater than zero" }
  }

  const nextPaymentDate = initialNextPaymentDate(input.startDate, input.frequency)

  const fundCheck = await validateOpenDonationFund(supabase, orgId, input.subcategoryId)
  if (!fundCheck.ok) {
    return { success: false as const, error: fundCheck.error }
  }

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
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  const { data: existing, error: existingError } = await supabase
    .from("recurring_donation_plans")
    .select("id, status")
    .eq("id", planId)
    .eq("organization_id", orgId)
    .maybeSingle()

  if (existingError || !existing) {
    return { success: false as const, error: existingError?.message || "Plan not found" }
  }

  if (String(existing.status) === "completed") {
    return {
      success: false as const,
      error: "Completed plans cannot be changed. Create a new plan instead.",
    }
  }

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
  attributedGroupContactId?: string | null
}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  const { data: plan, error: planError } = await supabase
    .from("recurring_donation_plans")
    .select("*")
    .eq("id", input.planId)
    .eq("organization_id", orgId)
    .single()

  if (planError || !plan) {
    return { success: false as const, error: planError?.message || "Plan not found" }
  }

  if (plan.status !== "active" && plan.status !== "paused" && plan.status !== "past_due") {
    return { success: false as const, error: "Only active, paused, or past-due plans can receive payments" }
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
      attributed_group_contact_id: input.attributedGroupContactId || null,
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
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  try {
    const summary = await buildRecurringDonorSummary(access.supabase, access.orgId, donorId)
    return { success: true as const, summary }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getRecurringReportingSummaryAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  try {
    const summary = await buildRecurringReportingSummary(access.supabase, access.orgId)
    return { success: true as const, summary }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

function parseOptionalCount(value: number | null | undefined) {
  if (value == null) return null
  if (!Number.isFinite(value) || value < 0) return null
  return Math.trunc(value)
}

export async function getRecurringPlanContactPaymentMethodsAction(planId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: plan, error: planError } = await access.supabase
    .from("recurring_donation_plans")
    .select("id, contact_id, donor_id, contact_payment_method_id")
    .eq("organization_id", access.orgId)
    .eq("id", planId)
    .maybeSingle()

  if (planError || !plan) {
    return { success: false as const, error: planError?.message || "Plan not found" }
  }

  let contactId = (plan.contact_id as string | null) ?? null
  if (!contactId && plan.donor_id) {
    const { data: donor } = await access.supabase
      .from("donors")
      .select("contact_id")
      .eq("id", plan.donor_id)
      .maybeSingle()
    contactId = (donor?.contact_id as string | null) ?? null
  }

  if (!contactId) {
    return {
      success: false as const,
      error: "Link this donor to a contact before assigning a card on file.",
    }
  }

  const { data, error } = await access.supabase
    .from("contact_payment_methods")
    .select("id, card_brand, last4, exp_month, exp_year, cardholder_name, is_default, created_at")
    .eq("organization_id", access.orgId)
    .eq("contact_id", contactId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    contactId,
    currentPaymentMethodId: (plan.contact_payment_method_id as string | null) ?? null,
    paymentMethods: (data || []).map((row) => ({
      id: row.id as string,
      cardBrand: (row.card_brand as string | null) ?? null,
      last4: row.last4 as string,
      expMonth: row.exp_month == null ? null : Number(row.exp_month),
      expYear: row.exp_year == null ? null : Number(row.exp_year),
      cardholderName: (row.cardholder_name as string | null) ?? null,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at as string,
    })),
  }
}

export async function updateRecurringDonationPlanAction(input: {
  planId: string
  amount?: number
  frequency?: RecurringFrequency
  startDate?: string | null
  endDate?: string | null
  totalPayments?: number | null
  paymentsMade?: number | null
  nextPaymentDate?: string | null
  campaignId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  notes?: string | null
}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  const { data: existing, error: existingError } = await supabase
    .from("recurring_donation_plans")
    .select("id, status, subcategory_id")
    .eq("id", input.planId)
    .eq("organization_id", orgId)
    .maybeSingle()

  if (existingError || !existing) {
    return { success: false as const, error: existingError?.message || "Plan not found" }
  }

  if (String(existing.status) === "completed") {
    return {
      success: false as const,
      error: "Completed plans cannot be updated. Create a new plan instead.",
    }
  }

  const patch: Record<string, unknown> = {}

  if (input.amount != null) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { success: false as const, error: "Amount must be greater than zero" }
    }
    patch.amount = input.amount
  }
  if (input.frequency) patch.frequency = input.frequency
  if (input.startDate !== undefined) patch.start_date = input.startDate
  if (input.endDate !== undefined) patch.end_date = input.endDate
  if (input.totalPayments !== undefined) patch.total_payments = parseOptionalCount(input.totalPayments)
  if (input.paymentsMade !== undefined) patch.payments_made = parseOptionalCount(input.paymentsMade)
  if (input.nextPaymentDate !== undefined) patch.next_payment_date = input.nextPaymentDate
  if (input.campaignId !== undefined) patch.campaign_id = input.campaignId
  if (input.categoryId !== undefined) patch.category_id = input.categoryId
  if (input.subcategoryId !== undefined) patch.subcategory_id = input.subcategoryId
  if (input.notes !== undefined) patch.notes = input.notes

  if (Object.keys(patch).length === 0) {
    return { success: false as const, error: "No changes to save" }
  }

  if (input.subcategoryId) {
    if (input.subcategoryId !== existing.subcategory_id) {
      const fundCheck = await validateOpenDonationFund(supabase, orgId, input.subcategoryId)
      if (!fundCheck.ok) {
        return { success: false as const, error: fundCheck.error }
      }
    }
  }

  const { error } = await supabase
    .from("recurring_donation_plans")
    .update(patch)
    .eq("id", input.planId)
    .eq("organization_id", orgId)

  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

export async function updateRecurringPlanPaymentMethodAction(input: {
  planId: string
  contactPaymentMethodId: string | null
}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  const { data: plan, error: planError } = await supabase
    .from("recurring_donation_plans")
    .select("id, contact_id, donor_id, status")
    .eq("id", input.planId)
    .eq("organization_id", orgId)
    .maybeSingle()

  if (planError || !plan) {
    return { success: false as const, error: planError?.message || "Plan not found" }
  }

  if (String(plan.status) === "completed") {
    return {
      success: false as const,
      error: "Completed plans cannot be updated. Create a new plan instead.",
    }
  }

  if (input.contactPaymentMethodId) {
    let contactId = plan.contact_id as string | null
    if (!contactId && plan.donor_id) {
      const { data: donor } = await supabase
        .from("donors")
        .select("contact_id")
        .eq("id", plan.donor_id)
        .maybeSingle()
      contactId = (donor?.contact_id as string | null) ?? null
    }

    if (!contactId) {
      return {
        success: false as const,
        error: "Link this donor to a contact before assigning a card on file.",
      }
    }

    const { data: method, error: methodError } = await supabase
      .from("contact_payment_methods")
      .select("id")
      .eq("id", input.contactPaymentMethodId)
      .eq("organization_id", orgId)
      .eq("contact_id", contactId)
      .maybeSingle()

    if (methodError || !method) {
      return { success: false as const, error: "Selected card was not found for this donor." }
    }
  }

  const { error } = await supabase
    .from("recurring_donation_plans")
    .update({ contact_payment_method_id: input.contactPaymentMethodId })
    .eq("id", input.planId)
    .eq("organization_id", orgId)

  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}
