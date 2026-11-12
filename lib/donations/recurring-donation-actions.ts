"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  buildRecurringDashboardMetrics,
  buildRecurringDonorSummary,
  buildRecurringReportingSummary,
  fetchRecurringPlans,
} from "@/lib/donations/recurring-donation-data"
import {
  applyRecurringPlanAfterSuccessfulCharge,
  recurringPlanAmountStillOwed,
} from "@/lib/donations/recurring-plan-progress"
import {
  initialNextPaymentDate,
  nextRecurringChargeAmount,
  roundRecurringMoney,
} from "@/lib/donations/recurring-donation-schedule"
import type {
  RecurringFrequency,
  RecurringStatus,
} from "@/lib/donations/recurring-donation-types"
import { campaignGroupIdForCampaign } from "@/lib/donations/campaign-group-helpers"
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
  goalAmount?: number | null
  pledgeId?: string | null
  notes?: string | null
  campaignGroupId?: string | null
  contactPaymentMethodId?: string | null
  nextPaymentDate?: string | null
}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access
  if (!input.amount || input.amount <= 0) {
    return { success: false as const, error: "Amount must be greater than zero" }
  }

  const cap = await resolveRecurringPlanCap(supabase, orgId, input.donorId, {
    goalAmount: input.goalAmount,
    pledgeId: input.pledgeId,
  })
  if (!cap.ok) return { success: false as const, error: cap.error }

  const nextPaymentDate =
    input.nextPaymentDate?.trim() || initialNextPaymentDate(input.startDate, input.frequency)

  const fundCheck = await validateOpenDonationFund(supabase, orgId, input.subcategoryId)
  if (!fundCheck.ok) {
    return { success: false as const, error: fundCheck.error }
  }

  const campaignId = input.campaignId ?? cap.campaignId
  const group = await campaignGroupIdForCampaign(
    supabase,
    orgId,
    campaignId,
    input.campaignGroupId
  )
  if (!group.ok) return { success: false as const, error: group.error }

  let contactId = input.contactId ?? null
  if (!contactId) {
    const { data: donor } = await supabase
      .from("donors")
      .select("contact_id")
      .eq("id", input.donorId)
      .eq("organization_id", orgId)
      .maybeSingle()
    contactId = (donor?.contact_id as string | null) ?? null
  }

  const card = await resolveContactPaymentMethodId(
    supabase,
    orgId,
    contactId,
    input.contactPaymentMethodId
  )
  if (!card.ok) return { success: false as const, error: card.error }

  const { data, error } = await supabase
    .from("recurring_donation_plans")
    .insert({
      organization_id: orgId,
      donor_id: input.donorId,
      contact_id: contactId,
      campaign_id: campaignId,
      campaign_group_id: group.campaignGroupId,
      category_id: input.categoryId ?? null,
      subcategory_id: input.subcategoryId ?? null,
      payment_method_id: input.paymentMethodId ?? null,
      contact_payment_method_id: card.id,
      amount: input.amount,
      frequency: input.frequency,
      status: "active",
      start_date: input.startDate,
      next_payment_date: nextPaymentDate,
      end_date: null,
      goal_amount: cap.goalAmount,
      pledge_id: cap.pledgeId,
      total_payments: null,
      payments_made: 0,
      notes: input.notes ?? null,
    })
    .select("id")
    .single()

  if (error) return { success: false as const, error: error.message }

  revalidatePath("/donations/payments/recurring")
  revalidatePath("/donations/campaigns")
  if (campaignId) {
    revalidatePath(`/donations/campaigns/${campaignId}`)
  }

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
  campaignGroupId?: string | null
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

  const goalAmount = plan.goal_amount == null ? null : Number(plan.goal_amount)
  const pledgeId = (plan.pledge_id as string | null) ?? null
  let remaining: number | null
  try {
    remaining = await recurringPlanAmountStillOwed(supabase, {
      organizationId: orgId,
      planId: plan.id,
      goalAmount,
      pledgeId,
    })
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }

  const requested = input.amount ?? Number(plan.amount)
  const amount = nextRecurringChargeAmount(requested, remaining)
  if (amount <= 0) {
    try {
      await applyRecurringPlanAfterSuccessfulCharge(supabase, {
        organizationId: orgId,
        planId: plan.id,
        frequency: plan.frequency as RecurringFrequency,
        currentNextDate: plan.next_payment_date,
        currentStatus: String(plan.status),
        goalAmount,
        pledgeId,
      })
    } catch (error) {
      return { success: false as const, error: (error as Error).message }
    }
    return { success: false as const, error: "This plan is already paid in full." }
  }

  const paymentDate = input.paymentDate
    ? `${input.paymentDate}T12:00:00`
    : new Date().toISOString()

  const { data: donor } = await supabase
    .from("donors")
    .select("full_name, email, contact_id")
    .eq("id", plan.donor_id)
    .maybeSingle()

  const group = await campaignGroupIdForCampaign(
    supabase,
    orgId,
    plan.campaign_id as string | null,
    input.campaignGroupId === undefined
      ? ((plan.campaign_group_id as string | null) ?? null)
      : input.campaignGroupId
  )
  if (!group.ok) return { success: false as const, error: group.error }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      organization_id: orgId,
      donor_id: plan.donor_id,
      contact_id: plan.contact_id ?? donor?.contact_id ?? null,
      attributed_group_contact_id: input.attributedGroupContactId || null,
      campaign_group_id: group.campaignGroupId,
      campaign_id: plan.campaign_id,
      category_id: plan.category_id,
      subcategory_id: plan.subcategory_id,
      pledge_id: pledgeId,
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

  let progress: { completed: boolean; nextPaymentDate: string | null }
  try {
    progress = await applyRecurringPlanAfterSuccessfulCharge(supabase, {
      organizationId: orgId,
      planId: plan.id,
      frequency: plan.frequency as RecurringFrequency,
      currentNextDate: plan.next_payment_date,
      currentStatus: String(plan.status),
      goalAmount,
      pledgeId,
    })
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }

  return {
    success: true as const,
    payment,
    amount,
    completed: progress.completed,
    nextPaymentDate: progress.nextPaymentDate,
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

export async function listDonorContactPaymentMethodsAction(donorId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: donor, error: donorError } = await access.supabase
    .from("donors")
    .select("contact_id")
    .eq("id", donorId)
    .eq("organization_id", access.orgId)
    .maybeSingle()

  if (donorError || !donor) {
    return { success: false as const, error: donorError?.message || "Donor not found" }
  }

  const contactId = (donor.contact_id as string | null) ?? null
  if (!contactId) {
    return { success: true as const, contactId: null, paymentMethods: [] as ContactCardRow[] }
  }

  const cards = await loadContactCards(access.supabase, access.orgId, contactId)
  if (!cards.ok) return { success: false as const, error: cards.error }

  return { success: true as const, contactId, paymentMethods: cards.paymentMethods }
}

type ContactCardRow = {
  id: string
  cardBrand: string | null
  last4: string
  expMonth: number | null
  expYear: number | null
  cardholderName: string | null
  isDefault: boolean
  createdAt: string
}

async function loadContactCards(
  supabase: SupabaseClient,
  orgId: string,
  contactId: string
): Promise<{ ok: true; paymentMethods: ContactCardRow[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("contact_payment_methods")
    .select("id, card_brand, last4, exp_month, exp_year, cardholder_name, is_default, created_at")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
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
  goalAmount?: number | null
  pledgeId?: string | null
  nextPaymentDate?: string | null
  campaignId?: string | null
  campaignGroupId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  notes?: string | null
  contactPaymentMethodId?: string | null
}) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  const { data: existing, error: existingError } = await supabase
    .from("recurring_donation_plans")
    .select("id, status, subcategory_id, campaign_id, donor_id, contact_id")
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
  if (input.nextPaymentDate !== undefined) patch.next_payment_date = input.nextPaymentDate
  if (input.goalAmount !== undefined || input.pledgeId !== undefined) {
    const cap = await resolveRecurringPlanCap(
      supabase,
      orgId,
      existing.donor_id as string,
      {
        goalAmount: input.goalAmount,
        pledgeId: input.pledgeId,
      }
    )
    if (!cap.ok) return { success: false as const, error: cap.error }
    patch.goal_amount = cap.goalAmount
    patch.pledge_id = cap.pledgeId
  }
  if (input.campaignId !== undefined) patch.campaign_id = input.campaignId
  if (input.campaignGroupId !== undefined) {
    const campaignId =
      input.campaignId !== undefined
        ? input.campaignId
        : ((existing.campaign_id as string | null) ?? null)
    const group = await campaignGroupIdForCampaign(
      supabase,
      orgId,
      campaignId,
      input.campaignGroupId
    )
    if (!group.ok) return { success: false as const, error: group.error }
    patch.campaign_group_id = group.campaignGroupId
  }
  if (input.categoryId !== undefined) patch.category_id = input.categoryId
  if (input.subcategoryId !== undefined) patch.subcategory_id = input.subcategoryId
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.contactPaymentMethodId !== undefined) {
    let contactId = (existing.contact_id as string | null) ?? null
    if (!contactId && existing.donor_id) {
      const { data: donor } = await supabase
        .from("donors")
        .select("contact_id")
        .eq("id", existing.donor_id)
        .eq("organization_id", orgId)
        .maybeSingle()
      contactId = (donor?.contact_id as string | null) ?? null
    }
    const card = await resolveContactPaymentMethodId(
      supabase,
      orgId,
      contactId,
      input.contactPaymentMethodId
    )
    if (!card.ok) return { success: false as const, error: card.error }
    patch.contact_payment_method_id = card.id
  }

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

export async function listOpenPledgesForRecurringPlanAction(donorId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("pledge_status_view")
    .select("id, campaign_name, amount_pledged, balance_remaining")
    .eq("organization_id", access.orgId)
    .eq("donor_id", donorId)
    .gt("balance_remaining", 0)
    .order("pledge_date", { ascending: false })

  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    pledges: (data || []).map((row) => ({
      id: row.id as string,
      campaignName: (row.campaign_name as string | null) ?? null,
      amountPledged: Number(row.amount_pledged || 0),
      balanceRemaining: Number(row.balance_remaining || 0),
    })),
  }
}

export async function markRecurringChargeFailedAction(planId: string) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: plan, error: planError } = await access.supabase
    .from("recurring_donation_plans")
    .select("id, status")
    .eq("id", planId)
    .eq("organization_id", access.orgId)
    .maybeSingle()

  if (planError || !plan) {
    return { success: false as const, error: planError?.message || "Plan not found" }
  }

  if (plan.status !== "active" && plan.status !== "paused" && plan.status !== "past_due") {
    return { success: false as const, error: "Only an open plan can record a failed charge" }
  }

  const { error } = await access.supabase
    .from("recurring_donation_plans")
    .update({ status: "past_due" })
    .eq("id", planId)
    .eq("organization_id", access.orgId)

  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

async function resolveContactPaymentMethodId(
  supabase: SupabaseClient,
  orgId: string,
  contactId: string | null,
  paymentMethodId: string | null | undefined
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const id = paymentMethodId?.trim() || null
  if (!id || id === "none") return { ok: true, id: null }
  if (!contactId) {
    return {
      ok: false,
      error: "Link this donor to a contact before assigning a card on file.",
    }
  }

  const { data, error } = await supabase
    .from("contact_payment_methods")
    .select("id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: error?.message || "Selected card was not found for this donor." }
  }
  return { ok: true, id }
}

async function resolveRecurringPlanCap(
  supabase: SupabaseClient,
  orgId: string,
  donorId: string,
  input: { goalAmount?: number | null; pledgeId?: string | null }
): Promise<
  | {
      ok: true
      goalAmount: number | null
      pledgeId: string | null
      campaignId: string | null
    }
  | { ok: false; error: string }
> {
  const pledgeId = input.pledgeId?.trim() || null
  if (pledgeId) {
    const { data, error } = await supabase
      .from("pledge_status_view")
      .select("id, donor_id, balance_remaining, campaign_id")
      .eq("organization_id", orgId)
      .eq("id", pledgeId)
      .maybeSingle()
    if (error || !data) {
      return { ok: false, error: error?.message || "Pledge not found" }
    }
    if (data.donor_id !== donorId) {
      return { ok: false, error: "Choose an open pledge for this donor." }
    }
    if (Number(data.balance_remaining) <= 0) {
      return { ok: false, error: "That pledge is already paid." }
    }
    return {
      ok: true,
      goalAmount: null,
      pledgeId,
      campaignId: (data.campaign_id as string | null) ?? null,
    }
  }

  const raw = input.goalAmount
  if (raw == null || raw === 0) {
    return { ok: true, goalAmount: null, pledgeId: null, campaignId: null }
  }
  if (!Number.isFinite(raw) || raw <= 0) {
    return { ok: false, error: "Total amount must be greater than zero." }
  }
  return {
    ok: true,
    goalAmount: roundRecurringMoney(raw),
    pledgeId: null,
    campaignId: null,
  }
}
