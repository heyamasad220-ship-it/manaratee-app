import type { SupabaseClient } from "@supabase/supabase-js"

import { countsTowardGivingTotals, paymentNetAmount } from "@/lib/donations/payment-net-amount"
import { normalizePaymentSourceChannel } from "@/lib/donations/payment-source-channel"

export type CampaignRow = {
  id: string
  organization_id: string
  name: string
  code?: string | null
  description?: string | null
  goal_amount?: number | null
  start_date?: string | null
  end_date?: string | null
  status?: string | null
  created_at?: string | null
  overview_metric_keys?: string[] | null
}

export type CampaignPledgeRow = {
  id: string
  campaign_id?: string | null
  donor_id?: string | null
  donor_name?: string | null
  amount_pledged?: number | null
  amount_paid?: number | null
  balance_remaining?: number | null
  calculated_status?: string | null
  pledge_date?: string | null
}

export type CampaignOutstandingPledgeRow = {
  id: string
  donorId: string | null
  contactId: string | null
  donorName: string
  amountPledged: number
  amountPaid: number
  balanceRemaining: number
  status: string
  pledgeDate: string | null
}

export type CampaignPaymentRow = {
  id: string
  campaign_id?: string | null
  pledge_id?: string | null
  donor_id?: string | null
  contact_id?: string | null
  sender_name?: string | null
  amount?: number | null
  refunded_amount?: number | null
  payment_date?: string | null
  source?: string | null
  status?: string | null
  memo?: string | null
  recurring_donation_plan_id?: string | null
}

export type CampaignSourceBucket =
  | "cash"
  | "checks"
  | "square"
  | "ccOneTime"
  | "ccRecurring"
  | "ticketSales"
  | "other"

export type CampaignSourceBreakdown = {
  cash: number
  checks: number
  square: number
  ccOneTime: number
  ccRecurring: number
  ticketSales: number
  other: number
  collected: number
  remainingPledges: number
  totalRaised: number
  target: number | null
  percentRemaining: number | null
}

export type CampaignMetrics = {
  campaignId: string
  raised: number
  pledged: number
  collectedAgainstPledges: number
  outstanding: number
  totalCommitted: number
  progressPercent: number | null
  donorCount: number
  paymentCount: number
  averageGift: number
  largestGift: number
}

export type CampaignAnalyticsEntry = {
  campaign: CampaignRow
  metrics: CampaignMetrics
}

export type CampaignRecentActivity = {
  recentDonations: CampaignPaymentRow[]
  recentPledges: CampaignPledgeRow[]
  recentPledgePayments: CampaignPaymentRow[]
}

export type CampaignDonorSummary = {
  donorId: string | null
  donorType: string | null
  contactId: string | null
  displayName: string
  totalGiven: number
}

export type CampaignLargestGift = {
  amount: number
  donorId: string | null
  donorType: string | null
  contactId: string | null
  displayName: string
}

export type CampaignDonorInsights = {
  donors: CampaignDonorSummary[]
  largestGift: CampaignLargestGift | null
}

export function isActivePledgeStatus(status: string | null | undefined): boolean {
  return String(status || "").toLowerCase() !== "cancelled"
}

export function isVoidedPayment(status: string | null | undefined): boolean {
  return String(status || "").toLowerCase() === "voided"
}

export function campaignPaymentNetAmount(payment: CampaignPaymentRow): number {
  if (isVoidedPayment(payment.status)) return 0
  return paymentNetAmount(payment.amount, payment.refunded_amount)
}

export function isCountableCampaignPayment(payment: CampaignPaymentRow): boolean {
  return countsTowardGivingTotals(payment)
}

export function buildPledgeCampaignMap(
  pledges: CampaignPledgeRow[]
): Map<string, string | null | undefined> {
  return new Map(pledges.map((pledge) => [pledge.id, pledge.campaign_id]))
}

export function resolvePaymentCampaignId(
  payment: CampaignPaymentRow,
  pledgeCampaignById: Map<string, string | null | undefined>
): string | null {
  if (payment.campaign_id) return payment.campaign_id
  if (payment.pledge_id) {
    return pledgeCampaignById.get(payment.pledge_id) ?? null
  }
  return null
}

export function filterPaymentsForCampaign(
  campaignId: string,
  payments: CampaignPaymentRow[],
  pledgeCampaignById: Map<string, string | null | undefined>
): CampaignPaymentRow[] {
  return payments.filter((payment) => {
    const resolved = resolvePaymentCampaignId(payment, pledgeCampaignById)
    return resolved === campaignId && isCountableCampaignPayment(payment)
  })
}

export function filterPledgesForCampaign(
  campaignId: string,
  pledges: CampaignPledgeRow[]
): CampaignPledgeRow[] {
  return pledges.filter(
    (pledge) =>
      pledge.campaign_id === campaignId && isActivePledgeStatus(pledge.calculated_status)
  )
}

export function computeCampaignMetrics(
  campaignId: string,
  goalAmount: number | null | undefined,
  pledges: CampaignPledgeRow[],
  payments: CampaignPaymentRow[],
  pledgeCampaignById: Map<string, string | null | undefined>
): CampaignMetrics {
  const campaignPledges = filterPledgesForCampaign(campaignId, pledges)
  const campaignPledgeIds = new Set(campaignPledges.map((pledge) => pledge.id))
  const campaignPayments = filterPaymentsForCampaign(
    campaignId,
    payments,
    pledgeCampaignById
  )

  const raised = campaignPayments.reduce(
    (sum, payment) => sum + campaignPaymentNetAmount(payment),
    0
  )
  const pledged = campaignPledges.reduce(
    (sum, pledge) => sum + Number(pledge.amount_pledged || 0),
    0
  )
  const collectedAgainstPledges = campaignPayments
    .filter((payment) => payment.pledge_id && campaignPledgeIds.has(payment.pledge_id))
    .reduce((sum, payment) => sum + campaignPaymentNetAmount(payment), 0)
  const outstanding = campaignPledges.reduce(
    (sum, pledge) => sum + Math.max(Number(pledge.balance_remaining || 0), 0),
    0
  )
  const totalCommitted = raised + outstanding

  const goal = Number(goalAmount || 0)
  const progressPercent = goal > 0 ? Math.min((raised / goal) * 100, 100) : null

  const donorKeys = new Set<string>()
  for (const payment of campaignPayments) {
    if (isCampaignBatchDepositPayment(payment)) continue
    if (payment.donor_id) donorKeys.add(`donor:${payment.donor_id}`)
    else if (payment.contact_id) donorKeys.add(`contact:${payment.contact_id}`)
    else if (payment.sender_name) donorKeys.add(`sender:${payment.sender_name}`)
  }
  for (const pledge of campaignPledges) {
    if (pledge.donor_id) donorKeys.add(`donor:${pledge.donor_id}`)
  }

  const paymentCount = campaignPayments.length
  const amounts = campaignPayments.map((payment) => campaignPaymentNetAmount(payment))
  const largestGift = amounts.length ? Math.max(...amounts) : 0
  const averageGift = paymentCount > 0 ? raised / paymentCount : 0

  return {
    campaignId,
    raised,
    pledged,
    collectedAgainstPledges,
    outstanding,
    totalCommitted,
    progressPercent,
    donorCount: donorKeys.size,
    paymentCount,
    averageGift,
    largestGift,
  }
}

const CARD_PAYMENT_CHANNELS = new Set(["stripe", "paypal", "venmo", "zelle"])

export function isCampaignBatchDepositPayment(payment: CampaignPaymentRow): boolean {
  const memo = String(payment.memo || "").toLowerCase()
  if (memo.includes("|square|") || memo.includes("|batch|square|")) return true
  return normalizePaymentSourceChannel(payment.source) === "square"
}

export function classifyCampaignPaymentSource(payment: CampaignPaymentRow): CampaignSourceBucket {
  const memo = String(payment.memo || "").toLowerCase()

  if (memo.includes("|cash|")) return "cash"
  if (memo.includes("|checks|")) return "checks"
  if (isCampaignBatchDepositPayment(payment)) return "square"
  if (memo.includes("|recurring|") || payment.recurring_donation_plan_id) return "ccRecurring"
  if (memo.includes("|one-time|")) return "ccOneTime"
  if (memo.includes("ticket")) return "ticketSales"

  const source = normalizePaymentSourceChannel(payment.source)

  if (source === "cash") return "cash"
  if (source === "check") return "checks"
  if (source === "square") return "square"
  if (CARD_PAYMENT_CHANNELS.has(source)) {
    return payment.recurring_donation_plan_id ? "ccRecurring" : "ccOneTime"
  }

  if (source === "import" || source === "manual" || source === "processor") {
    return "ccOneTime"
  }

  return "other"
}

export function computeCampaignSourceBreakdown(
  campaignId: string,
  goalAmount: number | null | undefined,
  pledges: CampaignPledgeRow[],
  payments: CampaignPaymentRow[],
  pledgeCampaignById: Map<string, string | null | undefined>
): CampaignSourceBreakdown {
  const campaignPayments = filterPaymentsForCampaign(campaignId, payments, pledgeCampaignById)
  const campaignPledges = filterPledgesForCampaign(campaignId, pledges)

  const buckets: Record<CampaignSourceBucket, number> = {
    cash: 0,
    checks: 0,
    square: 0,
    ccOneTime: 0,
    ccRecurring: 0,
    ticketSales: 0,
    other: 0,
  }

  for (const payment of campaignPayments) {
    const amount = campaignPaymentNetAmount(payment)
    if (amount <= 0) continue
    buckets[classifyCampaignPaymentSource(payment)] += amount
  }

  const collected =
    buckets.cash +
    buckets.checks +
    buckets.square +
    buckets.ccOneTime +
    buckets.ccRecurring +
    buckets.ticketSales +
    buckets.other

  const remainingPledges = campaignPledges.reduce(
    (sum, pledge) => sum + Math.max(Number(pledge.balance_remaining || 0), 0),
    0
  )
  const totalRaised = collected + remainingPledges
  const target = Number(goalAmount || 0) > 0 ? Number(goalAmount) : null
  const percentRemaining = totalRaised > 0 ? (remainingPledges / totalRaised) * 100 : null

  return {
    cash: buckets.cash,
    checks: buckets.checks,
    square: buckets.square,
    ccOneTime: buckets.ccOneTime,
    ccRecurring: buckets.ccRecurring,
    ticketSales: buckets.ticketSales,
    other: buckets.other,
    collected,
    remainingPledges,
    totalRaised,
    target,
    percentRemaining,
  }
}

export function buildCampaignAnalytics(
  campaigns: CampaignRow[],
  pledges: CampaignPledgeRow[],
  payments: CampaignPaymentRow[]
): CampaignAnalyticsEntry[] {
  const pledgeCampaignById = buildPledgeCampaignMap(pledges)

  return campaigns.map((campaign) => ({
    campaign,
    metrics: computeCampaignMetrics(
      campaign.id,
      campaign.goal_amount,
      pledges,
      payments,
      pledgeCampaignById
    ),
  }))
}

export function getCampaignRecentActivity(
  campaignId: string,
  pledges: CampaignPledgeRow[],
  payments: CampaignPaymentRow[],
  pledgeCampaignById: Map<string, string | null | undefined>,
  limits = { donations: 8, pledges: 8, pledgePayments: 8 }
): CampaignRecentActivity {
  const campaignPledges = filterPledgesForCampaign(campaignId, pledges)
  const campaignPledgeIds = new Set(campaignPledges.map((pledge) => pledge.id))
  const campaignPayments = filterPaymentsForCampaign(
    campaignId,
    payments,
    pledgeCampaignById
  )

  const sortByDateDesc = <T extends { payment_date?: string | null; pledge_date?: string | null }>(
    rows: T[],
    field: "payment_date" | "pledge_date"
  ) =>
    [...rows].sort(
      (a, b) =>
        new Date(String(b[field] || 0)).getTime() - new Date(String(a[field] || 0)).getTime()
    )

  const recentPledges = sortByDateDesc(campaignPledges, "pledge_date").slice(0, limits.pledges)
  const recentPledgePayments = sortByDateDesc(
    campaignPayments.filter(
      (payment) => payment.pledge_id && campaignPledgeIds.has(payment.pledge_id)
    ),
    "payment_date"
  ).slice(0, limits.pledgePayments)
  const recentDonations = sortByDateDesc(
    campaignPayments.filter((payment) => !payment.pledge_id),
    "payment_date"
  ).slice(0, limits.donations)

  return {
    recentDonations,
    recentPledges,
    recentPledgePayments,
  }
}

type DonorMetaRow = {
  full_name: string | null
  donor_type: string | null
  contact_id: string | null
}

export function buildCampaignDonorInsights(
  campaignId: string,
  pledges: CampaignPledgeRow[],
  payments: CampaignPaymentRow[],
  pledgeCampaignById: Map<string, string | null | undefined>,
  donorMeta: Map<string, DonorMetaRow>
): CampaignDonorInsights {
  const campaignPayments = filterPaymentsForCampaign(campaignId, payments, pledgeCampaignById)
  const campaignPledges = filterPledgesForCampaign(campaignId, pledges)

  const donorTotals = new Map<
    string,
    {
      donorId: string | null
      donorType: string | null
      contactId: string | null
      displayName: string
      totalGiven: number
    }
  >()

  const upsertDonor = (
    key: string,
    entry: {
      donorId: string | null
      donorType: string | null
      contactId: string | null
      displayName: string
    },
    amount: number
  ) => {
    const existing = donorTotals.get(key)
    if (existing) {
      existing.totalGiven += amount
      if (!existing.displayName && entry.displayName) {
        existing.displayName = entry.displayName
      }
      return
    }
    donorTotals.set(key, { ...entry, totalGiven: amount })
  }

  for (const payment of campaignPayments) {
    if (isCampaignBatchDepositPayment(payment)) continue
    const amount = campaignPaymentNetAmount(payment)
    if (payment.donor_id) {
      const meta = donorMeta.get(payment.donor_id)
      upsertDonor(
        `donor:${payment.donor_id}`,
        {
          donorId: payment.donor_id,
          donorType: meta?.donor_type ?? null,
          contactId: meta?.contact_id ?? null,
          displayName: meta?.full_name || payment.sender_name || "Unknown donor",
        },
        amount
      )
      continue
    }

    if (payment.contact_id) {
      upsertDonor(
        `contact:${payment.contact_id}`,
        {
          donorId: null,
          donorType: null,
          contactId: payment.contact_id,
          displayName: payment.sender_name || "Unknown donor",
        },
        amount
      )
      continue
    }

    if (payment.sender_name) {
      upsertDonor(
        `sender:${payment.sender_name}`,
        {
          donorId: null,
          donorType: null,
          contactId: null,
          displayName: payment.sender_name,
        },
        amount
      )
    }
  }

  for (const pledge of campaignPledges) {
    if (!pledge.donor_id) continue
    const key = `donor:${pledge.donor_id}`
    if (donorTotals.has(key)) continue
    const meta = donorMeta.get(pledge.donor_id)
    upsertDonor(
      key,
      {
        donorId: pledge.donor_id,
        donorType: meta?.donor_type ?? null,
        contactId: meta?.contact_id ?? null,
        displayName: meta?.full_name || pledge.donor_name || "Unknown donor",
      },
      0
    )
  }

  const donors = [...donorTotals.values()].sort((a, b) => b.totalGiven - a.totalGiven)

  let largestPayment: CampaignPaymentRow | null = null
  let largestAmount = 0
  for (const payment of campaignPayments) {
    if (isCampaignBatchDepositPayment(payment)) continue
    const amount = campaignPaymentNetAmount(payment)
    if (amount > largestAmount) {
      largestAmount = amount
      largestPayment = payment
    }
  }

  const largestGift =
    largestPayment && largestAmount > 0
      ? (() => {
          const donorId = largestPayment.donor_id ?? null
          const meta = donorId ? donorMeta.get(donorId) : null
          return {
            amount: largestAmount,
            donorId,
            donorType: meta?.donor_type ?? null,
            contactId: meta?.contact_id ?? null,
            displayName: meta?.full_name || largestPayment.sender_name || "Unknown donor",
          } satisfies CampaignLargestGift
        })()
      : null

  return { donors, largestGift }
}

export async function fetchCampaignDonorInsights(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<CampaignDonorInsights> {
  const { pledges, payments, error } = await fetchCampaignAnalyticsData(supabase, organizationId)
  if (error) throw new Error(error)

  const pledgeCampaignById = buildPledgeCampaignMap(pledges)
  const campaignPayments = filterPaymentsForCampaign(campaignId, payments, pledgeCampaignById)
  const campaignPledges = filterPledgesForCampaign(campaignId, pledges)

  const donorIds = new Set<string>()
  for (const payment of campaignPayments) {
    if (payment.donor_id) donorIds.add(payment.donor_id)
  }
  for (const pledge of campaignPledges) {
    if (pledge.donor_id) donorIds.add(pledge.donor_id)
  }

  const donorMeta = new Map<string, DonorMetaRow>()
  if (donorIds.size > 0) {
    const { data: donorRows, error: donorError } = await supabase
      .from("donors")
      .select("id, full_name, donor_type, contact_id")
      .eq("organization_id", organizationId)
      .in("id", [...donorIds])

    if (donorError) throw new Error(donorError.message)

    for (const row of donorRows || []) {
      donorMeta.set(row.id as string, {
        full_name: row.full_name as string | null,
        donor_type: row.donor_type as string | null,
        contact_id: row.contact_id as string | null,
      })
    }
  }

  return buildCampaignDonorInsights(
    campaignId,
    pledges,
    payments,
    pledgeCampaignById,
    donorMeta
  )
}

export function formatDonationCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export async function fetchCampaignOutstandingPledges(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<CampaignOutstandingPledgeRow[]> {
  const pageSize = 1000
  let from = 0
  const pledges: CampaignOutstandingPledgeRow[] = []

  while (true) {
    const { data, error } = await supabase
      .from("pledge_status_view")
      .select(
        "id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
      )
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .neq("calculated_status", "cancelled")
      .gt("balance_remaining", 0)
      .order("balance_remaining", { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)

    const rows = data || []
    for (const row of rows) {
      pledges.push({
        id: row.id,
        donorId: row.donor_id ?? null,
        contactId: null,
        donorName: row.donor_name || "Unknown Donor",
        amountPledged: Number(row.amount_pledged || 0),
        amountPaid: Number(row.amount_paid || 0),
        balanceRemaining: Number(row.balance_remaining || 0),
        status: row.calculated_status || "open",
        pledgeDate: row.pledge_date ?? null,
      })
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  const donorIds = Array.from(
    new Set(pledges.map((pledge) => pledge.donorId).filter(Boolean))
  ) as string[]

  if (donorIds.length > 0) {
    const { data: donorRows } = await supabase
      .from("donors")
      .select("id, contact_id")
      .eq("organization_id", organizationId)
      .in("id", donorIds)

    const contactByDonor = new Map(
      (donorRows || []).map((row) => [row.id as string, (row.contact_id as string | null) ?? null])
    )

    for (const pledge of pledges) {
      if (pledge.donorId) {
        pledge.contactId = contactByDonor.get(pledge.donorId) ?? null
      }
    }
  }

  return pledges
}

export function formatCampaignStatusLabel(status: string | null | undefined): string {
  if (!status) return "Draft"
  const normalized = status.toLowerCase()
  if (normalized === "active") return "Active"
  if (normalized === "completed") return "Completed"
  if (normalized === "paused") return "Paused"
  if (normalized === "draft") return "Draft"
  return status
}

type RpcCampaignMetricsRow = {
  campaign_id: string
  raised: number | string | null
  pledged: number | string | null
  collected_against_pledges: number | string | null
  outstanding: number | string | null
  total_committed: number | string | null
  progress_percent: number | string | null
  donor_count: number | string | null
  payment_count: number | string | null
  average_gift: number | string | null
  largest_gift: number | string | null
}

export type OrgReportsOverview = {
  totalDonations: number
  paymentCount: number
  averageDonation: number
  donorCount: number
}

export type DonorTaxYearTotal = {
  donorId: string
  donorName: string
  donorEmail: string
  totalAmount: number
  paymentCount: number
}

export type RecurringReportSummary = {
  recurringDonorCount: number
  totalRecurringRevenue: number
  byCampaign: Array<{
    campaignId: string | null
    campaignName: string
    total: number
    donorCount: number
  }>
  byDonor: Array<{
    donorId: string
    donorName: string
    total: number
    planCount: number
  }>
}

function mapRpcCampaignMetrics(row: RpcCampaignMetricsRow): CampaignMetrics {
  return {
    campaignId: row.campaign_id,
    raised: Number(row.raised || 0),
    pledged: Number(row.pledged || 0),
    collectedAgainstPledges: Number(row.collected_against_pledges || 0),
    outstanding: Number(row.outstanding || 0),
    totalCommitted: Number(row.total_committed || 0),
    progressPercent:
      row.progress_percent == null ? null : Number(row.progress_percent),
    donorCount: Number(row.donor_count || 0),
    paymentCount: Number(row.payment_count || 0),
    averageGift: Number(row.average_gift || 0),
    largestGift: Number(row.largest_gift || 0),
  }
}

export async function fetchCampaignAnalyticsEntries(
  supabase: SupabaseClient,
  organizationId: string
): Promise<CampaignAnalyticsEntry[]> {
  const [campaignsResult, metricsResult] = await Promise.all([
    supabase
      .from("campaigns")
      .select(
        "id, organization_id, name, code, description, goal_amount, start_date, end_date, status, created_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase.rpc("donation_campaign_metrics", { p_org_id: organizationId }),
  ])

  if (campaignsResult.error) throw new Error(campaignsResult.error.message)
  if (metricsResult.error) throw new Error(metricsResult.error.message)

  const metricsByCampaignId = new Map(
    ((metricsResult.data || []) as RpcCampaignMetricsRow[]).map((row) => [
      row.campaign_id,
      mapRpcCampaignMetrics(row),
    ])
  )

  return ((campaignsResult.data || []) as CampaignRow[]).map((campaign) => ({
    campaign,
    metrics:
      metricsByCampaignId.get(campaign.id) ||
      mapRpcCampaignMetrics({
        campaign_id: campaign.id,
        raised: 0,
        pledged: 0,
        collected_against_pledges: 0,
        outstanding: 0,
        total_committed: 0,
        progress_percent: null,
        donor_count: 0,
        payment_count: 0,
        average_gift: 0,
        largest_gift: 0,
      }),
  }))
}

export async function fetchCampaignRecentActivity(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string,
  limit = 8
): Promise<CampaignRecentActivity> {
  const { data, error } = await supabase.rpc("donation_campaign_recent_activity", {
    p_org_id: organizationId,
    p_campaign_id: campaignId,
    p_limit: limit,
  })

  if (error) throw new Error(error.message)

  const payload = (data || {}) as {
    recentDonations?: CampaignPaymentRow[]
    recentPledges?: CampaignPledgeRow[]
    recentPledgePayments?: CampaignPaymentRow[]
  }

  return {
    recentDonations: payload.recentDonations || [],
    recentPledges: payload.recentPledges || [],
    recentPledgePayments: payload.recentPledgePayments || [],
  }
}

export async function fetchOrgReportsOverview(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrgReportsOverview> {
  const { data, error } = await supabase.rpc("donation_org_reports_overview", {
    p_org_id: organizationId,
  })

  if (error) throw new Error(error.message)

  const row = Array.isArray(data) ? data[0] : data
  return {
    totalDonations: Number(row?.total_donations || 0),
    paymentCount: Number(row?.payment_count || 0),
    averageDonation: Number(row?.average_donation || 0),
    donorCount: Number(row?.donor_count || 0),
  }
}

export function mergeDonorTaxYearTotals(rows: DonorTaxYearTotal[]): DonorTaxYearTotal[] {
  const byDonorId = new Map<string, DonorTaxYearTotal>()

  for (const row of rows) {
    const existing = byDonorId.get(row.donorId)
    if (!existing) {
      byDonorId.set(row.donorId, { ...row })
      continue
    }

    existing.totalAmount += row.totalAmount
    existing.paymentCount += row.paymentCount
    if (!existing.donorEmail && row.donorEmail) {
      existing.donorEmail = row.donorEmail
    }
    if (
      (existing.donorName === "Unknown" || !existing.donorName) &&
      row.donorName &&
      row.donorName !== "Unknown"
    ) {
      existing.donorName = row.donorName
    }
  }

  return [...byDonorId.values()].sort((a, b) => b.totalAmount - a.totalAmount)
}

export async function fetchDonorTaxYearTotals(
  supabase: SupabaseClient,
  organizationId: string,
  taxYear: number
): Promise<DonorTaxYearTotal[]> {
  const { data, error } = await supabase.rpc("donation_donor_tax_year_totals", {
    p_org_id: organizationId,
    p_tax_year: taxYear,
  })

  if (error) throw new Error(error.message)

  const rows = (data || []).map((row: any) => ({
    donorId: row.donor_id as string,
    donorName: row.donor_name || "Unknown",
    donorEmail: row.donor_email || "",
    totalAmount: Number(row.total_amount || 0),
    paymentCount: Number(row.payment_count || 0),
  }))

  return mergeDonorTaxYearTotals(rows)
}

export async function fetchRecurringReportSummary(
  supabase: SupabaseClient,
  organizationId: string
): Promise<RecurringReportSummary> {
  const { data, error } = await supabase.rpc("donation_recurring_report_summary", {
    p_org_id: organizationId,
  })

  if (error) throw new Error(error.message)

  const payload = (data || {}) as {
    recurringDonorCount?: number | string
    totalRecurringRevenue?: number | string
    byCampaign?: Array<{
      campaignId: string | null
      campaignName: string
      total: number | string
      donorCount: number | string
    }>
    byDonor?: Array<{
      donorId: string
      donorName: string
      total: number | string
      planCount: number | string
    }>
  }

  return {
    recurringDonorCount: Number(payload.recurringDonorCount || 0),
    totalRecurringRevenue: Number(payload.totalRecurringRevenue || 0),
    byCampaign: (payload.byCampaign || []).map((row) => ({
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      total: Number(row.total || 0),
      donorCount: Number(row.donorCount || 0),
    })),
    byDonor: (payload.byDonor || []).map((row) => ({
      donorId: row.donorId,
      donorName: row.donorName,
      total: Number(row.total || 0),
      planCount: Number(row.planCount || 0),
    })),
  }
}

/** @deprecated Use fetchCampaignAnalyticsEntries for production paths. Kept for parity validation. */
export async function fetchCampaignAnalyticsData(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{
  campaigns: CampaignRow[]
  pledges: CampaignPledgeRow[]
  payments: CampaignPaymentRow[]
  error: string | null
}> {
  const [campaignsResult, pledgesResult, paymentsResult] = await Promise.all([
    supabase
      .from("campaigns")
      .select(
        "id, organization_id, name, code, description, goal_amount, start_date, end_date, status, created_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("pledge_status_view")
      .select(
        "id, campaign_id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
      )
      .eq("organization_id", organizationId),
    supabase
      .from("payments")
      .select(
        "id, campaign_id, pledge_id, donor_id, contact_id, sender_name, amount, refunded_amount, payment_date, source, status, memo, recurring_donation_plan_id"
      )
      .eq("organization_id", organizationId)
      .order("payment_date", { ascending: false }),
  ])

  const error =
    campaignsResult.error?.message ||
    pledgesResult.error?.message ||
    paymentsResult.error?.message ||
    null

  return {
    campaigns: (campaignsResult.data || []) as CampaignRow[],
    pledges: (pledgesResult.data || []) as CampaignPledgeRow[],
    payments: (paymentsResult.data || []) as CampaignPaymentRow[],
    error,
  }
}
