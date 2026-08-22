"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  buildPledgeCampaignMap,
  computeCampaignAskLevelMetrics,
  computeCampaignSourceBreakdown,
  fetchCampaignAnalyticsData,
  fetchCampaignAnalyticsEntries,
  fetchCampaignDonorInsights,
  fetchCampaignOutstandingPledges,
  fetchDonorTaxYearTotals,
  fetchOrgReportsOverview,
  fetchRecurringReportSummary,
  type CampaignAnalyticsEntry,
  type CampaignRow,
} from "@/lib/donations/campaign-analytics"
import {
  fetchCampaignAskLevels,
} from "@/lib/donations/campaign-ask-level-actions"
import { fetchCampaignProspectAskLevelStats } from "@/lib/donations/campaign-prospect-actions"
import { syncCampaignPhases } from "@/lib/donations/campaign-phase-actions"
import { ensureCampaignDonationFund } from "@/lib/donations/ensure-campaign-donation-fund"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  normalizeCampaignOverviewMetricKeys,
  parseCampaignOverviewMetricKeys,
  type CampaignOverviewMetricKey,
} from "@/lib/donations/campaign-overview-metrics"
import {
  fetchDonorSummaryPageAction,
  fetchPaymentsPageAction,
} from "@/lib/donations/donation-list-actions"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import { getPledgeCollectionReportAction } from "@/lib/donations/pledge-reminder-actions"
import { getReceiptReportingSummaryAction } from "@/lib/donations/receipt-actions"

const CAMPAIGN_SELECT =
  "id, organization_id, name, code, description, goal_amount, start_date, end_date, status, created_at, overview_metric_keys, goal_breakdown_enabled"

const CAMPAIGN_SELECT_WITH_METRICS =
  "id, organization_id, name, code, description, goal_amount, start_date, end_date, status, created_at, overview_metric_keys"

const CAMPAIGN_SELECT_LEGACY =
  "id, organization_id, name, code, description, goal_amount, start_date, end_date, status, created_at"

type CampaignWriteInput = {
  name: string
  description?: string | null
  goal_amount?: number | null
  start_date?: string | null
  end_date?: string | null
  status?: string | null
}

function generateCampaignCode(campaignName: string) {
  const words = campaignName.trim().split(/\s+/)
  const codePrefix = words
    .map((word) => word.charAt(0).toUpperCase())
    .join("")
    .replace(/[^A-Z0-9]/g, "")
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${codePrefix || "C"}${randomSuffix}`.slice(0, 24)
}

function formatCampaignWriteError(
  error: { message?: string; code?: string; details?: string | null } | null,
  fallback: string
) {
  const parts = [error?.message, error?.details].filter(
    (part): part is string => Boolean(part && part.trim())
  )
  if (parts.length > 0) return parts.join(" — ")
  if (error?.code) return `${fallback} (${error.code})`
  return fallback
}

function revalidateCampaignPaths(campaignId?: string) {
  revalidatePath("/donations/campaigns")
  revalidatePath("/donations/settings")
  revalidatePath("/donations")
  if (campaignId) {
    revalidatePath(`/donations/campaigns/${campaignId}`)
  }
}

async function fetchCampaignRow(
  supabase: SupabaseClient,
  orgId: string,
  campaignId: string
) {
  const withBreakdown = await supabase
    .from("campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("organization_id", orgId)
    .eq("id", campaignId)
    .maybeSingle()

  if (!withBreakdown.error) {
    return withBreakdown
  }

  if (
    withBreakdown.error.code === "42703" ||
    /goal_breakdown_enabled/i.test(withBreakdown.error.message || "")
  ) {
    const withMetrics = await supabase
      .from("campaigns")
      .select(CAMPAIGN_SELECT_WITH_METRICS)
      .eq("organization_id", orgId)
      .eq("id", campaignId)
      .maybeSingle()

    if (!withMetrics.error) {
      return withMetrics
    }

    if (
      withMetrics.error.code === "42703" ||
      /overview_metric_keys/i.test(withMetrics.error.message || "")
    ) {
      return supabase
        .from("campaigns")
        .select(CAMPAIGN_SELECT_LEGACY)
        .eq("organization_id", orgId)
        .eq("id", campaignId)
        .maybeSingle()
    }

    return withMetrics
  }

  if (
    withBreakdown.error.code === "42703" ||
    /overview_metric_keys/i.test(withBreakdown.error.message || "")
  ) {
    return supabase
      .from("campaigns")
      .select(CAMPAIGN_SELECT_LEGACY)
      .eq("organization_id", orgId)
      .eq("id", campaignId)
      .maybeSingle()
  }

  return withBreakdown
}

async function selectCampaignAfterWrite(
  writeClient: SupabaseClient,
  orgId: string,
  campaignId: string
) {
  const full = await writeClient
    .from("campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("organization_id", orgId)
    .eq("id", campaignId)
    .maybeSingle()

  if (!full.error && full.data) return full

  const withMetrics = await writeClient
    .from("campaigns")
    .select(CAMPAIGN_SELECT_WITH_METRICS)
    .eq("organization_id", orgId)
    .eq("id", campaignId)
    .maybeSingle()

  if (!withMetrics.error && withMetrics.data) return withMetrics

  return writeClient
    .from("campaigns")
    .select(CAMPAIGN_SELECT_LEGACY)
    .eq("organization_id", orgId)
    .eq("id", campaignId)
    .maybeSingle()
}

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
    const { data: campaign, error } = await fetchCampaignRow(
      access.supabase,
      access.orgId,
      campaignId
    )

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
    const insights = await fetchCampaignDonorInsights(
      access.supabase,
      access.orgId,
      campaignId
    )

    const analyticsData = await fetchCampaignAnalyticsData(access.supabase, access.orgId)
    if (analyticsData.error) {
      return { success: false as const, error: analyticsData.error }
    }

    const sourceBreakdown = computeCampaignSourceBreakdown(
      campaignId,
      campaign.goal_amount,
      analyticsData.pledges,
      analyticsData.payments,
      buildPledgeCampaignMap(analyticsData.pledges)
    )

    const outstandingPledges = await fetchCampaignOutstandingPledges(
      access.supabase,
      access.orgId,
      campaignId
    )

    let askLevels: Awaited<ReturnType<typeof fetchCampaignAskLevels>> = []
    try {
      askLevels = await fetchCampaignAskLevels(access.supabase, access.orgId, campaignId)
    } catch {
      askLevels = []
    }

    const askLevelMetrics = computeCampaignAskLevelMetrics({
      askLevels,
      phases: [],
      campaignId,
      pledges: analyticsData.pledges,
      prospectStatsByAskLevelId: await fetchCampaignProspectAskLevelStats(
        access.orgId,
        campaignId
      ),
    })

    return {
      success: true as const,
      campaign: {
        ...(campaign as CampaignRow),
        goal_breakdown_enabled: false,
      },
      overviewMetricKeys: parseCampaignOverviewMetricKeys(
        "overview_metric_keys" in campaign ? campaign.overview_metric_keys : null
      ),
      entry,
      insights,
      sourceBreakdown,
      outstandingPledges,
      askLevels,
      askLevelMetrics,
      canManage: access.canManage,
      canManageCampaigns: access.canManageCampaigns,
      canManageProspects: access.canManageProspects,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function createCampaignAction(input: CampaignWriteInput) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  const name = input.name.trim()
  if (!name) return { success: false as const, error: "Campaign name is required" }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaigns")
      .select("id")
      .eq("organization_id", access.orgId)
      .ilike("name", name)
      .maybeSingle()

    if (existingError) {
      return { success: false as const, error: existingError.message }
    }
    if (existing) {
      return { success: false as const, error: "A campaign with this name already exists" }
    }

    const insertPayload: Record<string, unknown> = {
      organization_id: access.orgId,
      name,
      description: input.description?.trim() || null,
      goal_amount: input.goal_amount ?? null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: input.status?.toLowerCase() || "draft",
      code: generateCampaignCode(name),
      goal_breakdown_enabled: false,
    }

    let campaign: CampaignRow | null = null
    let error: { message?: string; code?: string; details?: string | null } | null = null

    {
      const inserted = await writeClient
        .from("campaigns")
        .insert(insertPayload)
        .select(CAMPAIGN_SELECT)
        .single()
      campaign = (inserted.data as CampaignRow | null) ?? null
      error = inserted.error
    }

    if (
      error &&
      (error.code === "42703" || /goal_breakdown_enabled/i.test(error.message || ""))
    ) {
      delete insertPayload.goal_breakdown_enabled
      const retry = await writeClient
        .from("campaigns")
        .insert(insertPayload)
        .select(CAMPAIGN_SELECT_WITH_METRICS)
        .single()
      campaign = (retry.data as CampaignRow | null) ?? null
      error = retry.error
    }

    if (
      error &&
      (error.code === "42703" || /overview_metric_keys/i.test(error.message || ""))
    ) {
      const retry = await writeClient
        .from("campaigns")
        .insert(insertPayload)
        .select(CAMPAIGN_SELECT_LEGACY)
        .single()
      campaign = (retry.data as CampaignRow | null) ?? null
      error = retry.error
    }

    if (error || !campaign) {
      return {
        success: false as const,
        error: formatCampaignWriteError(error, "Failed to create campaign"),
      }
    }

    const fundResult = await ensureCampaignDonationFund(writeClient, access.orgId, name)
    revalidateCampaignPaths(campaign.id)

    if (!fundResult.success) {
      return {
        success: true as const,
        campaign: campaign as CampaignRow,
        fundError: fundResult.error,
      }
    }

    return { success: true as const, campaign: campaign as CampaignRow }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function updateCampaignAction(campaignId: string, input: CampaignWriteInput) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  const name = input.name.trim()
  if (!name) return { success: false as const, error: "Campaign name is required" }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaigns")
      .select("id")
      .eq("organization_id", access.orgId)
      .ilike("name", name)
      .neq("id", campaignId)
      .maybeSingle()

    if (existingError) {
      return { success: false as const, error: existingError.message }
    }
    if (existing) {
      return { success: false as const, error: "A campaign with this name already exists" }
    }

    const updatePayload: Record<string, unknown> = {
      name,
      description: input.description?.trim() || null,
      goal_amount: input.goal_amount ?? null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: input.status?.toLowerCase() || "draft",
      goal_breakdown_enabled: false,
    }

    let campaign: CampaignRow | null = null
    let error: { message?: string; code?: string; details?: string | null } | null = null

    {
      const updated = await writeClient
        .from("campaigns")
        .update(updatePayload)
        .eq("organization_id", access.orgId)
        .eq("id", campaignId)
        .select(CAMPAIGN_SELECT)
        .maybeSingle()
      campaign = (updated.data as CampaignRow | null) ?? null
      error = updated.error
    }

    if (
      error &&
      (error.code === "42703" || /goal_breakdown_enabled/i.test(error.message || ""))
    ) {
      delete updatePayload.goal_breakdown_enabled
      const retry = await writeClient
        .from("campaigns")
        .update(updatePayload)
        .eq("organization_id", access.orgId)
        .eq("id", campaignId)
        .select(CAMPAIGN_SELECT_WITH_METRICS)
        .maybeSingle()
      campaign = (retry.data as CampaignRow | null) ?? null
      error = retry.error
    }

    if (error || !campaign) {
      const fallback = await selectCampaignAfterWrite(writeClient, access.orgId, campaignId)
      if (fallback.error || !fallback.data) {
        return {
          success: false as const,
          error: formatCampaignWriteError(error || fallback.error, "Failed to update campaign"),
        }
      }
      campaign = fallback.data as CampaignRow
    }

    const syncResult = await syncCampaignPhases(access.orgId, campaignId, [], {
      goalBreakdownEnabled: false,
    })
    if (!syncResult.success) {
      return { success: false as const, error: syncResult.error }
    }

    revalidateCampaignPaths(campaignId)

    return { success: true as const, campaign: campaign as CampaignRow }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

async function getCampaignFinancialActivityError(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<string | null> {
  const [pledgesResult, paymentsResult, plansResult] = await Promise.all([
    supabase
      .from("pledges")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId),
    supabase
      .from("recurring_donation_plans")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId),
  ])

  const hasPledges = !pledgesResult.error && (pledgesResult.count || 0) > 0
  const hasPayments = !paymentsResult.error && (paymentsResult.count || 0) > 0
  const hasPlans = !plansResult.error && (plansResult.count || 0) > 0

  if (!hasPledges && !hasPayments && !hasPlans) return null

  return "This campaign cannot be deleted because it has financial activity. Mark it Completed instead."
}

export async function deleteCampaignAction(campaignId: string) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  if (!campaignId.trim()) {
    return { success: false as const, error: "Campaign is required" }
  }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaigns")
      .select("id")
      .eq("organization_id", access.orgId)
      .eq("id", campaignId)
      .maybeSingle()

    if (existingError) {
      return { success: false as const, error: existingError.message }
    }
    if (!existing) {
      return { success: false as const, error: "Campaign not found" }
    }

    const activityError = await getCampaignFinancialActivityError(
      writeClient,
      access.orgId,
      campaignId
    )
    if (activityError) {
      return { success: false as const, error: activityError }
    }

    const { error } = await writeClient
      .from("campaigns")
      .delete()
      .eq("organization_id", access.orgId)
      .eq("id", campaignId)

    if (error) {
      return {
        success: false as const,
        error: formatCampaignWriteError(error, "Failed to delete campaign"),
      }
    }

    revalidateCampaignPaths(campaignId)
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function updateCampaignOverviewMetricsAction(
  campaignId: string,
  overviewMetricKeys: CampaignOverviewMetricKey[] | null
) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  const normalized =
    overviewMetricKeys == null ? null : normalizeCampaignOverviewMetricKeys(overviewMetricKeys)

  if (normalized != null && normalized.length === 0) {
    return { success: false as const, error: "Select at least one metric or use automatic mode." }
  }

  try {
    const writeClient = createServiceRoleClient()
    const { data: campaign, error } = await writeClient
      .from("campaigns")
      .update({ overview_metric_keys: normalized })
      .eq("organization_id", access.orgId)
      .eq("id", campaignId)
      .select(CAMPAIGN_SELECT)
      .maybeSingle()

    if (error || !campaign) {
      return {
        success: false as const,
        error: formatCampaignWriteError(error, "Failed to update campaign overview metrics"),
      }
    }

    revalidateCampaignPaths(campaignId)

    return {
      success: true as const,
      overviewMetricKeys: parseCampaignOverviewMetricKeys(campaign.overview_metric_keys),
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
  needsAttentionCount: number
}

export async function getDonationReportsOverviewAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const [overview, attentionResult] = await Promise.all([
      fetchOrgReportsOverview(access.supabase, access.orgId),
      access.supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", access.orgId)
        .in("status", ["pending_review", "unresolved", "voided"]),
    ])
    return {
      success: true as const,
      overview: {
        ...overview,
        needsAttentionCount: attentionResult.count ?? 0,
      },
    }
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

export async function getAnnualStatementKpisAction(taxYear: number) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const [donors, receiptsResult] = await Promise.all([
      fetchDonorTaxYearTotals(access.supabase, access.orgId, taxYear),
      access.supabase
        .from("donation_receipts")
        .select("id, status, donor_id")
        .eq("organization_id", access.orgId)
        .eq("receipt_type", "annual_statement")
        .eq("tax_year", taxYear),
    ])

    if (receiptsResult.error) throw new Error(receiptsResult.error.message)

    const statements = receiptsResult.data || []
    const donorsWithStatement = new Set(
      statements.map((row) => String(row.donor_id || "")).filter(Boolean)
    )

    return {
      success: true as const,
      kpis: {
        eligibleDonors: donors.length,
        statementsGenerated: statements.length,
        statementsSent: statements.filter(
          (row) => row.status === "sent" || row.status === "resent"
        ).length,
        needAttention: donors.filter((donor) => !donorsWithStatement.has(donor.donorId)).length,
      },
    }
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
