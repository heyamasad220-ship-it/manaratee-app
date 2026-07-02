"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  fetchCampaignAnalyticsEntries,
  formatDonationCurrency,
  type CampaignAnalyticsEntry,
} from "@/lib/donations/campaign-analytics"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  getDonationDashboardSummaryAction,
  type DonationDashboardSummary,
} from "@/lib/donations/donation-dashboard-actions"
import { buildPledgeCollectionReport } from "@/lib/donations/pledge-reminder-data"
import { paymentNetAmount } from "@/lib/donations/payment-net-amount"
import { donationPaymentDetailHref } from "@/lib/donations/donation-payment-paths"
import { donationPledgesHref } from "@/lib/donations/donation-pledge-paths"

const CAMPAIGNS_ENDING_SOON_DAYS = 14
const RECENT_ACTIVITY_LIMIT = 10

export type DonationOverviewActionItem = {
  id: string
  label: string
  href: string
}

export type DonationOverviewActiveCampaign = {
  id: string
  name: string
  goalAmount: number | null
  raised: number
  progressPercent: number | null
  outstandingPledgeBalance: number
}

export type DonationOverviewActivityItem = {
  id: string
  label: string
  occurredAt: string
  href: string | null
}

export type DonationOverviewPayload = {
  summary: DonationDashboardSummary
  actionItems: DonationOverviewActionItem[]
  activeCampaigns: DonationOverviewActiveCampaign[]
  recentActivity: DonationOverviewActivityItem[]
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return count === 1 ? singular : pluralLabel
}

function buildActionItems(input: {
  pendingMatchCount: number
  linkablePledgePaymentCount: number
  unresolvedCount: number
  overduePledgeCount: number
  failedReceiptCount: number
  failedProcessorCount: number
  campaignsEndingSoon: Array<{ id: string; name: string; endDate: string }>
}): DonationOverviewActionItem[] {
  const items: DonationOverviewActionItem[] = []

  const matchCount =
    input.pendingMatchCount + input.linkablePledgePaymentCount + input.unresolvedCount

  if (input.pendingMatchCount > 0) {
    items.push({
      id: "pending-match",
      label: `${input.pendingMatchCount} imported ${plural(input.pendingMatchCount, "payment")} waiting to be matched`,
      href: "/donations/reports/match",
    })
  }

  if (input.linkablePledgePaymentCount > 0) {
    items.push({
      id: "linkable-pledge-payments",
      label: `${input.linkablePledgePaymentCount} ${plural(input.linkablePledgePaymentCount, "payment")} may be linked to an open pledge`,
      href: "/donations/reports/match",
    })
  }

  if (input.unresolvedCount > 0) {
    items.push({
      id: "unresolved",
      label: `${input.unresolvedCount} unresolved ${plural(input.unresolvedCount, "payment")} need review`,
      href: "/donations/reports/match",
    })
  }

  if (matchCount === 0 && input.failedProcessorCount > 0) {
    items.push({
      id: "processor-failures",
      label: `${input.failedProcessorCount} payment processor ${plural(input.failedProcessorCount, "issue", "issues")} need attention`,
      href: "/donations/reports/match",
    })
  }

  if (input.overduePledgeCount > 0) {
    items.push({
      id: "overdue-pledges",
      label: `${input.overduePledgeCount} overdue ${plural(input.overduePledgeCount, "pledge")}`,
      href: donationPledgesHref({ hash: "collection-queue" }),
    })
  }

  if (input.failedReceiptCount > 0) {
    items.push({
      id: "failed-receipts",
      label: `${input.failedReceiptCount} failed ${plural(input.failedReceiptCount, "receipt")}`,
      href: "/donations/reports/receipts",
    })
  }

  for (const campaign of input.campaignsEndingSoon) {
    items.push({
      id: `campaign-ending-${campaign.id}`,
      label: `${campaign.name} ends ${formatEndingDate(campaign.endDate)}`,
      href: `/donations/campaigns/${campaign.id}`,
    })
  }

  return items
}

function formatEndingDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "soon"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function mapActiveCampaign(entry: CampaignAnalyticsEntry): DonationOverviewActiveCampaign {
  return {
    id: entry.campaign.id,
    name: entry.campaign.name,
    goalAmount: entry.campaign.goal_amount ?? null,
    raised: entry.metrics.raised,
    progressPercent: entry.metrics.progressPercent,
    outstandingPledgeBalance: entry.metrics.outstanding,
  }
}

function activityTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

/** Unallocated gifts for donors who still have an open pledge — not standalone donations. */
async function countLinkableUnallocatedPayments(
  supabase: SupabaseClient,
  orgId: string
): Promise<number> {
  const { data: openPledgeRows, error: pledgeError } = await supabase
    .from("pledge_status_view")
    .select("donor_id")
    .eq("organization_id", orgId)
    .gt("balance_remaining", 0)

  if (pledgeError) throw new Error(pledgeError.message)

  const donorIds = [
    ...new Set(
      (openPledgeRows || [])
        .map((row) => row.donor_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  if (donorIds.length === 0) return 0

  const batchSize = 200
  let total = 0

  for (let index = 0; index < donorIds.length; index += batchSize) {
    const batch = donorIds.slice(index, index + batchSize)
    const { count, error } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "unallocated")
      .is("pledge_id", null)
      .in("donor_id", batch)

    if (error) throw new Error(error.message)
    total += count ?? 0
  }

  return total
}

async function buildRecentActivity(
  supabase: Awaited<ReturnType<typeof requireDonationStaffAccess>> extends { ok: true; supabase: infer S }
    ? S
    : never,
  orgId: string
): Promise<DonationOverviewActivityItem[]> {
  const perSource = 5

  const [paymentsResult, pledgesResult, fulfilledResult, remindersResult, importsResult, campaignsResult] =
    await Promise.all([
      supabase
        .from("payments")
        .select("id, amount, payment_date, sender_name, created_at")
        .eq("organization_id", orgId)
        .order("payment_date", { ascending: false })
        .limit(perSource),
      supabase
        .from("pledges")
        .select("id, amount_pledged, pledge_date, created_at, campaigns(name)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(perSource),
      supabase
        .from("pledge_status_view")
        .select("id, donor_name, campaign_name, amount_pledged, created_at, pledge_date")
        .eq("organization_id", orgId)
        .eq("calculated_status", "fulfilled")
        .order("pledge_date", { ascending: false })
        .limit(perSource),
      supabase
        .from("pledge_reminders")
        .select("id, sent_at, created_at, pledge_id, status")
        .eq("organization_id", orgId)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(perSource),
      supabase
        .from("payment_import_batches")
        .select("id, file_name, row_count, status, created_at")
        .eq("organization_id", orgId)
        .in("status", ["imported", "completed"])
        .order("created_at", { ascending: false })
        .limit(perSource),
      supabase
        .from("campaigns")
        .select("id, name, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(perSource),
    ])

  const items: DonationOverviewActivityItem[] = []

  for (const payment of paymentsResult.data || []) {
    const amount = formatDonationCurrency(paymentNetAmount(payment.amount, 0))
    const donor = String(payment.sender_name || "").trim() || "Donor"
    items.push({
      id: `payment-${payment.id}`,
      label: `Payment recorded — ${amount} from ${donor}`,
      occurredAt: (payment.payment_date as string) || (payment.created_at as string),
      href: donationPaymentDetailHref(payment.id as string),
    })
  }

  for (const pledge of pledgesResult.data || []) {
    const campaign = Array.isArray(pledge.campaigns)
      ? pledge.campaigns[0]
      : pledge.campaigns
    const campaignName =
      (campaign as { name?: string | null } | null | undefined)?.name?.trim() || "Campaign"
    const amount = formatDonationCurrency(Number(pledge.amount_pledged || 0))
    items.push({
      id: `pledge-${pledge.id}`,
      label: `Pledge created — ${amount} for ${campaignName}`,
      occurredAt: (pledge.created_at as string) || (pledge.pledge_date as string),
      href: donationPledgesHref({ pledgeId: String(pledge.id), action: "edit" }),
    })
  }

  for (const pledge of fulfilledResult.data || []) {
    const donor = String(pledge.donor_name || "").trim() || "Donor"
    const campaign = String(pledge.campaign_name || "").trim() || "Campaign"
    items.push({
      id: `pledge-fulfilled-${pledge.id}`,
      label: `Pledge paid — ${donor} fulfilled ${campaign}`,
      occurredAt: (pledge.pledge_date as string) || (pledge.created_at as string),
      href: donationPledgesHref({ pledgeId: String(pledge.id), action: "edit" }),
    })
  }

  for (const reminder of remindersResult.data || []) {
    items.push({
      id: `reminder-${reminder.id}`,
      label: "Pledge reminder sent",
      occurredAt: (reminder.sent_at as string) || (reminder.created_at as string),
      href: reminder.pledge_id
        ? donationPledgesHref({ pledgeId: String(reminder.pledge_id), action: "edit" })
        : donationPledgesHref(),
    })
  }

  for (const batch of importsResult.data || []) {
    const fileName = String(batch.file_name || "payments.csv")
    const rowCount = Number(batch.row_count || 0)
    items.push({
      id: `import-${batch.id}`,
      label: `Import completed — ${rowCount} ${plural(rowCount, "row")} from ${fileName}`,
      occurredAt: batch.created_at as string,
      href: "/donations/reports/import",
    })
  }

  for (const campaign of campaignsResult.data || []) {
    items.push({
      id: `campaign-${campaign.id}`,
      label: `Campaign created — ${String(campaign.name || "Untitled")}`,
      occurredAt: campaign.created_at as string,
      href: `/donations/campaigns/${campaign.id}`,
    })
  }

  return items
    .filter((item) => activityTimestamp(item.occurredAt) > 0)
    .sort((a, b) => activityTimestamp(b.occurredAt) - activityTimestamp(a.occurredAt))
    .slice(0, RECENT_ACTIVITY_LIMIT)
}

export async function getDonationOverviewDashboardAction(): Promise<
  { success: true; data: DonationOverviewPayload } | { success: false; error: string }
> {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false, error: access.error }

  const summaryResult = await getDonationDashboardSummaryAction(null)
  if (!summaryResult.success) {
    return { success: false, error: summaryResult.error }
  }

  const endingSoonCutoff = new Date()
  endingSoonCutoff.setDate(endingSoonCutoff.getDate() + CAMPAIGNS_ENDING_SOON_DAYS)
  const todayIso = new Date().toISOString().slice(0, 10)

  const [
    pendingMatchResult,
    linkablePledgePaymentCount,
    unresolvedResult,
    failedReceiptsResult,
    failedProcessorResult,
    pledgeReport,
    campaignEntries,
    recentActivity,
  ] = await Promise.all([
    access.supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.orgId)
      .eq("status", "pending_review"),
    countLinkableUnallocatedPayments(access.supabase, access.orgId),
    access.supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.orgId)
      .eq("status", "unresolved"),
    access.supabase
      .from("donation_receipts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.orgId)
      .eq("status", "failed"),
    access.supabase
      .from("payment_processor_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.orgId)
      .eq("processing_status", "failed"),
    buildPledgeCollectionReport(access.supabase, access.orgId),
    fetchCampaignAnalyticsEntries(access.supabase, access.orgId),
    buildRecentActivity(access.supabase, access.orgId),
  ])

  const campaignsEndingSoon = campaignEntries
    .filter(({ campaign }) => {
      if (campaign.status?.toLowerCase() !== "active") return false
      if (!campaign.end_date) return false
      const end = new Date(campaign.end_date)
      if (Number.isNaN(end.getTime())) return false
      return campaign.end_date >= todayIso && campaign.end_date <= endingSoonCutoff.toISOString().slice(0, 10)
    })
    .map(({ campaign }) => ({
      id: campaign.id,
      name: campaign.name,
      endDate: campaign.end_date as string,
    }))
    .slice(0, 5)

  const actionItems = buildActionItems({
    pendingMatchCount: pendingMatchResult.count ?? 0,
    linkablePledgePaymentCount,
    unresolvedCount: unresolvedResult.count ?? 0,
    overduePledgeCount: pledgeReport.overdueCount,
    failedReceiptCount: failedReceiptsResult.count ?? 0,
    failedProcessorCount: failedProcessorResult.count ?? 0,
    campaignsEndingSoon,
  })

  const activeCampaigns = campaignEntries
    .filter(({ campaign }) => campaign.status?.toLowerCase() === "active")
    .map(mapActiveCampaign)
    .sort((a, b) => b.raised - a.raised)

  return {
    success: true,
    data: {
      summary: summaryResult.summary,
      actionItems,
      activeCampaigns,
      recentActivity,
    },
  }
}
