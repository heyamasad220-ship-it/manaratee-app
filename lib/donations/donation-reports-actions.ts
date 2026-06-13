"use server"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  fetchCampaignAnalyticsEntries,
  fetchCampaignRecentActivity,
  fetchDonorTaxYearTotals,
  fetchOrgReportsOverview,
  fetchRecurringReportSummary,
  type CampaignAnalyticsEntry,
  type CampaignRecentActivity,
  type CampaignRow,
} from "@/lib/donations/campaign-analytics"
import {
  fetchDonorSummaryPageAction,
  fetchPaymentsPageAction,
} from "@/lib/donations/donation-list-actions"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import { getPledgeCollectionReportAction } from "@/lib/donations/pledge-reminder-actions"
import { getReceiptReportingSummaryAction } from "@/lib/donations/receipt-actions"

export async function getCampaignAnalyticsAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const entries = await fetchCampaignAnalyticsEntries(access.supabase, access.orgId)
    return { success: true as const, entries }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getCampaignDetailAction(campaignId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const { data: campaign, error } = await access.supabase
      .from("campaigns")
      .select(
        "id, organization_id, name, code, description, goal_amount, start_date, end_date, status, created_at"
      )
      .eq("organization_id", access.orgId)
      .eq("id", campaignId)
      .maybeSingle()

    if (error || !campaign) {
      return { success: false as const, error: error?.message || "Campaign not found" }
    }

    const entries = await fetchCampaignAnalyticsEntries(access.supabase, access.orgId)
    const entry =
      entries.find((row) => row.campaign.id === campaignId) ||
      ({
        campaign: campaign as CampaignRow,
        metrics: {
          campaignId,
          raised: 0,
          pledged: 0,
          collectedAgainstPledges: 0,
          outstanding: 0,
          totalCommitted: 0,
          progressPercent: null,
          donorCount: 0,
          paymentCount: 0,
          averageGift: 0,
          largestGift: 0,
        },
      } satisfies CampaignAnalyticsEntry)
    const activity = await fetchCampaignRecentActivity(
      access.supabase,
      access.orgId,
      campaignId
    )

    return {
      success: true as const,
      campaign: campaign as CampaignRow,
      entry,
      activity,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export type DonationReportsOverview = {
  totalDonations: number
  paymentCount: number
  averageDonation: number
  donorCount: number
}

export async function getDonationReportsOverviewAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const overview = await fetchOrgReportsOverview(access.supabase, access.orgId)
    return { success: true as const, overview }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getDonationReportsCampaignsAction() {
  return getCampaignAnalyticsAction()
}

export async function getDonationReportsDonorsAction(input?: {
  page?: number
  search?: string
}) {
  return fetchDonorSummaryPageAction({
    page: input?.page ?? 1,
    pageSize: DONATIONS_PAGE_SIZE,
    search: input?.search,
    sortBy: "total_donations",
    sortAsc: false,
  })
}

export async function getDonationReportsPaymentsAction(input?: {
  page?: number
  search?: string
}) {
  return fetchPaymentsPageAction({
    page: input?.page ?? 1,
    pageSize: DONATIONS_PAGE_SIZE,
    search: input?.search,
  })
}

export async function getDonationTaxYearTotalsAction(taxYear: number) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const donors = await fetchDonorTaxYearTotals(access.supabase, access.orgId, taxYear)
    return { success: true as const, donors }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getDonationReportsBundleAction(taxYear: number) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const [
      overview,
      campaignEntries,
      topDonors,
      taxYearDonors,
      receiptSummary,
      collectionReport,
      recurringReport,
    ] = await Promise.all([
      fetchOrgReportsOverview(access.supabase, access.orgId),
      fetchCampaignAnalyticsEntries(access.supabase, access.orgId),
      fetchDonorSummaryPageAction({
        page: 1,
        pageSize: 5,
        sortBy: "total_donations",
        sortAsc: false,
      }),
      fetchDonorTaxYearTotals(access.supabase, access.orgId, taxYear),
      getReceiptReportingSummaryAction(),
      getPledgeCollectionReportAction(),
      fetchRecurringReportSummary(access.supabase, access.orgId),
    ])

    return {
      success: true as const,
      overview,
      campaignEntries,
      topDonors: topDonors.success ? topDonors.donors : [],
      taxYearDonors,
      receiptSummary: receiptSummary.success ? receiptSummary.summary : null,
      collectionReport: collectionReport.success ? collectionReport.report : null,
      recurringReport,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getRecurringReportSummaryAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const summary = await fetchRecurringReportSummary(access.supabase, access.orgId)
    return { success: true as const, summary }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
