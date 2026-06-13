"use server"

import {
  fetchCampaignAnalyticsEntries,
  type CampaignAnalyticsEntry,
  type CampaignPaymentRow,
} from "@/lib/donations/campaign-analytics"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export type DonationDashboardSummary = {
  totalCollected: number
  paymentCount: number
  thisMonthCollected: number
  totalPledged: number
  pledgeCollected: number
  outstandingBalance: number
  activePledgeCount: number
}

export type DonationMonthlyTotal = {
  monthKey: string
  amount: number
  paymentCount: number
}

export type DonationSourceTotal = {
  sourceKey: string
  amount: number
}

export async function getDonationDashboardSummaryAction(
  timeRangeStart?: string | null
): Promise<
  | {
      success: true
      summary: DonationDashboardSummary
      monthlyTotals: DonationMonthlyTotal[]
      sourceTotals: DonationSourceTotal[]
    }
  | { success: false; error: string }
> {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false, error: access.error }

  const [paymentSummary, pledgeSummary, monthlyResult, sourceResult] = await Promise.all([
    access.supabase.rpc("donation_org_payment_summary", { p_org_id: access.orgId }),
    access.supabase.rpc("donation_org_pledge_summary", { p_org_id: access.orgId }),
    access.supabase.rpc("donation_monthly_payment_totals", {
      p_org_id: access.orgId,
      p_months: 12,
    }),
    access.supabase.rpc("donation_payment_source_totals", {
      p_org_id: access.orgId,
      p_date_from: timeRangeStart ?? null,
    }),
  ])

  if (paymentSummary.error) return { success: false, error: paymentSummary.error.message }
  if (pledgeSummary.error) return { success: false, error: pledgeSummary.error.message }
  if (monthlyResult.error) return { success: false, error: monthlyResult.error.message }
  if (sourceResult.error) return { success: false, error: sourceResult.error.message }

  const paymentRow = Array.isArray(paymentSummary.data)
    ? paymentSummary.data[0]
    : paymentSummary.data
  const pledgeRow = Array.isArray(pledgeSummary.data)
    ? pledgeSummary.data[0]
    : pledgeSummary.data

  let totalCollected = Number(paymentRow?.total_collected || 0)
  let paymentCount = Number(paymentRow?.payment_count || 0)
  let thisMonthCollected = Number(paymentRow?.this_month_collected || 0)

  if (timeRangeStart) {
    const { data: rangePayments, error } = await access.supabase
      .from("payments")
      .select("amount")
      .eq("organization_id", access.orgId)
      .gte("payment_date", timeRangeStart)

    if (error) return { success: false, error: error.message }

    totalCollected = (rangePayments || []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    )
    paymentCount = (rangePayments || []).length
    thisMonthCollected = Number(paymentRow?.this_month_collected || 0)
  }

  const monthlyTotals = (monthlyResult.data || []).map((row: any) => ({
    monthKey: String(row.month_key),
    amount: Number(row.amount || 0),
    paymentCount: Number(row.payment_count || 0),
  }))

  const sourceTotals = (sourceResult.data || []).map((row: any) => ({
    sourceKey: String(row.source_key),
    amount: Number(row.amount || 0),
  }))

  return {
    success: true,
    summary: {
      totalCollected,
      paymentCount,
      thisMonthCollected,
      totalPledged: Number(pledgeRow?.total_pledged || 0),
      pledgeCollected: Number(pledgeRow?.total_collected || 0),
      outstandingBalance: Number(pledgeRow?.outstanding_balance || 0),
      activePledgeCount: Number(pledgeRow?.active_pledge_count || 0),
    },
    monthlyTotals,
    sourceTotals,
  }
}

export async function getDonationDashboardCampaignsAction(): Promise<
  | {
      success: true
      campaignEntries: CampaignAnalyticsEntry[]
      recentPayments: CampaignPaymentRow[]
    }
  | { success: false; error: string }
> {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false, error: access.error }

  let campaignEntries: CampaignAnalyticsEntry[]
  try {
    campaignEntries = await fetchCampaignAnalyticsEntries(access.supabase, access.orgId)
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }

  const { data: recentPayments, error } = await access.supabase
    .from("payments")
    .select(
      "id, sender_name, amount, payment_date, source, status, pledge_id, campaign_id, donor_id, contact_id"
    )
    .eq("organization_id", access.orgId)
    .order("payment_date", { ascending: false })
    .limit(5)

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    campaignEntries,
    recentPayments: (recentPayments || []) as CampaignPaymentRow[],
  }
}
