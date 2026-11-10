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
import type { SupabaseClient } from "@supabase/supabase-js"
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

function pledgeContactLogName(subject: string | null | undefined) {
  const name = subject?.trim()
  if (!name || name === "Manual contact logged") return null
  return name
}

async function loggedInStaffName(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  email: string | null
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, first_name, last_name")
    .eq("id", userId)
    .maybeSingle()

  const profileName =
    (profile?.full_name as string | null)?.trim() ||
    [profile?.first_name, profile?.last_name]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ")
  if (profileName) return profileName

  const { data: contact } = await supabase
    .from("contacts")
    .select("full_name")
    .eq("organization_id", orgId)
    .eq("auth_user_id", userId)
    .maybeSingle()

  return (contact?.full_name as string | null)?.trim() || email || "Staff"
}

export type PledgeContactLogEntry = {
  id: string
  at: string | null
  name: string | null
  notes: string | null
}

export async function listPledgeContactLogAction(pledgeId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  if (!pledgeId.trim()) return { success: false as const, error: "Pledge is required" }

  const { data, error } = await access.supabase
    .from("pledge_reminders")
    .select("id, sent_at, created_at, contact_notes, message_subject")
    .eq("organization_id", access.orgId)
    .eq("pledge_id", pledgeId)
    .eq("reminder_type", "contacted")
    .order("created_at", { ascending: false })

  if (error) return { success: false as const, error: error.message }

  const entries: PledgeContactLogEntry[] = (data || []).map((row) => ({
    id: row.id as string,
    at: (row.sent_at as string | null) || (row.created_at as string | null),
    name: pledgeContactLogName(row.message_subject as string | null),
    notes: (row.contact_notes as string | null) || null,
  }))

  return { success: true as const, entries }
}

export async function logPledgeContactNoteAction(pledgeId: string, notes: string) {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) return { success: false as const, error: access.error }
  const trimmed = notes.trim()
  if (!pledgeId.trim()) return { success: false as const, error: "Pledge is required" }
  if (!trimmed) return { success: false as const, error: "Add a note for this contact." }

  const { data: pledge, error: pledgeError } = await access.supabase
    .from("pledge_status_view")
    .select("donor_id, donor_name")
    .eq("organization_id", access.orgId)
    .eq("id", pledgeId)
    .maybeSingle()

  if (pledgeError || !pledge) {
    return { success: false as const, error: pledgeError?.message || "Pledge not found" }
  }

  let contactId: string | null = null
  if (pledge.donor_id) {
    const { data: donor } = await access.supabase
      .from("donors")
      .select("contact_id")
      .eq("id", pledge.donor_id)
      .maybeSingle()
    contactId = (donor?.contact_id as string | null) ?? null
  }

  const name = await loggedInStaffName(
    access.supabase,
    access.orgId,
    access.userId,
    access.userEmail
  )
  const sentAt = new Date().toISOString()
  const { data, error } = await access.supabase
    .from("pledge_reminders")
    .insert({
      organization_id: access.orgId,
      pledge_id: pledgeId,
      donor_id: pledge.donor_id ?? null,
      contact_id: contactId,
      reminder_type: "contacted",
      status: "sent",
      message_subject: name,
      message_body: trimmed,
      contact_notes: trimmed,
      delivered_externally: false,
      sent_at: sentAt,
      sent_by: access.userId,
    })
    .select("id, sent_at, contact_notes, message_subject")
    .single()

  if (error || !data) return { success: false as const, error: error?.message || "Could not log contact" }

  return {
    success: true as const,
    entry: {
      id: data.id as string,
      at: (data.sent_at as string | null) || sentAt,
      name: pledgeContactLogName(data.message_subject as string | null) || name,
      notes: (data.contact_notes as string | null) || trimmed,
    } satisfies PledgeContactLogEntry,
  }
}

export async function markPledgeContactedAction(
  pledgeId: string,
  contactNotes?: string,
  contactedOn?: string,
  contactMethod?: string
) {
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

  const contactedDate = (contactedOn || "").trim()
  const parsedContactedOn = /^\d{4}-\d{2}-\d{2}$/.test(contactedDate)
    ? new Date(`${contactedDate}T12:00:00`)
    : null
  if (!parsedContactedOn || Number.isNaN(parsedContactedOn.getTime())) {
    return { success: false as const, error: "Choose the date this person was contacted." }
  }
  if (contactMethod !== "call" && contactMethod !== "text") {
    return { success: false as const, error: "Choose call or text." }
  }

  const contact = {
    organization_id: orgId,
    pledge_id: pledgeId,
    donor_id: pledge.donor_id ?? null,
    contact_id: contactId,
    reminder_type: "contacted" as const,
    status: "sent" as const,
    message_subject: "Manual contact logged",
    message_body: `Staff marked ${pledge.donor_name || "donor"} as contacted.`,
    contact_notes: contactNotes?.trim() || null,
    contact_method: contactMethod,
    delivered_externally: false,
    sent_at: parsedContactedOn.toISOString(),
    sent_by: userId,
  }

  const { data: sameDayRows, error: sameDayError } = await supabase
    .from("pledge_reminders")
    .select("id, sent_at, created_at")
    .eq("organization_id", orgId)
    .eq("pledge_id", pledgeId)
    .eq("reminder_type", "contacted")
    .order("created_at", { ascending: false })

  if (sameDayError) return { success: false as const, error: sameDayError.message }

  const matches = (sameDayRows || []).filter((row) => {
    if (!row.sent_at) return false
    const sent = new Date(row.sent_at)
    const key = `${sent.getFullYear()}-${String(sent.getMonth() + 1).padStart(2, "0")}-${String(sent.getDate()).padStart(2, "0")}`
    return key === contactedDate
  })

  if (matches.length > 0) {
    const [keep, ...extras] = matches
    const { data: updated, error: updateError } = await supabase
      .from("pledge_reminders")
      .update({
        contact_notes: contact.contact_notes,
        contact_method: contact.contact_method,
        sent_at: contact.sent_at,
        sent_by: contact.sent_by,
        message_body: contact.message_body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", keep.id)
      .eq("organization_id", orgId)
      .select("id, sent_at, contact_notes")
      .single()

    if (updateError) return { success: false as const, error: updateError.message }

    if (extras.length > 0) {
      const { error: deleteError } = await supabase
        .from("pledge_reminders")
        .delete()
        .eq("organization_id", orgId)
        .in(
          "id",
          extras.map((row) => row.id)
        )
      if (deleteError) return { success: false as const, error: deleteError.message }
    }

    return { success: true as const, contact: updated }
  }

  const { data: inserted, error } = await supabase
    .from("pledge_reminders")
    .insert(contact)
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
        "id, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date, frequency, installment_amount, total_payments, first_payment_date, next_payment_date"
      )
      .eq("organization_id", orgId)
      .eq("donor_id", donorId)
      .order("pledge_date", { ascending: false })

    if (error) throw new Error(error.message)

    const pledgeIds = (pledgeRows || []).map((row) => row.id as string)
    const groupByPledge = new Map<string, { campaignGroupId: string | null; campaignGroupName: string | null }>()
    if (pledgeIds.length > 0) {
      const { data: groupRows, error: groupError } = await supabase
        .from("pledges")
        .select("id, campaign_group_id")
        .eq("organization_id", orgId)
        .in("id", pledgeIds)
      if (groupError) throw new Error(groupError.message)
      const groupIds = [
        ...new Set(
          (groupRows || [])
            .map((row) => row.campaign_group_id as string | null)
            .filter((id): id is string => Boolean(id))
        ),
      ]
      const groupNames = new Map<string, string>()
      if (groupIds.length > 0) {
        const { data: nameRows, error: nameError } = await supabase
          .from("campaign_groups")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", groupIds)
        if (nameError) throw new Error(nameError.message)
        for (const row of nameRows || []) {
          groupNames.set(row.id as string, (row.name as string) || "Group")
        }
      }
      for (const row of groupRows || []) {
        const groupId = (row.campaign_group_id as string | null) ?? null
        groupByPledge.set(row.id as string, {
          campaignGroupId: groupId,
          campaignGroupName: groupId ? groupNames.get(groupId) || "" : null,
        })
      }
    }

    return {
      success: true as const,
      pledges: (pledgeRows || []).map((row) => ({
        id: row.id,
        campaignId: (row.campaign_id as string | null) ?? null,
        campaignName: row.campaign_name,
        campaignGroupId: groupByPledge.get(row.id as string)?.campaignGroupId ?? null,
        campaignGroupName: groupByPledge.get(row.id as string)?.campaignGroupName ?? null,
        amountPledged: Number(row.amount_pledged || 0),
        amountPaid: Number(row.amount_paid || 0),
        balanceRemaining: Number(row.balance_remaining || 0),
        status: row.calculated_status,
        pledgeDate: row.pledge_date,
        frequency: row.frequency,
        installmentAmount:
          row.installment_amount == null ? null : Number(row.installment_amount),
        totalPayments: row.total_payments == null ? null : Number(row.total_payments),
        firstPaymentDate: row.first_payment_date,
        nextPaymentDate: row.next_payment_date,
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
