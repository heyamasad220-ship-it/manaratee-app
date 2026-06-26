"use server"

import { revalidatePath } from "next/cache"

import { handleDonationAffiliationSync } from "@/lib/contacts/contact-affiliation-sync"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  pledgeDisplayStatus,
  pledgeStatusToDb,
  type PledgeDisplayStatus,
} from "@/lib/donations/donation-status"
import {
  fetchPledgeAttribution,
  toPaymentAttributionColumns,
} from "@/lib/donations/payment-attribution"

function normalizeDateInput(date?: string | null) {
  if (!date) return null
  return date.slice(0, 10)
}

function getTodayPlainDate() {
  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset() * 60 * 1000
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function frequencyToStorage(value: string) {
  return value.trim().toLowerCase().replace("-", "_")
}

function frequencyToDisplay(value: string | null | undefined) {
  if (!value) return "One-Time"
  const normalized = value.trim().toLowerCase().replace(/_/g, "-")
  if (normalized === "one-time" || normalized === "one time") return "One-Time"
  if (normalized === "monthly") return "Monthly"
  if (normalized === "quarterly") return "Quarterly"
  if (normalized === "yearly" || normalized === "annual" || normalized === "annually") {
    return "Yearly"
  }
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function revalidatePledgePaths(donorId: string | null | undefined) {
  revalidatePath("/donations/pledges")
  if (donorId) {
    revalidatePath(`/donations/donors/individuals/${donorId}`)
    revalidatePath(`/donations/donors/organizations/${donorId}`)
  }
}

async function loadOrgPledge(pledgeId: string) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { ok: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("pledge_status_view")
    .select(
      "id, organization_id, donor_id, donor_name, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date, frequency, notes, status"
    )
    .eq("id", pledgeId)
    .eq("organization_id", access.orgId)
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message }
  if (!data) return { ok: false as const, error: "Pledge not found" }

  return { ok: true as const, access, pledge: data }
}

export async function getPledgeForEditAction(pledgeId: string) {
  const loaded = await loadOrgPledge(pledgeId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const { pledge, access } = loaded
  const attribution = await fetchPledgeAttribution(access.supabase, pledgeId)
  const amountPledged = Number(pledge.amount_pledged || 0)
  const amountPaid = Number(pledge.amount_paid || 0)

  return {
    success: true as const,
    organizationId: access.orgId,
    pledge: {
      id: pledge.id,
      donorId: pledge.donor_id,
      donorName: pledge.donor_name,
      amountPledged,
      amountPaid,
      balanceRemaining: Number(pledge.balance_remaining || 0),
      pledgeDate: normalizeDateInput(pledge.pledge_date) || "",
      frequency: frequencyToDisplay(pledge.frequency),
      status: pledgeDisplayStatus(pledge.calculated_status, amountPledged, amountPaid),
      campaignId: attribution.campaign_id || "",
      categoryId: attribution.category_id || "",
      subcategoryId: attribution.subcategory_id || "",
      notes: pledge.notes || "",
      calculatedStatus: pledge.calculated_status,
    },
  }
}

export async function updatePledgeAction(input: {
  pledgeId: string
  amountPledged: number
  pledgeDate: string
  frequency: string
  status: PledgeDisplayStatus
  campaignId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  notes?: string | null
}) {
  const loaded = await loadOrgPledge(input.pledgeId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const amount = Number(input.amountPledged)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false as const, error: "Amount must be greater than zero." }
  }

  const { error } = await loaded.access.supabase
    .from("pledges")
    .update({
      amount_pledged: amount,
      campaign_id: input.campaignId || null,
      category_id: input.categoryId || null,
      subcategory_id: input.subcategoryId || null,
      pledge_date: normalizeDateInput(input.pledgeDate) || getTodayPlainDate(),
      frequency: frequencyToStorage(input.frequency),
      pledge_type: frequencyToStorage(input.frequency),
      status: pledgeStatusToDb(input.status),
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.pledgeId)
    .eq("organization_id", loaded.access.orgId)

  if (error) return { success: false as const, error: error.message }

  revalidatePledgePaths(loaded.pledge.donor_id)
  return { success: true as const }
}

export async function recordPledgePaymentAction(input: {
  pledgeId: string
  amount: number
  paymentDate?: string
  source?: string
  memo?: string | null
}) {
  const loaded = await loadOrgPledge(input.pledgeId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false as const, error: "Amount must be greater than zero." }
  }

  const balanceRemaining = Number(loaded.pledge.balance_remaining || 0)
  if (amount > balanceRemaining + 0.0001) {
    return {
      success: false as const,
      error: `Payment cannot exceed the remaining balance of ${balanceRemaining.toFixed(2)}.`,
    }
  }

  if (String(loaded.pledge.calculated_status || "").toLowerCase() === "cancelled") {
    return { success: false as const, error: "Cancelled pledges cannot receive payments." }
  }

  const { supabase, orgId } = loaded.access
  const pledge = loaded.pledge

  let contactId: string | null = null
  if (pledge.donor_id) {
    const { data: donorRow } = await supabase
      .from("donors")
      .select("contact_id")
      .eq("id", pledge.donor_id)
      .maybeSingle()
    contactId = (donorRow?.contact_id as string | null) ?? null
  }

  const paymentDateValue = normalizeDateInput(input.paymentDate) || getTodayPlainDate()
  const pledgeAttribution = await fetchPledgeAttribution(supabase, input.pledgeId)

  const { error: paymentError } = await supabase.from("payments").insert({
    organization_id: orgId,
    donor_id: pledge.donor_id,
    contact_id: contactId,
    pledge_id: input.pledgeId,
    sender_name: pledge.donor_name,
    amount,
    payment_date: `${paymentDateValue}T12:00:00`,
    source: input.source?.trim() || "manual",
    source_type: "manual",
    memo: input.memo?.trim() || null,
    status: "allocated",
    is_verified: false,
    ...toPaymentAttributionColumns(pledgeAttribution),
  })

  if (paymentError) return { success: false as const, error: paymentError.message }

  if (contactId || pledge.donor_id) {
    try {
      await handleDonationAffiliationSync({
        organizationId: orgId,
        donorId: pledge.donor_id,
        contactId,
      })
    } catch (syncError) {
      console.error(
        `[pledge-admin] affiliation sync failed: ${
          syncError instanceof Error ? syncError.message : String(syncError)
        }`
      )
    }
  }

  revalidatePledgePaths(pledge.donor_id)
  return { success: true as const }
}

export async function markPledgePaidAction(input: {
  pledgeId: string
  paymentDate?: string
  source?: string
  memo?: string | null
}) {
  const loaded = await loadOrgPledge(input.pledgeId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const balanceRemaining = Number(loaded.pledge.balance_remaining || 0)
  if (balanceRemaining <= 0) {
    return { success: false as const, error: "This pledge is already fully paid." }
  }

  return recordPledgePaymentAction({
    pledgeId: input.pledgeId,
    amount: balanceRemaining,
    paymentDate: input.paymentDate,
    source: input.source,
    memo: input.memo || "Marked as paid",
  })
}

export async function cancelPledgeAction(pledgeId: string) {
  const loaded = await loadOrgPledge(pledgeId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const { error } = await loaded.access.supabase
    .from("pledges")
    .update({ status: "cancelled" })
    .eq("id", pledgeId)
    .eq("organization_id", loaded.access.orgId)

  if (error) return { success: false as const, error: error.message }

  revalidatePledgePaths(loaded.pledge.donor_id)
  return { success: true as const }
}
