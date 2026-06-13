import type { SupabaseClient } from "@supabase/supabase-js"

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

export type CampaignPaymentRow = {
  id: string
  campaign_id?: string | null
  pledge_id?: string | null
  donor_id?: string | null
  contact_id?: string | null
  sender_name?: string | null
  amount?: number | null
  payment_date?: string | null
  source?: string | null
  status?: string | null
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

export function isActivePledgeStatus(status: string | null | undefined): boolean {
  return String(status || "").toLowerCase() !== "cancelled"
}

export function isVoidedPayment(status: string | null | undefined): boolean {
  return String(status || "").toLowerCase() === "voided"
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
    return resolved === campaignId && !isVoidedPayment(payment.status)
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

  const raised = campaignPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const pledged = campaignPledges.reduce(
    (sum, pledge) => sum + Number(pledge.amount_pledged || 0),
    0
  )
  const collectedAgainstPledges = campaignPayments
    .filter((payment) => payment.pledge_id && campaignPledgeIds.has(payment.pledge_id))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const outstanding = campaignPledges.reduce(
    (sum, pledge) => sum + Math.max(Number(pledge.balance_remaining || 0), 0),
    0
  )
  const totalCommitted = raised + outstanding

  const goal = Number(goalAmount || 0)
  const progressPercent = goal > 0 ? Math.min((raised / goal) * 100, 100) : null

  const donorKeys = new Set<string>()
  for (const payment of campaignPayments) {
    if (payment.donor_id) donorKeys.add(`donor:${payment.donor_id}`)
    else if (payment.contact_id) donorKeys.add(`contact:${payment.contact_id}`)
    else if (payment.sender_name) donorKeys.add(`sender:${payment.sender_name}`)
  }
  for (const pledge of campaignPledges) {
    if (pledge.donor_id) donorKeys.add(`donor:${pledge.donor_id}`)
  }

  const paymentCount = campaignPayments.length
  const amounts = campaignPayments.map((payment) => Number(payment.amount || 0))
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

export function formatDonationCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
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
        "id, campaign_id, pledge_id, donor_id, contact_id, sender_name, amount, payment_date, source, status"
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
