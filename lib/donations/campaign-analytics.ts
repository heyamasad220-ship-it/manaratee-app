import type { SupabaseClient } from "@supabase/supabase-js"

import {
  attachPledgeDonorContext,
  emptyPledgeDonorContext,
  type PledgeDonorContextFields,
} from "@/lib/donations/pledge-donor-context"
import type { CampaignPhaseMetrics } from "@/lib/donations/campaign-phase-types"
import type { CampaignAskLevelMetrics } from "@/lib/donations/campaign-ask-level-types"
import { askLevelTargetValue } from "@/lib/donations/campaign-ask-level-types"
import { countsTowardGivingTotals, paymentNetAmount } from "@/lib/donations/payment-net-amount"
import { normalizePaymentSourceChannel } from "@/lib/donations/payment-source-channel"
import {
  monthlyEquivalentAmount,
  RECURRING_FREQUENCIES,
  type RecurringFrequency,
} from "@/lib/donations/recurring-donation-types"

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
  goal_breakdown_enabled?: boolean | null
}

export type CampaignPledgeRow = {
  id: string
  campaign_id?: string | null
  campaign_phase_id?: string | null
  campaign_group_id?: string | null
  ask_level_id?: string | null
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
} & PledgeDonorContextFields

export type CampaignPaymentRow = {
  id: string
  campaign_id?: string | null
  campaign_phase_id?: string | null
  campaign_group_id?: string | null
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

export type CampaignRecurringPlanRow = {
  id: string
  donor_id: string | null
  contact_id: string | null
  donor_name: string
  amount: number
  frequency: string
  status: string
  start_date: string | null
  next_payment_date: string | null
  payments_made: number | null
  total_payments: number | null
}

/** Square dinner import stores Recurring Type in memo part 4 and remarks after part 6. */
export function isRecurringCampaignPayment(payment: CampaignPaymentRow): boolean {
  if (payment.recurring_donation_plan_id) return true
  const memo = String(payment.memo || "")
  if (/\|MONTHLY\|/i.test(memo) || /\|recurring\|/i.test(memo)) return true
  const remarks = memo.split("|").slice(6).join("|")
  return /\bmonthly\b/i.test(remarks)
}

export function campaignPaymentTypeLabel(payment: CampaignPaymentRow): string {
  return isRecurringCampaignPayment(payment) ? "Recurring" : "One-Time"
}

const LIVE_RECURRING_PLAN_STATUSES = new Set(["active", "past_due"])

export type CampaignDonationKpis = {
  oneTimeTotal: number
  oneTimeCount: number
  recurringCount: number
  monthlyRecurringAmount: number
  donorCount: number
}

function asRecurringFrequency(frequency: string): RecurringFrequency {
  return (RECURRING_FREQUENCIES as readonly string[]).includes(frequency)
    ? (frequency as RecurringFrequency)
    : "monthly"
}

function isLiveRecurringPlan(plan: CampaignRecurringPlanRow): boolean {
  return LIVE_RECURRING_PLAN_STATUSES.has(String(plan.status || "").toLowerCase())
}

function campaignDonorKey(row: {
  donor_id?: string | null
  contact_id?: string | null
  sender_name?: string | null
  donor_name?: string | null
}): string | null {
  if (row.donor_id) return `donor:${row.donor_id}`
  if (row.contact_id) return `contact:${row.contact_id}`
  const name = String(row.sender_name || row.donor_name || "")
    .trim()
    .toLowerCase()
  return name ? `name:${name}` : null
}

export function computeCampaignDonationKpis(
  payments: CampaignPaymentRow[],
  recurringPlans: CampaignRecurringPlanRow[]
): CampaignDonationKpis {
  const countablePayments = payments.filter((payment) => isCountableCampaignPayment(payment))
  const oneTimePayments = countablePayments.filter((payment) => !isRecurringCampaignPayment(payment))
  const livePlans = recurringPlans.filter((plan) => isLiveRecurringPlan(plan))

  const donorKeys = new Set<string>()
  for (const payment of countablePayments) {
    const key = campaignDonorKey(payment)
    if (key) donorKeys.add(key)
  }
  for (const plan of livePlans) {
    const key = campaignDonorKey(plan)
    if (key) donorKeys.add(key)
  }

  return {
    oneTimeTotal: oneTimePayments.reduce(
      (sum, payment) => sum + campaignPaymentNetAmount(payment),
      0
    ),
    oneTimeCount: oneTimePayments.length,
    recurringCount: livePlans.length,
    monthlyRecurringAmount: livePlans.reduce(
      (sum, plan) =>
        sum + monthlyEquivalentAmount(plan.amount, asRecurringFrequency(plan.frequency)),
      0
    ),
    donorCount: donorKeys.size,
  }
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
  return countsTowardGivingTotals({
    amount: payment.amount,
    refunded_amount: payment.refunded_amount,
    status: payment.status,
  })
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

/**
 * Campaign Goal / Campaign Performance headline math.
 * Committed = valid pledges. Collected = all campaign payments.
 * Outstanding = committed minus collected (never below zero).
 * Unpaid pledge balances stay on `metrics.outstanding` for the open-pledges table.
 */
export function computeCampaignHeadlineTotals(metrics: {
  pledged: number
  raised: number
}) {
  const committed = Number(metrics.pledged || 0)
  const collected = Number(metrics.raised || 0)
  return {
    committed,
    collected,
    outstanding: Math.max(committed - collected, 0),
  }
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
  if (isRecurringCampaignPayment(payment)) return "ccRecurring"
  if (memo.includes("|one-time|")) return "ccOneTime"
  if (memo.includes("ticket")) return "ticketSales"

  const source = normalizePaymentSourceChannel(payment.source)

  if (source === "cash") return "cash"
  if (source === "check") return "checks"
  if (source === "square") return "square"
  if (CARD_PAYMENT_CHANNELS.has(source)) {
    return isRecurringCampaignPayment(payment) ? "ccRecurring" : "ccOneTime"
  }

  if (source === "import" || source === "manual" || source === "processor") {
    return "ccOneTime"
  }

  return "other"
}

/**
 * Resolve which campaign phase a payment belongs to without double-counting:
 * payment.campaign_phase_id first, else the linked pledge's phase.
 */
export function resolvePaymentCampaignPhaseId(
  payment: CampaignPaymentRow,
  pledgePhaseById: Map<string, string | null | undefined>
): string | null {
  if (payment.campaign_phase_id) return payment.campaign_phase_id
  if (payment.pledge_id) {
    return pledgePhaseById.get(payment.pledge_id) ?? null
  }
  return null
}

export function computeCampaignPhaseMetrics(input: {
  phases: Array<{
    id: string
    name: string
    goal_amount?: number | null
    start_date?: string | null
    deadline?: string | null
    sort_order?: number | null
  }>
  campaignId: string
  pledges: CampaignPledgeRow[]
  payments: CampaignPaymentRow[]
  pledgeCampaignById: Map<string, string | null | undefined>
}): CampaignPhaseMetrics[] {
  const campaignPledges = filterPledgesForCampaign(input.campaignId, input.pledges)
  const campaignPayments = filterPaymentsForCampaign(
    input.campaignId,
    input.payments,
    input.pledgeCampaignById
  )
  const pledgePhaseById = new Map(
    campaignPledges.map((pledge) => [pledge.id, pledge.campaign_phase_id ?? null])
  )

  const sortedPhases = [...input.phases].sort(
    (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
  )

  return sortedPhases.map((phase) => {
    const phasePledges = campaignPledges.filter(
      (pledge) => pledge.campaign_phase_id === phase.id
    )

    const committed = phasePledges.reduce(
      (sum, pledge) => sum + Number(pledge.amount_pledged || 0),
      0
    )
    const outstanding = phasePledges.reduce(
      (sum, pledge) => sum + Math.max(Number(pledge.balance_remaining || 0), 0),
      0
    )

    const collected = campaignPayments
      .filter(
        (payment) => resolvePaymentCampaignPhaseId(payment, pledgePhaseById) === phase.id
      )
      .reduce((sum, payment) => sum + campaignPaymentNetAmount(payment), 0)

    const goalAmount =
      phase.goal_amount == null ? null : Number(phase.goal_amount) || null
    const remainingToGoal =
      goalAmount != null && goalAmount > 0
        ? Math.max(goalAmount - committed, 0)
        : null

    return {
      phaseId: phase.id,
      name: phase.name,
      goalAmount,
      deadline: phase.deadline ?? null,
      startDate: phase.start_date ?? null,
      sortOrder: Number(phase.sort_order || 0),
      committed,
      collected,
      outstanding,
      remainingToGoal,
    }
  })
}

/**
 * Strategy gift-chart metrics.
 * Prospects/Asked stay 0 until campaign_prospects exist.
 * Secured uses ask_level_id when set; otherwise soft-matches amount_pledged ≈ ask_amount
 * within the same campaign (and phase when the ask level has a phase).
 */
export function computeCampaignAskLevelMetrics(input: {
  askLevels: Array<{
    id: string
    ask_amount: number
    target_count: number
    campaign_phase_id?: string | null
    sort_order?: number | null
  }>
  phases: Array<{ id: string; name: string }>
  campaignId: string
  pledges: CampaignPledgeRow[]
  /** Optional prospect stats keyed by ask_level_id (Phase C+). */
  prospectStatsByAskLevelId?: Map<
    string,
    { prospects: number; asked: number }
  >
}): CampaignAskLevelMetrics[] {
  const campaignPledges = filterPledgesForCampaign(input.campaignId, input.pledges)
  const phaseNameById = new Map(input.phases.map((phase) => [phase.id, phase.name]))
  const usedPledgeIds = new Set<string>()

  const sortedLevels = [...input.askLevels].sort(
    (a, b) =>
      Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
      Number(b.ask_amount || 0) - Number(a.ask_amount || 0)
  )

  return sortedLevels.map((level) => {
    const askAmount = Number(level.ask_amount || 0)
    const targetCount = Number(level.target_count || 0)
    const targetValue = askLevelTargetValue(askAmount, targetCount)
    const phaseId = level.campaign_phase_id ?? null

    const linked = campaignPledges.filter(
      (pledge) =>
        pledge.ask_level_id === level.id && !usedPledgeIds.has(pledge.id)
    )

    const softMatched =
      linked.length > 0
        ? []
        : campaignPledges.filter((pledge) => {
            if (usedPledgeIds.has(pledge.id)) return false
            if (pledge.ask_level_id) return false
            if (Math.abs(Number(pledge.amount_pledged || 0) - askAmount) > 0.01) {
              return false
            }
            if (phaseId && pledge.campaign_phase_id && pledge.campaign_phase_id !== phaseId) {
              return false
            }
            return true
          })

    const securedPledges = linked.length > 0 ? linked : softMatched
    for (const pledge of securedPledges) {
      usedPledgeIds.add(pledge.id)
    }

    const securedCount = securedPledges.length
    const amountSecured = securedPledges.reduce(
      (sum, pledge) => sum + Number(pledge.amount_pledged || 0),
      0
    )
    const prospectStats = input.prospectStatsByAskLevelId?.get(level.id)

    return {
      askLevelId: level.id,
      askAmount,
      targetCount,
      targetValue,
      campaignPhaseId: phaseId,
      campaignPhaseName: phaseId ? phaseNameById.get(phaseId) ?? null : null,
      sortOrder: Number(level.sort_order || 0),
      prospects: prospectStats?.prospects ?? 0,
      asked: prospectStats?.asked ?? 0,
      securedCount,
      amountSecured,
      gap: Math.max(targetValue - amountSecured, 0),
    }
  })
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

const CAMPAIGN_LEDGER_PAGE_SIZE = 1000
const PLEDGE_STATUS_SELECT =
  "id, campaign_id, campaign_phase_id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
const PLEDGE_STATUS_SELECT_LEGACY =
  "id, campaign_id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
const PAYMENT_SELECT =
  "id, campaign_id, campaign_phase_id, pledge_id, donor_id, contact_id, sender_name, amount, refunded_amount, payment_date, source, status, memo, recurring_donation_plan_id"
const PAYMENT_SELECT_LEGACY =
  "id, campaign_id, pledge_id, donor_id, contact_id, sender_name, amount, refunded_amount, payment_date, source, status, memo, recurring_donation_plan_id"

function isMissingCampaignPhaseColumnError(error: {
  message?: string
  code?: string
} | null) {
  return Boolean(
    error &&
      (error.code === "42703" || /campaign_phase_id/i.test(error.message || ""))
  )
}

async function fetchPagedRows<T>(
  fetchPage: (
    from: number,
    to: number
  ) => Promise<{ data: T[] | null; error: { message?: string; code?: string } | null }>
): Promise<{ rows: T[]; error: { message?: string; code?: string } | null }> {
  const rows: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await fetchPage(from, from + CAMPAIGN_LEDGER_PAGE_SIZE - 1)
    if (error) return { rows, error }
    const page = data || []
    rows.push(...page)
    if (page.length < CAMPAIGN_LEDGER_PAGE_SIZE) return { rows, error: null }
    from += CAMPAIGN_LEDGER_PAGE_SIZE
  }
}

async function fetchCampaignPledgesForCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<CampaignPledgeRow[]> {
  const fetchWithSelect = (select: string) =>
    fetchPagedRows<CampaignPledgeRow>((from, to) =>
      supabase
        .from("pledge_status_view")
        .select(select)
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .order("pledge_date", { ascending: false })
        .range(from, to)
    )

  const withPhase = await fetchWithSelect(PLEDGE_STATUS_SELECT)
  if (!withPhase.error) return withPhase.rows
  if (!isMissingCampaignPhaseColumnError(withPhase.error)) {
    throw new Error(withPhase.error.message || "Failed to load campaign pledges")
  }
  const legacy = await fetchWithSelect(PLEDGE_STATUS_SELECT_LEGACY)
  if (legacy.error) {
    throw new Error(legacy.error.message || "Failed to load campaign pledges")
  }
  return legacy.rows
}

async function fetchCampaignPaymentsForCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string,
  pledgeIds: string[]
): Promise<CampaignPaymentRow[]> {
  const fetchByCampaign = (select: string) =>
    fetchPagedRows<CampaignPaymentRow>((from, to) =>
      supabase
        .from("payments")
        .select(select)
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .order("payment_date", { ascending: false })
        .range(from, to)
    )

  const fetchUnattributedForPledges = (select: string, chunk: string[]) =>
    fetchPagedRows<CampaignPaymentRow>((from, to) =>
      supabase
        .from("payments")
        .select(select)
        .eq("organization_id", organizationId)
        .in("pledge_id", chunk)
        .is("campaign_id", null)
        .order("payment_date", { ascending: false })
        .range(from, to)
    )

  const mergeUnattributed = async (
    select: string,
    existing: CampaignPaymentRow[],
    extraPledgeIds: string[]
  ) => {
    const rowsById = new Map(existing.map((row) => [row.id, row]))
    const seenPledgeIds = new Set(
      existing
        .map((row) => row.pledge_id)
        .filter((id): id is string => Boolean(id))
    )
    const missingPledgeIds = extraPledgeIds.filter((pledgeId) => !seenPledgeIds.has(pledgeId))

    for (let index = 0; index < missingPledgeIds.length; index += 100) {
      const extra = await fetchUnattributedForPledges(
        select,
        missingPledgeIds.slice(index, index + 100)
      )
      if (extra.error) return extra
      for (const row of extra.rows) {
        rowsById.set(row.id, row)
      }
    }

    return {
      rows: [...rowsById.values()].sort(
        (a, b) =>
          new Date(String(b.payment_date || 0)).getTime() -
          new Date(String(a.payment_date || 0)).getTime()
      ),
      error: null,
    }
  }

  const load = async (select: string) => {
    const byCampaign = await fetchByCampaign(select)
    if (byCampaign.error) return byCampaign
    return mergeUnattributed(select, byCampaign.rows, pledgeIds)
  }

  const withPhase = await load(PAYMENT_SELECT)
  if (!withPhase.error) return withPhase.rows
  if (!isMissingCampaignPhaseColumnError(withPhase.error)) {
    throw new Error(withPhase.error.message || "Failed to load campaign payments")
  }
  const legacy = await load(PAYMENT_SELECT_LEGACY)
  if (legacy.error) {
    throw new Error(legacy.error.message || "Failed to load campaign payments")
  }
  return legacy.rows
}

async function fetchDonorMetaByIds(
  supabase: SupabaseClient,
  organizationId: string,
  donorIds: string[]
): Promise<Map<string, DonorMetaRow>> {
  const donorMeta = new Map<string, DonorMetaRow>()
  if (donorIds.length === 0) return donorMeta

  const { data: donorRows, error: donorError } = await supabase
    .from("donors")
    .select("id, full_name, donor_type, contact_id")
    .eq("organization_id", organizationId)
    .in("id", donorIds)

  if (donorError) throw new Error(donorError.message)

  for (const row of donorRows || []) {
    donorMeta.set(row.id as string, {
      full_name: row.full_name as string | null,
      donor_type: row.donor_type as string | null,
      contact_id: row.contact_id as string | null,
    })
  }
  return donorMeta
}

export async function fetchCampaignScopedLedger(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<{
  pledges: CampaignPledgeRow[]
  payments: CampaignPaymentRow[]
}> {
  const pledges = await fetchCampaignPledgesForCampaign(
    supabase,
    organizationId,
    campaignId
  )
  const payments = await fetchCampaignPaymentsForCampaign(
    supabase,
    organizationId,
    campaignId,
    pledges.map((pledge) => pledge.id)
  )
  return { pledges, payments }
}

function mapPledgeRowToWorkspacePledge(
  row: CampaignPledgeRow,
  contactByDonor: Map<string, string | null>
): CampaignOutstandingPledgeRow {
  return {
    id: row.id,
    donorId: row.donor_id ?? null,
    contactId: row.donor_id ? contactByDonor.get(row.donor_id) ?? null : null,
    donorName: row.donor_name || "Donor",
    amountPledged: Number(row.amount_pledged || 0),
    amountPaid: Number(row.amount_paid || 0),
    balanceRemaining: Number(row.balance_remaining || 0),
    status: String(row.calculated_status || "open"),
    pledgeDate: row.pledge_date ?? null,
    ...emptyPledgeDonorContext(),
  }
}

export type CampaignWorkspaceLedger = {
  pledges: CampaignPledgeRow[]
  payments: CampaignPaymentRow[]
  campaignPledges: CampaignOutstandingPledgeRow[]
  outstandingPledges: CampaignOutstandingPledgeRow[]
  recurringPlans: CampaignRecurringPlanRow[]
  insights: CampaignDonorInsights
  sourceBreakdown: CampaignSourceBreakdown
  metrics: CampaignMetrics
}

export async function fetchCampaignWorkspaceLedger(
  supabase: SupabaseClient,
  campaign: CampaignRow,
  sponsorshipCash: number
): Promise<CampaignWorkspaceLedger> {
  const organizationId = campaign.organization_id
  const campaignId = campaign.id

  const [ledger, planResult] = await Promise.all([
    fetchCampaignScopedLedger(supabase, organizationId, campaignId),
    supabase
      .from("recurring_donation_plans")
      .select(
        "id, donor_id, contact_id, amount, frequency, status, start_date, next_payment_date, payments_made, total_payments"
      )
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .order("start_date", { ascending: false }),
  ])

  const { pledges, payments } = ledger
  if (planResult.error) throw new Error(planResult.error.message)

  const donorIds = new Set<string>()
  for (const payment of payments) {
    if (payment.donor_id) donorIds.add(payment.donor_id)
  }
  for (const pledge of pledges) {
    if (pledge.donor_id) donorIds.add(pledge.donor_id)
  }
  for (const row of planResult.data || []) {
    if (row.donor_id) donorIds.add(row.donor_id as string)
  }

  const donorMeta = await fetchDonorMetaByIds(supabase, organizationId, [...donorIds])
  const contactByDonor = new Map(
    [...donorMeta.entries()].map(([id, meta]) => [id, meta.contact_id])
  )
  const pledgeCampaignById = buildPledgeCampaignMap(pledges)
  const campaignPledges = pledges.map((row) =>
    mapPledgeRowToWorkspacePledge(row, contactByDonor)
  )
  const outstandingPledges = await attachPledgeDonorContext(
    supabase,
    organizationId,
    campaignPledges
      .filter(
        (pledge) =>
          String(pledge.status).toLowerCase() !== "cancelled" &&
          pledge.balanceRemaining > 0
      )
      .sort((a, b) => b.balanceRemaining - a.balanceRemaining)
  )

  const nameByDonorId = new Map<string, string>()
  for (const payment of payments) {
    if (payment.donor_id && payment.sender_name && !nameByDonorId.has(payment.donor_id)) {
      nameByDonorId.set(payment.donor_id, payment.sender_name)
    }
  }
  for (const [id, meta] of donorMeta) {
    if (meta.full_name && !nameByDonorId.has(id)) {
      nameByDonorId.set(id, meta.full_name)
    }
  }

  const recurringPlans: CampaignRecurringPlanRow[] = (planResult.data || []).map((row) => ({
    id: row.id as string,
    donor_id: (row.donor_id as string | null) ?? null,
    contact_id: (row.contact_id as string | null) ?? null,
    donor_name:
      (row.donor_id ? nameByDonorId.get(row.donor_id as string) : null) || "Donor",
    amount: Number(row.amount || 0),
    frequency: String(row.frequency || "monthly"),
    status: String(row.status || "active"),
    start_date: (row.start_date as string | null) ?? null,
    next_payment_date: (row.next_payment_date as string | null) ?? null,
    payments_made: row.payments_made == null ? null : Number(row.payments_made),
    total_payments: row.total_payments == null ? null : Number(row.total_payments),
  }))

  const metrics = computeCampaignMetrics(
    campaignId,
    campaign.goal_amount,
    pledges,
    payments,
    pledgeCampaignById
  )
  if (sponsorshipCash > 0) {
    metrics.totalCommitted += sponsorshipCash
  }

  return {
    pledges,
    payments,
    campaignPledges,
    outstandingPledges,
    recurringPlans,
    insights: buildCampaignDonorInsights(
      campaignId,
      pledges,
      payments,
      pledgeCampaignById,
      donorMeta
    ),
    sourceBreakdown: computeCampaignSourceBreakdown(
      campaignId,
      campaign.goal_amount,
      pledges,
      payments,
      pledgeCampaignById
    ),
    metrics,
  }
}

export async function fetchCampaignDonorInsights(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<CampaignDonorInsights> {
  const { pledges, payments } = await fetchCampaignScopedLedger(
    supabase,
    organizationId,
    campaignId
  )
  const donorIds = new Set<string>()
  for (const payment of payments) {
    if (payment.donor_id) donorIds.add(payment.donor_id)
  }
  for (const pledge of pledges) {
    if (pledge.donor_id) donorIds.add(pledge.donor_id)
  }

  return buildCampaignDonorInsights(
    campaignId,
    pledges,
    payments,
    buildPledgeCampaignMap(pledges),
    await fetchDonorMetaByIds(supabase, organizationId, [...donorIds])
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
        ...emptyPledgeDonorContext(),
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

  return attachPledgeDonorContext(supabase, organizationId, pledges)
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
        "id, campaign_id, campaign_phase_id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
      )
      .eq("organization_id", organizationId),
    supabase
      .from("payments")
      .select(
        "id, campaign_id, campaign_phase_id, pledge_id, donor_id, contact_id, sender_name, amount, refunded_amount, payment_date, source, status, memo, recurring_donation_plan_id"
      )
      .eq("organization_id", organizationId)
      .order("payment_date", { ascending: false }),
  ])

  let pledges = (pledgesResult.data || []) as CampaignPledgeRow[]
  let payments = (paymentsResult.data || []) as CampaignPaymentRow[]
  let pledgesError = pledgesResult.error?.message || null
  let paymentsError = paymentsResult.error?.message || null

  // Graceful fallback before migration 260 / view refresh.
  if (
    pledgesResult.error &&
    (pledgesResult.error.code === "42703" ||
      /campaign_phase_id/i.test(pledgesResult.error.message || ""))
  ) {
    const legacyPledges = await supabase
      .from("pledge_status_view")
      .select(
        "id, campaign_id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
      )
      .eq("organization_id", organizationId)
    pledges = (legacyPledges.data || []) as CampaignPledgeRow[]
    pledgesError = legacyPledges.error?.message || null
  }

  // ask_level_id is on pledges (migration 261), not pledge_status_view yet.
  if (!pledgesError && pledges.length > 0) {
    const ids = pledges.map((pledge) => pledge.id)
    const askLevelResult = await supabase
      .from("pledges")
      .select("id, ask_level_id")
      .eq("organization_id", organizationId)
      .in("id", ids)

    if (!askLevelResult.error && askLevelResult.data) {
      const askById = new Map(
        askLevelResult.data.map((row) => [
          row.id as string,
          (row.ask_level_id as string | null) ?? null,
        ])
      )
      pledges = pledges.map((pledge) => ({
        ...pledge,
        ask_level_id: askById.get(pledge.id) ?? null,
      }))
    }
  }

  if (
    paymentsResult.error &&
    (paymentsResult.error.code === "42703" ||
      /campaign_phase_id/i.test(paymentsResult.error.message || ""))
  ) {
    const legacyPayments = await supabase
      .from("payments")
      .select(
        "id, campaign_id, pledge_id, donor_id, contact_id, sender_name, amount, refunded_amount, payment_date, source, status, memo, recurring_donation_plan_id"
      )
      .eq("organization_id", organizationId)
      .order("payment_date", { ascending: false })
    payments = (legacyPayments.data || []) as CampaignPaymentRow[]
    paymentsError = legacyPayments.error?.message || null
  }

  const error =
    campaignsResult.error?.message || pledgesError || paymentsError || null

  return {
    campaigns: (campaignsResult.data || []) as CampaignRow[],
    pledges,
    payments,
    error,
  }
}
