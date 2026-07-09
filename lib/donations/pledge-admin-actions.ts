"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { handleDonationAffiliationSync, syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import { ensureGroupMembershipForDonationAction } from "@/lib/contacts/group-giving-actions"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import {
  pledgeDisplayStatus,
  pledgeStatusToDb,
  type PledgeDisplayStatus,
} from "@/lib/donations/donation-status"
import {
  validatePledgePaymentPlanInput,
  type PledgePlanFrequency,
} from "@/lib/donations/pledge-payment-plan"
import {
  fetchPledgeAttribution,
  toPaymentAttributionColumns,
} from "@/lib/donations/payment-attribution"
import {
  ORGANIZATION_AUDIT_ACTIONS,
  formatMoney,
  writeOrganizationAuditLog,
} from "@/lib/audit/organization-audit-log"

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
  const normalized = value.trim().toLowerCase().replace("-", "_")
  if (normalized === "yearly") return "annually"
  return normalized
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

function pledgeLabel(pledge: {
  id: string
  donor_name?: string | null
  campaign_name?: string | null
}) {
  return [pledge.donor_name, pledge.campaign_name].filter(Boolean).join(" — ") || pledge.id
}

function revalidatePledgePaths(
  donorId: string | null | undefined,
  contactIds: Array<string | null | undefined> = []
) {
  revalidatePath("/donations/reports/pledges")
  revalidatePath("/donations/pledges")
  revalidatePath("/donations/campaigns")
  if (donorId) {
    revalidatePath(`/donations/donors/individuals/${donorId}`)
    revalidatePath(`/donations/donors/organizations/${donorId}`)
  }
  for (const contactId of contactIds) {
    if (contactId) {
      revalidatePath(`/contacts/${contactId}`)
    }
  }
}

async function loadOrgPledge(pledgeId: string) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { ok: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("pledge_status_view")
    .select(
      "id, organization_id, donor_id, donor_name, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date, frequency, notes, status, installment_amount, total_payments, first_payment_date, next_payment_date"
    )
    .eq("id", pledgeId)
    .eq("organization_id", access.orgId)
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message }
  if (!data) return { ok: false as const, error: "Pledge not found" }

  return { ok: true as const, access, pledge: data }
}

async function resolveDonorContactId(
  supabase: SupabaseClient,
  donorId: string | null | undefined
) {
  if (!donorId) return null

  const { data, error } = await supabase
    .from("donors")
    .select("contact_id")
    .eq("id", donorId)
    .maybeSingle()

  if (error) return null
  return (data?.contact_id as string | null) ?? null
}

async function reassignPledgeContact(
  access: { supabase: SupabaseClient; orgId: string },
  pledgeId: string,
  currentDonorId: string | null | undefined,
  newContactId: string
) {
  const { supabase, orgId } = access

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name")
    .eq("organization_id", orgId)
    .eq("id", newContactId)
    .maybeSingle()

  if (contactError || !contact) {
    return { ok: false as const, error: "Selected contact was not found." }
  }

  const newDonorId = await ensureDonorExtensionForContact(orgId, newContactId, supabase)
  if (!newDonorId) {
    return { ok: false as const, error: "Could not resolve a donor record for the selected contact." }
  }

  const oldContactId = await resolveDonorContactId(supabase, currentDonorId)
  if (currentDonorId === newDonorId) {
    return {
      ok: true as const,
      changed: false,
      oldContactId,
      newContactId,
      newDonorId,
      oldDonorId: currentDonorId ?? null,
    }
  }

  const senderName = (contact.full_name as string | null) || "Unnamed"

  const { error: pledgeError } = await supabase
    .from("pledges")
    .update({ donor_id: newDonorId })
    .eq("id", pledgeId)
    .eq("organization_id", orgId)

  if (pledgeError) {
    return { ok: false as const, error: pledgeError.message }
  }

  const paymentPatch = {
    donor_id: newDonorId,
    contact_id: newContactId,
    sender_name: senderName,
  }

  const { error: paymentsError } = await supabase
    .from("payments")
    .update(paymentPatch)
    .eq("organization_id", orgId)
    .eq("pledge_id", pledgeId)

  if (paymentsError) {
    return { ok: false as const, error: paymentsError.message }
  }

  const { error: remindersError } = await supabase
    .from("pledge_reminders")
    .update({
      donor_id: newDonorId,
      contact_id: newContactId,
    })
    .eq("organization_id", orgId)
    .eq("pledge_id", pledgeId)

  if (remindersError && remindersError.code !== "42P01") {
    return { ok: false as const, error: remindersError.message }
  }

  try {
    await handleDonationAffiliationSync({
      organizationId: orgId,
      donorId: newDonorId,
      contactId: newContactId,
    })
    if (oldContactId && oldContactId !== newContactId) {
      await syncContactAffiliations(oldContactId, orgId, supabase)
    }
  } catch (syncError) {
    console.error(
      `[pledge-admin] affiliation sync failed after reassignment: ${
        syncError instanceof Error ? syncError.message : String(syncError)
      }`
    )
  }

  return {
    ok: true as const,
    changed: true,
    oldContactId,
    newContactId,
    newDonorId,
    oldDonorId: currentDonorId ?? null,
  }
}

export async function getPledgeForEditAction(pledgeId: string) {
  const loaded = await loadOrgPledge(pledgeId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const { pledge, access } = loaded
  const attribution = await fetchPledgeAttribution(access.supabase, pledgeId)
  const amountPledged = Number(pledge.amount_pledged || 0)
  const amountPaid = Number(pledge.amount_paid || 0)
  const contactId = await resolveDonorContactId(access.supabase, pledge.donor_id)

  return {
    success: true as const,
    organizationId: access.orgId,
    pledge: {
      id: pledge.id,
      donorId: pledge.donor_id,
      donorName: pledge.donor_name,
      contactId,
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
      installmentAmount:
        pledge.installment_amount == null ? null : Number(pledge.installment_amount),
      totalPayments: pledge.total_payments == null ? null : Number(pledge.total_payments),
      firstPaymentDate: normalizeDateInput(pledge.first_payment_date) || "",
      nextPaymentDate: normalizeDateInput(pledge.next_payment_date) || "",
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
  contactId?: string | null
}) {
  const loaded = await loadOrgPledge(input.pledgeId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const amount = Number(input.amountPledged)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false as const, error: "Amount must be greater than zero." }
  }

  let reassignment:
    | Awaited<ReturnType<typeof reassignPledgeContact>>
    | null = null

  if (input.contactId) {
    reassignment = await reassignPledgeContact(
      loaded.access,
      input.pledgeId,
      loaded.pledge.donor_id,
      input.contactId
    )
    if (!reassignment.ok) {
      return { success: false as const, error: reassignment.error }
    }
  }

  const activeDonorId =
    reassignment && reassignment.ok && reassignment.changed
      ? reassignment.newDonorId
      : loaded.pledge.donor_id

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

  const { access, pledge } = loaded
  const label = pledgeLabel(pledge)

  await writeOrganizationAuditLog({
    organizationId: access.orgId,
    category: "financial",
    action: ORGANIZATION_AUDIT_ACTIONS.PLEDGE_UPDATED,
    actorUserId: access.userId,
    actorEmail: access.userEmail,
    targetType: "pledge",
    targetId: input.pledgeId,
    targetLabel: label,
    summary: `Updated pledge ${label} (${formatMoney(amount)})`,
    metadata: {
      amount,
      frequency: input.frequency,
      status: input.status,
      contactReassigned: Boolean(reassignment?.ok && reassignment.changed),
    },
  })

  revalidatePledgePaths(activeDonorId, [
    reassignment && reassignment.ok ? reassignment.oldContactId : null,
    reassignment && reassignment.ok ? reassignment.newContactId : null,
    input.contactId,
  ])
  return { success: true as const }
}

export async function recordPledgePaymentAction(input: {
  pledgeId: string
  amount: number
  paymentDate?: string
  source?: string
  memo?: string | null
  attributedGroupContactId?: string | null
  auditAction?:
    | typeof ORGANIZATION_AUDIT_ACTIONS.PLEDGE_PAYMENT_RECORDED
    | typeof ORGANIZATION_AUDIT_ACTIONS.PLEDGE_MARKED_PAID
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

  if (input.attributedGroupContactId && contactId) {
    const groupResult = await ensureGroupMembershipForDonationAction({
      memberContactId: contactId,
      groupContactId: input.attributedGroupContactId,
    })
    if (!groupResult.success) {
      return { success: false as const, error: groupResult.error }
    }
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    organization_id: orgId,
    donor_id: pledge.donor_id,
    contact_id: contactId,
    attributed_group_contact_id: input.attributedGroupContactId || null,
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

  const label = pledgeLabel(pledge)
  const auditAction =
    input.auditAction ?? ORGANIZATION_AUDIT_ACTIONS.PLEDGE_PAYMENT_RECORDED
  const summary =
    auditAction === ORGANIZATION_AUDIT_ACTIONS.PLEDGE_MARKED_PAID
      ? `Marked pledge ${label} as paid (${formatMoney(amount)})`
      : `Recorded ${formatMoney(amount)} payment on pledge ${label}`

  await writeOrganizationAuditLog({
    organizationId: orgId,
    category: "financial",
    action: auditAction,
    actorUserId: loaded.access.userId,
    actorEmail: loaded.access.userEmail,
    targetType: "pledge",
    targetId: input.pledgeId,
    targetLabel: label,
    summary,
    metadata: { amount, source: input.source?.trim() || "manual" },
  })

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
  attributedGroupContactId?: string | null
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
    attributedGroupContactId: input.attributedGroupContactId,
    auditAction: ORGANIZATION_AUDIT_ACTIONS.PLEDGE_MARKED_PAID,
  })
}

export async function updatePledgePaymentPlanAction(input: {
  pledgeId: string
  installmentAmount: number
  numberOfPayments: number
  frequency: PledgePlanFrequency
  firstPaymentDate: string
}) {
  const loaded = await loadOrgPledge(input.pledgeId)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  if (String(loaded.pledge.calculated_status).toLowerCase() === "fulfilled") {
    return { success: false as const, error: "This pledge is already fulfilled." }
  }

  const totalAmount = Number(loaded.pledge.amount_pledged || 0)
  const validated = validatePledgePaymentPlanInput(totalAmount, {
    installmentAmount: input.installmentAmount,
    numberOfPayments: input.numberOfPayments,
    frequency: input.frequency,
    firstPaymentDate: input.firstPaymentDate,
  })

  if (!validated.ok) {
    return { success: false as const, error: validated.error }
  }

  const { installmentAmount, totalPayments, frequency, firstPaymentDate } = validated.plan

  const { error } = await loaded.access.supabase
    .from("pledges")
    .update({
      installment_amount: installmentAmount,
      total_payments: totalPayments,
      first_payment_date: firstPaymentDate,
      next_payment_date: firstPaymentDate,
      pledge_type: frequency,
      frequency,
    })
    .eq("id", input.pledgeId)
    .eq("organization_id", loaded.access.orgId)

  if (error) return { success: false as const, error: error.message }

  const { access, pledge } = loaded
  const label = pledgeLabel(pledge)
  const contactId = await resolveDonorContactId(access.supabase, pledge.donor_id)

  await writeOrganizationAuditLog({
    organizationId: access.orgId,
    category: "financial",
    action: ORGANIZATION_AUDIT_ACTIONS.PLEDGE_UPDATED,
    actorUserId: access.userId,
    actorEmail: access.userEmail,
    targetType: "pledge",
    targetId: input.pledgeId,
    targetLabel: label,
    summary: `Updated payment plan for pledge ${label}`,
    metadata: {
      installmentAmount,
      totalPayments,
      frequency,
      firstPaymentDate,
    },
  })

  revalidatePledgePaths(pledge.donor_id, [contactId])
  return { success: true as const }
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

  const { access, pledge } = loaded
  const label = pledgeLabel(pledge)

  await writeOrganizationAuditLog({
    organizationId: access.orgId,
    category: "financial",
    action: ORGANIZATION_AUDIT_ACTIONS.PLEDGE_CANCELLED,
    actorUserId: access.userId,
    actorEmail: access.userEmail,
    targetType: "pledge",
    targetId: pledgeId,
    targetLabel: label,
    summary: `Cancelled pledge ${label}`,
  })

  revalidatePledgePaths(loaded.pledge.donor_id)
  return { success: true as const }
}
