import type { SupabaseClient } from "@supabase/supabase-js"
import type { DonationReceiptSettings } from "@/lib/donations/receipt-types"
import {
  isPledgeEligibleForReminder,
  type OutstandingPledgeRow,
  type PledgeReminderMessage,
} from "@/lib/donations/pledge-reminder-types"

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export function buildPledgeReminderMessage(
  settings: DonationReceiptSettings,
  input: {
    donorName: string
    campaignName: string | null
    amountPledged: number
    amountPaid: number
    balanceRemaining: number
  }
): PledgeReminderMessage {
  const organizationName = settings.legal_name || "Organization"
  const paymentInstructions =
    settings.pledge_payment_instructions ||
    "Please contact our office to complete your pledge payment."

  const replacements: Record<string, string> = {
    "{{donor_name}}": input.donorName,
    "{{organization_name}}": organizationName,
    "{{campaign_name}}": input.campaignName || "General Fund",
    "{{pledge_amount}}": formatMoney(input.amountPledged),
    "{{amount_paid}}": formatMoney(input.amountPaid),
    "{{balance_remaining}}": formatMoney(input.balanceRemaining),
    "{{payment_instructions}}": paymentInstructions,
  }

  function applyTemplate(template: string) {
    let result = template
    for (const [token, value] of Object.entries(replacements)) {
      result = result.replaceAll(token, value)
    }
    return result
  }

  const subjectTemplate =
    settings.pledge_reminder_subject || "Friendly reminder about your pledge to {{organization_name}}"
  const bodyTemplate =
    settings.pledge_reminder_message ||
    "Dear {{donor_name}},\n\nYour remaining pledge balance is {{balance_remaining}}.\n\n{{payment_instructions}}"

  let body = applyTemplate(bodyTemplate)
  if (settings.pledge_reminder_footer_text) {
    body = `${body}\n\n${settings.pledge_reminder_footer_text}`
  }

  return {
    subject: applyTemplate(subjectTemplate),
    body,
    donorName: input.donorName,
    organizationName,
    campaignName: input.campaignName,
    amountPledged: input.amountPledged,
    amountPaid: input.amountPaid,
    balanceRemaining: input.balanceRemaining,
    paymentInstructions,
  }
}

type PledgeViewRow = {
  id: string
  donor_id: string | null
  donor_name: string | null
  campaign_id: string | null
  campaign_name: string | null
  amount_pledged: number | null
  amount_paid: number | null
  balance_remaining: number | null
  calculated_status: string | null
  pledge_date: string | null
}

async function loadLastPaymentDates(
  supabase: SupabaseClient,
  pledgeIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (pledgeIds.length === 0) return map

  const { data, error } = await supabase
    .from("payments")
    .select("pledge_id, payment_date")
    .in("pledge_id", pledgeIds)
    .neq("status", "voided")
    .order("payment_date", { ascending: false })

  if (error) return map

  for (const row of data || []) {
    if (!row.pledge_id || map.has(row.pledge_id)) continue
    if (row.payment_date) map.set(row.pledge_id, row.payment_date)
  }

  return map
}

async function loadReminderSummaries(
  supabase: SupabaseClient,
  organizationId: string,
  pledgeIds: string[]
): Promise<
  Map<
    string,
    {
      lastReminderAt: string | null
      lastReminderStatus: string | null
      lastContactedAt: string | null
      reminderCount: number
    }
  >
> {
  const map = new Map<
    string,
    {
      lastReminderAt: string | null
      lastReminderStatus: string | null
      lastContactedAt: string | null
      reminderCount: number
    }
  >()

  if (pledgeIds.length === 0) return map

  const { data, error } = await supabase
    .from("pledge_reminders")
    .select("pledge_id, status, reminder_type, sent_at, created_at")
    .eq("organization_id", organizationId)
    .in("pledge_id", pledgeIds)
    .order("created_at", { ascending: false })

  if (error) return map

  for (const row of data || []) {
    const existing = map.get(row.pledge_id) || {
      lastReminderAt: null,
      lastReminderStatus: null,
      lastContactedAt: null,
      reminderCount: 0,
    }

    existing.reminderCount += 1

    if (row.reminder_type === "contacted" && !existing.lastContactedAt) {
      existing.lastContactedAt = row.sent_at || row.created_at
    }

    if (row.reminder_type !== "contacted" && !existing.lastReminderAt) {
      existing.lastReminderAt = row.sent_at || row.created_at
      existing.lastReminderStatus = row.status
    }

    map.set(row.pledge_id, existing)
  }

  return map
}

async function loadContactIdsByDonor(
  supabase: SupabaseClient,
  organizationId: string,
  donorIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  if (donorIds.length === 0) return map

  const { data } = await supabase
    .from("donors")
    .select("id, contact_id")
    .eq("organization_id", organizationId)
    .in("id", donorIds)

  for (const row of data || []) {
    map.set(row.id, row.contact_id ?? null)
  }

  return map
}

export async function fetchOutstandingPledges(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { includeFulfilled?: boolean }
): Promise<OutstandingPledgeRow[]> {
  const { data, error } = await supabase
    .from("pledge_status_view")
    .select(
      "id, donor_id, donor_name, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
    )
    .eq("organization_id", organizationId)
    .order("balance_remaining", { ascending: false })

  if (error) throw new Error(error.message)

  const rows = (data || []) as PledgeViewRow[]
  const eligible = rows.filter((row) => {
    if (options?.includeFulfilled) return true
    return isPledgeEligibleForReminder(
      row.calculated_status,
      Number(row.balance_remaining || 0)
    )
  })

  const pledgeIds = eligible.map((r) => r.id)
  const donorIds = Array.from(
    new Set(eligible.map((r) => r.donor_id).filter(Boolean))
  ) as string[]

  const [lastPayments, reminderSummaries, contactByDonor] = await Promise.all([
    loadLastPaymentDates(supabase, pledgeIds),
    loadReminderSummaries(supabase, organizationId, pledgeIds),
    loadContactIdsByDonor(supabase, organizationId, donorIds),
  ])

  return eligible.map((row) => {
    const summary = reminderSummaries.get(row.id)
    return {
      id: row.id,
      donorId: row.donor_id,
      contactId: row.donor_id ? contactByDonor.get(row.donor_id) ?? null : null,
      donorName: row.donor_name || "Unknown Donor",
      campaignName: row.campaign_name,
      amountPledged: Number(row.amount_pledged || 0),
      amountPaid: Number(row.amount_paid || 0),
      balanceRemaining: Number(row.balance_remaining || 0),
      status: row.calculated_status || "open",
      pledgeDate: row.pledge_date,
      lastPaymentDate: lastPayments.get(row.id) ?? null,
      lastReminderAt: summary?.lastReminderAt ?? null,
      lastReminderStatus: (summary?.lastReminderStatus as OutstandingPledgeRow["lastReminderStatus"]) ?? null,
      lastContactedAt: summary?.lastContactedAt ?? null,
      reminderCount: summary?.reminderCount ?? 0,
    }
  })
}

export async function fetchPledgeReminderHistory(
  supabase: SupabaseClient,
  organizationId: string,
  filters?: { pledgeId?: string; donorId?: string; limit?: number }
) {
  let query = supabase
    .from("pledge_reminders")
    .select(
      "id, pledge_id, donor_id, contact_id, reminder_type, status, message_subject, message_body, delivered_externally, contact_notes, sent_at, sent_by, created_at"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (filters?.pledgeId) query = query.eq("pledge_id", filters.pledgeId)
  if (filters?.donorId) query = query.eq("donor_id", filters.donorId)
  if (filters?.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

export type PledgeCollectionReport = {
  outstandingCount: number
  outstandingTotal: number
  overdueCount: number
  noPaymentCount: number
  partialCount: number
  reminderCount: number
  pledges: OutstandingPledgeRow[]
}

export async function buildPledgeCollectionReport(
  supabase: SupabaseClient,
  organizationId: string
): Promise<PledgeCollectionReport> {
  const pledges = await fetchOutstandingPledges(supabase, organizationId)
  const today = new Date()

  let overdueCount = 0
  let noPaymentCount = 0
  let partialCount = 0

  for (const pledge of pledges) {
    if (pledge.amountPaid <= 0.009) noPaymentCount += 1
    else if (pledge.balanceRemaining > 0.009) partialCount += 1

    if (pledge.pledgeDate) {
      const due = new Date(pledge.pledgeDate)
      if (due < today && pledge.balanceRemaining > 0.009) overdueCount += 1
    }
  }

  const { count: reminderCount } = await supabase
    .from("pledge_reminders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  return {
    outstandingCount: pledges.length,
    outstandingTotal: pledges.reduce((sum, p) => sum + p.balanceRemaining, 0),
    overdueCount,
    noPaymentCount,
    partialCount,
    reminderCount: reminderCount || 0,
    pledges,
  }
}
