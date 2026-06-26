"use server"

import {
  resolveDonorEmail,
  sendPledgeReminderEmail,
} from "@/lib/donations/donation-email-delivery"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { loadDonationReceiptSettings } from "@/lib/donations/receipt-settings"
import {
  buildPledgeReminderMessage,
  buildPledgeCollectionReport,
  fetchOutstandingPledges,
  fetchPledgeReminderHistory,
} from "@/lib/donations/pledge-reminder-data"
import type { PledgeReminderType } from "@/lib/donations/pledge-reminder-types"
import { isPledgeEligibleForReminder } from "@/lib/donations/pledge-reminder-types"

export async function getOutstandingPledgesAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  try {
    const pledges = await fetchOutstandingPledges(access.supabase, access.orgId)
    return { success: true as const, pledges }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getPledgeCollectionReportAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  try {
    const report = await buildPledgeCollectionReport(access.supabase, access.orgId)
    return { success: true as const, report }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function previewPledgeReminderAction(pledgeId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  try {
    const settings = await loadDonationReceiptSettings(supabase, orgId)
    const { data: pledge, error } = await supabase
      .from("pledge_status_view")
      .select(
        "id, donor_id, donor_name, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status"
      )
      .eq("organization_id", orgId)
      .eq("id", pledgeId)
      .single()

    if (error || !pledge) throw new Error(error?.message || "Pledge not found")

    if (
      !isPledgeEligibleForReminder(
        pledge.calculated_status,
        Number(pledge.balance_remaining || 0)
      )
    ) {
      return { success: false as const, error: "Fulfilled pledges cannot receive reminders" }
    }

    const message = buildPledgeReminderMessage(settings, {
      donorName: pledge.donor_name || "Donor",
      campaignName: pledge.campaign_name,
      amountPledged: Number(pledge.amount_pledged || 0),
      amountPaid: Number(pledge.amount_paid || 0),
      balanceRemaining: Number(pledge.balance_remaining || 0),
    })

    let recipientEmail: string | null = null
    if (pledge.donor_id) {
      const { data: donor } = await supabase
        .from("donors")
        .select("contact_id")
        .eq("id", pledge.donor_id)
        .maybeSingle()
      recipientEmail = await resolveDonorEmail(supabase, {
        donorId: pledge.donor_id,
        contactId: donor?.contact_id ?? null,
      })
    }

    return {
      success: true as const,
      message,
      recipientEmail,
      deliveredExternally: false,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function sendPledgeReminderAction(
  pledgeId: string,
  reminderType: PledgeReminderType = "manual"
) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId, userId } = access

  const preview = await previewPledgeReminderAction(pledgeId)
  if (!preview.success) return preview

  const { data: pledge } = await supabase
    .from("pledge_status_view")
    .select("donor_id")
    .eq("organization_id", orgId)
    .eq("id", pledgeId)
    .maybeSingle()

  let contactId: string | null = null
  if (pledge?.donor_id) {
    const { data: donor } = await supabase
      .from("donors")
      .select("contact_id")
      .eq("id", pledge.donor_id)
      .maybeSingle()
    contactId = donor?.contact_id ?? null
  }

  const recipientEmail = await resolveDonorEmail(supabase, {
    donorId: pledge?.donor_id ?? null,
    contactId,
  })

  const { data: inserted, error } = await supabase
    .from("pledge_reminders")
    .insert({
      organization_id: orgId,
      pledge_id: pledgeId,
      donor_id: pledge?.donor_id ?? null,
      contact_id: contactId,
      reminder_type: reminderType,
      status: "draft",
      message_subject: preview.message.subject,
      message_body: preview.message.body,
      delivered_externally: false,
      sent_by: userId,
    })
    .select("id, status, delivered_externally, sent_at")
    .single()

  if (error || !inserted?.id) {
    return { success: false as const, error: error?.message || "Could not create reminder record" }
  }

  const delivery = await sendPledgeReminderEmail(supabase, {
    organizationId: orgId,
    reminderId: inserted.id,
    recipient: recipientEmail,
    message: preview.message,
  })

  const { data: reminder } = await supabase
    .from("pledge_reminders")
    .select("id, status, delivered_externally, sent_at")
    .eq("id", inserted.id)
    .maybeSingle()

  if (!delivery.sent) {
    return {
      success: false as const,
      error: delivery.error || "Reminder email could not be delivered",
      reminder,
      delivery,
    }
  }

  return {
    success: true as const,
    reminder,
    delivery,
    notice: delivery.configured
      ? "Pledge reminder email sent."
      : "Pledge reminder logged via console email provider (configure RESEND_API_KEY for live delivery).",
  }
}

export async function markPledgeContactedAction(pledgeId: string, contactNotes?: string) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId, userId } = access

  const { data: pledge, error: pledgeError } = await supabase
    .from("pledge_status_view")
    .select("donor_id, donor_name, calculated_status, balance_remaining")
    .eq("organization_id", orgId)
    .eq("id", pledgeId)
    .maybeSingle()

  if (pledgeError || !pledge) {
    return { success: false as const, error: pledgeError?.message || "Pledge not found" }
  }

  let contactId: string | null = null
  if (pledge.donor_id) {
    const { data: donor } = await supabase
      .from("donors")
      .select("contact_id")
      .eq("id", pledge.donor_id)
      .maybeSingle()
    contactId = donor?.contact_id ?? null
  }

  const now = new Date().toISOString()
  const { data: inserted, error } = await supabase
    .from("pledge_reminders")
    .insert({
      organization_id: orgId,
      pledge_id: pledgeId,
      donor_id: pledge.donor_id ?? null,
      contact_id: contactId,
      reminder_type: "contacted",
      status: "sent",
      message_subject: "Manual contact logged",
      message_body: `Staff marked ${pledge.donor_name || "donor"} as contacted.`,
      contact_notes: contactNotes?.trim() || null,
      delivered_externally: false,
      sent_at: now,
      sent_by: userId,
    })
    .select("id, sent_at, contact_notes")
    .single()

  if (error) return { success: false as const, error: error.message }
  return { success: true as const, contact: inserted }
}

export async function getPledgeReminderHistoryAction(filters?: {
  pledgeId?: string
  donorId?: string
  limit?: number
}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  try {
    const history = await fetchPledgeReminderHistory(access.supabase, access.orgId, filters)
    return { success: true as const, history }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getDonorPledgesAction(donorId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  try {
    const { data: pledgeRows, error } = await supabase
      .from("pledge_status_view")
      .select(
        "id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date, frequency"
      )
      .eq("organization_id", orgId)
      .eq("donor_id", donorId)
      .order("pledge_date", { ascending: false })

    if (error) throw new Error(error.message)

    return {
      success: true as const,
      pledges: (pledgeRows || []).map((row) => ({
        id: row.id,
        campaignName: row.campaign_name,
        amountPledged: Number(row.amount_pledged || 0),
        amountPaid: Number(row.amount_paid || 0),
        balanceRemaining: Number(row.balance_remaining || 0),
        status: row.calculated_status,
        pledgeDate: row.pledge_date,
        frequency: row.frequency,
      })),
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getDonorPledgeCollectionSummaryAction(donorId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  const { supabase, orgId } = access

  try {
    const { data: pledgeRows, error } = await supabase
      .from("pledge_status_view")
      .select(
        "id, donor_id, donor_name, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
      )
      .eq("organization_id", orgId)
      .eq("donor_id", donorId)

    if (error) throw new Error(error.message)

    const activePledges = (pledgeRows || []).filter((row) =>
      isPledgeEligibleForReminder(row.calculated_status, Number(row.balance_remaining || 0))
    )

    const outstandingBalance = activePledges.reduce(
      (sum, row) => sum + Number(row.balance_remaining || 0),
      0
    )

    const history = await fetchPledgeReminderHistory(supabase, orgId, {
      donorId,
      limit: 20,
    })

    const lastReminder = history.find((row) => row.reminder_type !== "contacted")
    const lastContacted = history.find((row) => row.reminder_type === "contacted")

    return {
      success: true as const,
      summary: {
        activePledges: activePledges.map((row) => ({
          id: row.id,
          campaignName: row.campaign_name,
          amountPledged: Number(row.amount_pledged || 0),
          amountPaid: Number(row.amount_paid || 0),
          balanceRemaining: Number(row.balance_remaining || 0),
          status: row.calculated_status,
          pledgeDate: row.pledge_date,
        })),
        outstandingBalance,
        reminderHistory: history,
        lastReminderAt: lastReminder?.sent_at || lastReminder?.created_at || null,
        lastContactedAt: lastContacted?.sent_at || lastContacted?.created_at || null,
      },
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
