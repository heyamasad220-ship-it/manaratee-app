"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import { formatFinancialActivityPaymentStatus } from "@/lib/donations/donation-status"
import { formatPaymentSourceLabel } from "@/lib/donations/payment-source-channel"
import { countsTowardGivingTotals, paymentNetAmount } from "@/lib/donations/payment-net-amount"
import { attachPaymentDonorDisplayNames } from "@/lib/donations/payment-donor-display"
import { attachPaymentMethodDisplayLabels } from "@/lib/donations/payment-method-display"

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

export type PaymentStatusDisplayFilter =
  | "Succeeded"
  | "Failed"
  | "Refunded"
  | "Partially Refunded"

export type PaymentTransactionTypeFilter = "all" | "one_time" | "pledge" | "recurring"

export type PaymentsPageInput = {
  page?: number
  pageSize?: number
  search?: string
  donorName?: string
  status?: string
  statusDisplay?: PaymentStatusDisplayFilter | "all"
  dateFrom?: string
  dateTo?: string
  transactionType?: PaymentTransactionTypeFilter
  source?: string
  campaignId?: string
  fundId?: string
  campaignGroupId?: string
}

const PAYMENTS_LIST_SELECT = [
  "id",
  "amount",
  "refunded_amount",
  "payment_date",
  "source",
  "source_type",
  "memo",
  "pledge_id",
  "donor_id",
  "contact_id",
  "status",
  "sender_name",
  "import_batch_id",
  "stripe_payment_intent_id",
  "stripe_charge_id",
  "recurring_donation_plan_id",
  "campaign_id",
  "category_id",
  "subcategory_id",
  "campaign_group_id",
  "donors ( donor_type )",
  "campaigns ( name )",
  "donation_categories ( name )",
  "donation_subcategories ( name )",
  "campaign_groups ( name )",
  "donation_receipts ( status, receipt_type )",
].join(", ")

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function paymentReceiptStatusLabel(
  receipts: Array<{ status?: string | null; receipt_type?: string | null }> | null
): string {
  const paymentReceipt = (receipts || []).find(
    (row) => !row.receipt_type || row.receipt_type === "payment"
  )
  if (!paymentReceipt) return "Missing"
  const status = String(paymentReceipt.status || "").toLowerCase()
  if (status === "sent" || status === "resent") return "Sent"
  if (status === "not_sent") return "Generated"
  if (status === "failed") return "Failed"
  return paymentReceipt.status || "Generated"
}

function applyPaymentStatusDisplayFilter<
  T extends {
    in: (column: string, values: string[]) => T
    eq: (column: string, value: string) => T
    not: (column: string, operator: string, value: string) => T
  },
>(query: T, statusDisplay: PaymentStatusDisplayFilter): T {
  switch (statusDisplay) {
    case "Failed":
      return query.in("status", ["voided", "pending_review", "unresolved"])
    case "Refunded":
      return query.eq("status", "refunded")
    case "Partially Refunded":
      return query.eq("status", "partially_refunded")
    case "Succeeded":
      return query.not(
        "status",
        "in",
        '("voided","pending_review","unresolved","refunded","partially_refunded")'
      )
    default:
      return query
  }
}

async function findDonorIdsByName(
  supabase: SupabaseClient,
  orgId: string,
  name: string
): Promise<string[]> {
  const term = `%${escapeIlike(name.trim())}%`
  const { data: matchingDonors } = await supabase
    .from("donor_summary_view")
    .select("id")
    .eq("organization_id", orgId)
    .ilike("full_name", term)

  return (matchingDonors || []).map((row) => row.id as string).filter(Boolean)
}

function applyPaymentAttributeFilters<
  T extends {
    eq: (column: string, value: string) => T
    is: (column: string, value: null) => T
    not: (column: string, operator: string, value: null) => T
  },
>(query: T, input: PaymentsPageInput): T {
  if (input.transactionType === "pledge") {
    query = query.not("pledge_id", "is", null)
  } else if (input.transactionType === "recurring") {
    query = query.not("recurring_donation_plan_id", "is", null)
  } else if (input.transactionType === "one_time") {
    query = query.is("pledge_id", null).is("recurring_donation_plan_id", null)
  }

  if (input.source && input.source !== "all") {
    query = query.eq("source", input.source)
  }
  if (input.campaignId && input.campaignId !== "all") {
    query = query.eq("campaign_id", input.campaignId)
  }
  if (input.fundId && input.fundId !== "all") {
    query = query.eq("subcategory_id", input.fundId)
  }
  if (input.campaignGroupId && input.campaignGroupId !== "all") {
    query = query.eq("campaign_group_id", input.campaignGroupId)
  }

  return query
}

function mapPaymentListRow(row: Record<string, unknown>) {
  const donor = firstRelated(row.donors as { donor_type?: string | null } | { donor_type?: string | null }[] | null)
  const campaign = firstRelated(row.campaigns as { name?: string | null } | { name?: string | null }[] | null)
  const category = firstRelated(
    row.donation_categories as { name?: string | null } | { name?: string | null }[] | null
  )
  const fund = firstRelated(
    row.donation_subcategories as { name?: string | null } | { name?: string | null }[] | null
  )
  const campaignGroup = firstRelated(
    row.campaign_groups as { name?: string | null } | { name?: string | null }[] | null
  )
  const receiptsRaw = row.donation_receipts as
    | Array<{ status?: string | null; receipt_type?: string | null }>
    | { status?: string | null; receipt_type?: string | null }
    | null
  const receipts = receiptsRaw ? (Array.isArray(receiptsRaw) ? receiptsRaw : [receiptsRaw]) : []

  const {
    donors: _donors,
    campaigns: _campaigns,
    donation_categories: _categories,
    donation_subcategories: _funds,
    campaign_groups: _groups,
    donation_receipts: _receipts,
    ...payment
  } = row

  return {
    ...payment,
    donor_type: donor?.donor_type ?? null,
    campaign_name: campaign?.name ?? null,
    category_name: category?.name ?? null,
    fund_name: fund?.name ?? null,
    campaign_group_name: campaignGroup?.name ?? null,
    receipt_status: paymentReceiptStatusLabel(receipts),
  } as Record<string, unknown> & {
    id?: string
    amount?: number | string | null
    refunded_amount?: number | null
    status?: string | null
    donor_type: string | null
    campaign_name: string | null
    category_name: string | null
    fund_name: string | null
    campaign_group_name: string | null
    receipt_status: string
    source?: string | null
    stripe_payment_intent_id?: string | null
    sender_name?: string | null
    donor_id?: string | null
  }
}

function applyPaymentsListFilters(
  query: any,
  input: PaymentsPageInput,
  matchingDonorIds: string[] = []
) {
  let next = applyPaymentAttributeFilters(query, input)

  if (input.statusDisplay && input.statusDisplay !== "all") {
    next = applyPaymentStatusDisplayFilter(next, input.statusDisplay)
  } else if (input.status && input.status !== "all") {
    next = next.eq("status", input.status)
  }
  if (input.dateFrom) {
    next = next.gte("payment_date", input.dateFrom)
  }
  if (input.dateTo) {
    next = next.lte("payment_date", input.dateTo)
  }

  const nameTerm = input.donorName?.trim() || input.search?.trim() || ""
  if (nameTerm) {
    const term = `%${escapeIlike(nameTerm)}%`
    const searchParts = input.donorName?.trim()
      ? [`sender_name.ilike.${term}`]
      : [`sender_name.ilike.${term}`, `memo.ilike.${term}`, `source.ilike.${term}`]

    if (matchingDonorIds.length > 0) {
      searchParts.push(`donor_id.in.(${matchingDonorIds.join(",")})`)
    }

    next = next.or(searchParts.join(","))
  }

  return next
}

async function matchingDonorIdsForPaymentFilters(
  supabase: SupabaseClient,
  orgId: string,
  input: PaymentsPageInput
) {
  const name = input.donorName?.trim() || input.search?.trim()
  if (!name) return [] as string[]
  return findDonorIdsByName(supabase, orgId, name)
}

export async function fetchPaymentsPageAction(input: PaymentsPageInput = {}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const page = Math.max(1, input.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? DONATIONS_PAGE_SIZE))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query: any = access.supabase
      .from("payments")
      .select(PAYMENTS_LIST_SELECT, { count: "exact" })
      .eq("organization_id", access.orgId)
      .order("payment_date", { ascending: false })

    const matchingDonorIds = await matchingDonorIdsForPaymentFilters(
      access.supabase,
      access.orgId,
      input
    )
    query = applyPaymentsListFilters(query, input, matchingDonorIds)

    const { data, error, count } = await query.range(from, to)

    if (error) return { success: false as const, error: error.message }

    const payments = ((data || []) as Record<string, unknown>[]).map((row) => mapPaymentListRow(row))

    await attachPaymentDonorDisplayNames(access.supabase, access.orgId, payments)
    await attachPaymentMethodDisplayLabels(access.supabase, access.orgId, payments)

    for (const payment of payments) {
      ;(payment as Record<string, unknown>).status_display = formatFinancialActivityPaymentStatus(
        payment as {
          status?: string | null
          amount?: number | null
          refunded_amount?: number | null
        }
      )
    }

    return {
      success: true as const,
      payments,
      total: count ?? 0,
      page,
      pageSize,
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load payments",
    }
  }
}

export type DonationPaymentFilterOptions = {
  sources: Array<{ value: string; label: string }>
  campaigns: Array<{ id: string; name: string }>
  funds: Array<{ id: string; name: string }>
  campaignGroups: Array<{ id: string; name: string }>
}

export async function getDonationPaymentFilterOptionsAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const [sourcesResult, campaignsResult, fundsResult, groupsResult] = await Promise.all([
      access.supabase
        .from("payments")
        .select("source")
        .eq("organization_id", access.orgId)
        .not("source", "is", null)
        .limit(2000),
      access.supabase
        .from("campaigns")
        .select("id, name")
        .eq("organization_id", access.orgId)
        .order("name"),
      access.supabase
        .from("donation_subcategories")
        .select("id, name")
        .eq("organization_id", access.orgId)
        .order("name"),
      access.supabase
        .from("campaign_groups")
        .select("id, name")
        .eq("organization_id", access.orgId)
        .order("name"),
    ])

    const sourceValues = [
      ...new Set(
        (sourcesResult.data || [])
          .map((row) => String(row.source || "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => formatPaymentSourceLabel(a).localeCompare(formatPaymentSourceLabel(b)))

    return {
      success: true as const,
      options: {
        sources: sourceValues.map((value) => ({
          value,
          label: formatPaymentSourceLabel(value),
        })),
        campaigns: (campaignsResult.data || []).map((row) => ({
          id: row.id as string,
          name: String(row.name || "Untitled campaign"),
        })),
        funds: (fundsResult.data || []).map((row) => ({
          id: row.id as string,
          name: String(row.name || "Untitled fund"),
        })),
        campaignGroups: (groupsResult.data || []).map((row) => ({
          id: row.id as string,
          name: String(row.name || "Untitled group"),
        })),
      } satisfies DonationPaymentFilterOptions,
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load filters",
    }
  }
}

export type DonationTransactionsSummary = {
  totalCollected: number
  paymentCount: number
  averageGift: number
  largestGift: number
  donorCount: number
  needsAttentionCount: number
}

const PAYMENTS_SUMMARY_SELECT =
  "id, amount, refunded_amount, status, donor_id, contact_id, sender_name, payment_date, source, pledge_id, recurring_donation_plan_id"

async function fetchFilteredPaymentRows(
  supabase: SupabaseClient,
  orgId: string,
  input: PaymentsPageInput,
  select: string,
  pageSize = 1000
) {
  const rows: Record<string, unknown>[] = []
  let from = 0
  const matchingDonorIds = await matchingDonorIdsForPaymentFilters(supabase, orgId, input)

  while (true) {
    let query: any = supabase
      .from("payments")
      .select(select)
      .eq("organization_id", orgId)
      .order("payment_date", { ascending: false })
      .range(from, from + pageSize - 1)

    query = applyPaymentsListFilters(query, input, matchingDonorIds)
    const { data, error } = await query
    if (error) throw new Error(error.message)

    const batch = (data || []) as Record<string, unknown>[]
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
    if (from > 50000) break
  }

  return rows
}

export async function getDonationTransactionsSummaryAction(input: PaymentsPageInput = {}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const rows = await fetchFilteredPaymentRows(
      access.supabase,
      access.orgId,
      input,
      PAYMENTS_SUMMARY_SELECT
    )

    let totalCollected = 0
    let paymentCount = 0
    let largestGift = 0
    let needsAttentionCount = 0
    const donors = new Set<string>()

    for (const row of rows) {
      const status = String(row.status || "")
      const net = paymentNetAmount(Number(row.amount || 0), Number(row.refunded_amount || 0))
      if (["pending_review", "unresolved", "voided"].includes(status)) {
        needsAttentionCount += 1
      }
      if (!countsTowardGivingTotals({ amount: Number(row.amount || 0), refunded_amount: Number(row.refunded_amount || 0), status })) {
        continue
      }
      totalCollected += net
      paymentCount += 1
      if (net > largestGift) largestGift = net
      if (row.donor_id) donors.add(`donor:${row.donor_id}`)
      else if (row.contact_id) donors.add(`contact:${row.contact_id}`)
      else if (row.sender_name) donors.add(`sender:${String(row.sender_name)}`)
    }

    return {
      success: true as const,
      summary: {
        totalCollected,
        paymentCount,
        averageGift: paymentCount > 0 ? totalCollected / paymentCount : 0,
        largestGift,
        donorCount: donors.size,
        needsAttentionCount,
      } satisfies DonationTransactionsSummary,
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load summary",
    }
  }
}

export type DonationGivingBreakdown = {
  byMonth: Array<{ month: string; amount: number; count: number }>
  byMethod: Array<{ method: string; amount: number; count: number }>
}

export async function getDonationGivingBreakdownAction(input: PaymentsPageInput = {}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const rows = await fetchFilteredPaymentRows(
      access.supabase,
      access.orgId,
      input,
      PAYMENTS_SUMMARY_SELECT
    )

    const monthMap = new Map<string, { amount: number; count: number }>()
    const methodMap = new Map<string, { amount: number; count: number }>()

    for (const row of rows) {
      if (
        !countsTowardGivingTotals({
          amount: Number(row.amount || 0),
          refunded_amount: Number(row.refunded_amount || 0),
          status: String(row.status || ""),
        })
      ) {
        continue
      }

      const net = paymentNetAmount(Number(row.amount || 0), Number(row.refunded_amount || 0))
      const date = String(row.payment_date || "").slice(0, 7)
      const monthKey = date.length === 7 ? date : "Unknown"
      const monthEntry = monthMap.get(monthKey) || { amount: 0, count: 0 }
      monthEntry.amount += net
      monthEntry.count += 1
      monthMap.set(monthKey, monthEntry)

      const method = formatPaymentSourceLabel(String(row.source || "manual"))
      const methodEntry = methodMap.get(method) || { amount: 0, count: 0 }
      methodEntry.amount += net
      methodEntry.count += 1
      methodMap.set(method, methodEntry)
    }

    const byMonth = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        month,
        amount: value.amount,
        count: value.count,
      }))

    const byMethod = [...methodMap.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([method, value]) => ({
        method,
        amount: value.amount,
        count: value.count,
      }))

    return { success: true as const, breakdown: { byMonth, byMethod } satisfies DonationGivingBreakdown }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load giving charts",
    }
  }
}

export async function fetchPaymentsExportAction(input: PaymentsPageInput = {}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const rows = await fetchFilteredPaymentRows(
      access.supabase,
      access.orgId,
      input,
      PAYMENTS_LIST_SELECT,
      500
    )
    const payments = rows.map((row) => mapPaymentListRow(row))
    await attachPaymentDonorDisplayNames(access.supabase, access.orgId, payments)
    await attachPaymentMethodDisplayLabels(access.supabase, access.orgId, payments)

    for (const payment of payments) {
      ;(payment as Record<string, unknown>).status_display = formatFinancialActivityPaymentStatus(
        payment as {
          status?: string | null
          amount?: number | null
          refunded_amount?: number | null
        }
      )
    }

    return { success: true as const, payments }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not export payments",
    }
  }
}

export type PledgesPageInput = {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  campaignId?: string
  minAmountPledged?: number
  sortBy?: "pledge_date" | "donor_name" | "balance_remaining"
  sortAsc?: boolean
}

export type PledgeListFilters = {
  search?: string
  status?: string
  campaignId?: string
  minAmountPledged?: number
}

function applyPledgeListFilters<
  T extends {
    eq: (column: string, value: unknown) => T
    is: (column: string, value: null) => T
    gte: (column: string, value: number) => T
    or: (filters: string) => T
  },
>(query: T, input: PledgeListFilters) {
  if (input.status && input.status !== "all") {
    query = query.eq("calculated_status", input.status)
  }
  if (input.campaignId === "__none__") {
    query = query.is("campaign_id", null)
  } else if (input.campaignId && input.campaignId !== "all") {
    query = query.eq("campaign_id", input.campaignId)
  }
  if (input.minAmountPledged != null && input.minAmountPledged > 0) {
    query = query.gte("amount_pledged", input.minAmountPledged)
  }
  if (input.search?.trim()) {
    const term = `%${escapeIlike(input.search.trim())}%`
    query = query.ilike("donor_name", term)
  }

  return query
}

function hasPledgeListFilters(input: PledgeListFilters) {
  return (
    Boolean(input.search?.trim()) ||
    Boolean(input.status && input.status !== "all") ||
    Boolean(input.campaignId && input.campaignId !== "all") ||
    (input.minAmountPledged != null && input.minAmountPledged > 0)
  )
}

export async function fetchPledgesPageAction(input: PledgesPageInput = {}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? DONATIONS_PAGE_SIZE))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortBy = input.sortBy ?? "pledge_date"
  const sortAsc = input.sortAsc ?? false

  let query = access.supabase
    .from("pledge_status_view")
    .select(
      "id, organization_id, donor_id, donor_name, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date, frequency, status, installment_amount, total_payments, first_payment_date, next_payment_date",
      { count: "exact" }
    )
    .eq("organization_id", access.orgId)
    .order(sortBy, { ascending: sortAsc })

  query = applyPledgeListFilters(query, input)

  const { data, error, count } = await query.range(from, to)

  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    pledges: data || [],
    total: count ?? 0,
    page,
    pageSize,
  }
}

export async function fetchPledgeLastPaymentDatesAction(pledgeIds: string[]) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const uniqueIds = [...new Set(pledgeIds.filter(Boolean))]
  if (uniqueIds.length === 0) {
    return { success: true as const, lastPaymentByPledgeId: {} as Record<string, string> }
  }

  const { data, error } = await access.supabase
    .from("payments")
    .select("pledge_id, payment_date, amount, refunded_amount, status")
    .eq("organization_id", access.orgId)
    .in("pledge_id", uniqueIds)
    .order("payment_date", { ascending: false })

  if (error) return { success: false as const, error: error.message }

  const lastPaymentByPledgeId: Record<string, string> = {}
  for (const row of data || []) {
    const pledgeId = String(row.pledge_id || "")
    if (!pledgeId || lastPaymentByPledgeId[pledgeId]) continue
    if (!countsTowardGivingTotals(row)) continue
    if (row.payment_date) lastPaymentByPledgeId[pledgeId] = String(row.payment_date)
  }

  return { success: true as const, lastPaymentByPledgeId }
}

export type PledgeSummaryMetricsInput = PledgeListFilters

async function aggregatePledgeSummaryMetrics(
  supabase: SupabaseClient,
  orgId: string,
  input: PledgeListFilters
) {
  const metrics = {
    totalPledged: 0,
    totalCollected: 0,
    outstandingBalance: 0,
    activePledgeCount: 0,
    pledgeCount: 0,
  }

  const statusFilter = input.status && input.status !== "all" ? input.status : null
  const pageSize = 1000
  let from = 0

  while (true) {
    let query = supabase
      .from("pledge_status_view")
      .select("amount_pledged, amount_paid, balance_remaining, calculated_status")
      .eq("organization_id", orgId)
      .neq("calculated_status", "cancelled")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    query = applyPledgeListFilters(query, input)

    const { data, error } = await query
    if (error) return { error: error.message as string }

    const rows = data || []
    if (rows.length === 0) break

    for (const row of rows) {
      metrics.totalPledged += Number(row.amount_pledged || 0)
      metrics.totalCollected += Number(row.amount_paid || 0)
      metrics.outstandingBalance += Number(row.balance_remaining || 0)
      metrics.pledgeCount += 1

      if (statusFilter) {
        metrics.activePledgeCount += 1
      } else {
        const status = String(row.calculated_status || "").toLowerCase()
        if (status === "open" || status === "partial") {
          metrics.activePledgeCount += 1
        }
      }
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return { metrics }
}

export async function fetchPledgeSummaryMetricsAction(input: PledgeSummaryMetricsInput = {}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  if (!hasPledgeListFilters(input)) {
    const { data, error } = await access.supabase.rpc("donation_org_pledge_summary", {
      p_org_id: access.orgId,
    })

    if (error) return { success: false as const, error: error.message }

    const row = Array.isArray(data) ? data[0] : data
    const activePledgeCount = Number(row?.active_pledge_count || 0)
    return {
      success: true as const,
      metrics: {
        totalPledged: Number(row?.total_pledged || 0),
        totalCollected: Number(row?.total_collected || 0),
        outstandingBalance: Number(row?.outstanding_balance || 0),
        activePledgeCount,
        pledgeCount: activePledgeCount,
      },
    }
  }

  const result = await aggregatePledgeSummaryMetrics(access.supabase, access.orgId, input)
  if ("error" in result && result.error) {
    return { success: false as const, error: result.error }
  }

  return {
    success: true as const,
    metrics: result.metrics!,
  }
}

export type DonorPledgeFilter = "all" | "open_pledge" | "no_open_pledge"

export type DonorReportPledgeStatusFilter =
  | "all"
  | "open"
  | "partial"
  | "fulfilled"
  | "none"

export type DonorReportLastGiftFilter =
  | "all"
  | "active_12m"
  | "lapsed_12m"
  | "lapsed_24m"
  | "never"

export type DonorsPageInput = {
  page?: number
  pageSize?: number
  search?: string
  donorName?: string
  email?: string
  phone?: string
  pledgeFilter?: DonorPledgeFilter
  pledgeStatus?: DonorReportPledgeStatusFilter
  lastGiftFilter?: DonorReportLastGiftFilter
  minTotalGiven?: number
  dateFrom?: string
  dateTo?: string
  sortBy?: "full_name" | "total_donations" | "last_donation_date" | "outstanding_pledge_balance"
  sortAsc?: boolean
}

export type DonorSummaryReportRow = {
  id: string
  contact_id: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  donor_type: string | null
  total_donations: number
  donation_count: number
  last_donation_date: string | null
  lifetime_last_donation_date: string | null
  pledge_status: string | null
  has_open_pledge: boolean
  outstanding_pledge_balance: number
}

export type HouseholdGivingReportRow = {
  family_id: string
  family_name: string
  primary_contact_id: string | null
  primary_name: string
  primary_email: string | null
  primary_phone: string | null
  member_count: number
  total_donations: number
  donation_count: number
  last_donation_date: string | null
  pledge_status: string | null
  outstanding_pledge_balance: number
}

export type GroupGivingReportRow = {
  group_contact_id: string
  group_name: string
  primary_contact_name: string | null
  member_count: number
  group_gifts_total: number
  member_gifts_total: number
  total_donations: number
  donation_count: number
  last_donation_date: string | null
  pledge_status: string | null
  outstanding_pledge_balance: number
}

export type DonorSummaryReportFilters = Pick<
  DonorsPageInput,
  | "search"
  | "donorName"
  | "email"
  | "phone"
  | "pledgeFilter"
  | "pledgeStatus"
  | "lastGiftFilter"
  | "minTotalGiven"
  | "dateFrom"
  | "dateTo"
  | "sortBy"
  | "sortAsc"
>

type DonorGivingReportRpcRow = {
  id: string
  contact_id: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  donor_type: string | null
  total_donations: number | string | null
  donation_count: number | string | null
  last_donation_date: string | null
  lifetime_last_donation_date: string | null
  pledge_status: string | null
  has_open_pledge: boolean | null
  outstanding_pledge_balance: number | string | null
  total_count: number | string | null
}

function mapDonorGivingReportRow(row: DonorGivingReportRpcRow): DonorSummaryReportRow {
  return {
    id: row.id,
    contact_id: row.contact_id ?? null,
    full_name: row.full_name,
    email: row.email ?? null,
    phone: row.phone,
    donor_type: row.donor_type,
    total_donations: Number(row.total_donations || 0),
    donation_count: Number(row.donation_count || 0),
    last_donation_date: row.last_donation_date,
    lifetime_last_donation_date: row.lifetime_last_donation_date,
    pledge_status: row.pledge_status ?? (row.has_open_pledge ? "Open" : null),
    has_open_pledge: Boolean(row.has_open_pledge),
    outstanding_pledge_balance: Number(row.outstanding_pledge_balance || 0),
  }
}

function buildDonorGivingReportFilterParams(
  orgId: string,
  input: Pick<
    DonorSummaryReportFilters,
    | "search"
    | "donorName"
    | "email"
    | "phone"
    | "pledgeFilter"
    | "pledgeStatus"
    | "lastGiftFilter"
    | "minTotalGiven"
    | "dateFrom"
    | "dateTo"
  >
) {
  const pledgeStatus =
    input.pledgeStatus && input.pledgeStatus !== "all" ? input.pledgeStatus : null
  const lastGiftFilter =
    input.lastGiftFilter && input.lastGiftFilter !== "all" ? input.lastGiftFilter : null

  return {
    p_org_id: orgId,
    p_date_from: input.dateFrom || null,
    p_date_to: input.dateTo || null,
    p_search: input.search?.trim() || null,
    p_donor_name: input.donorName?.trim() || null,
    p_email: input.email?.trim() || null,
    p_phone: input.phone?.trim() || null,
    p_pledge_filter: pledgeStatus ? "all" : input.pledgeFilter || "all",
    p_pledge_status: pledgeStatus,
    p_donor_type: null,
    p_last_gift_filter: lastGiftFilter,
    p_min_total_given:
      input.minTotalGiven != null && input.minTotalGiven > 0 ? input.minTotalGiven : null,
  }
}

function buildDonorGivingReportRpcParams(
  orgId: string,
  input: DonorSummaryReportFilters,
  pagination?: { limit: number; offset: number }
) {
  return {
    ...buildDonorGivingReportFilterParams(orgId, input),
    p_sort_by: input.sortBy ?? "total_donations",
    p_sort_asc: input.sortAsc ?? false,
    p_limit: pagination?.limit ?? 50,
    p_offset: pagination?.offset ?? 0,
  }
}

async function fetchAllDonorSummaryRows(
  supabase: SupabaseClient,
  orgId: string,
  input: DonorSummaryReportFilters
) {
  const pageSize = 500
  const rows: DonorSummaryReportRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase.rpc(
      "donation_donor_giving_report",
      buildDonorGivingReportRpcParams(orgId, input, {
        limit: pageSize,
        offset,
      })
    )

    if (error) return { error: error.message as string, rows: null as null }

    const batch = ((data || []) as DonorGivingReportRpcRow[]).map(mapDonorGivingReportRow)
    rows.push(...batch)

    if (batch.length < pageSize) break
    offset += pageSize
  }

  return { error: null as null, rows }
}

function summarizeDonorSummaryRows(rows: DonorSummaryReportRow[]) {
  return {
    donorCount: rows.length,
    totalGiven: rows.reduce((sum, row) => sum + Number(row.total_donations || 0), 0),
    giftCount: rows.reduce((sum, row) => sum + Number(row.donation_count || 0), 0),
    outstandingPledgeTotal: rows.reduce(
      (sum, row) => sum + Number(row.outstanding_pledge_balance || 0),
      0
    ),
  }
}

export async function fetchDonorSummaryPageAction(input: DonorsPageInput = {}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? DONATIONS_PAGE_SIZE))
  const sortBy = input.sortBy ?? "total_donations"
  const sortAsc = input.sortAsc ?? sortBy === "full_name"

  const { data, error } = await access.supabase.rpc(
    "donation_donor_giving_report",
    buildDonorGivingReportRpcParams(
      access.orgId,
      {
        ...input,
        sortBy,
        sortAsc,
      },
      {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }
    )
  )

  if (error) return { success: false as const, error: error.message }

  const rpcRows = (data || []) as DonorGivingReportRpcRow[]
  const donors = rpcRows.map(mapDonorGivingReportRow)
  const total = Number(rpcRows[0]?.total_count || 0)

  return {
    success: true as const,
    donors,
    total,
    page,
    pageSize,
  }
}

type HouseholdGivingReportRpcRow = {
  family_id: string
  family_name: string | null
  primary_contact_id: string | null
  primary_name: string | null
  primary_email: string | null
  primary_phone: string | null
  member_count: number | string | null
  total_donations: number | string | null
  donation_count: number | string | null
  last_donation_date: string | null
  pledge_status: string | null
  outstanding_pledge_balance: number | string | null
  total_count: number | string | null
}

function mapHouseholdGivingReportRow(row: HouseholdGivingReportRpcRow): HouseholdGivingReportRow {
  return {
    family_id: row.family_id,
    family_name: row.family_name || "Household",
    primary_contact_id: row.primary_contact_id ?? null,
    primary_name: row.primary_name || "Unnamed",
    primary_email: row.primary_email ?? null,
    primary_phone: row.primary_phone ?? null,
    member_count: Number(row.member_count || 0),
    total_donations: Number(row.total_donations || 0),
    donation_count: Number(row.donation_count || 0),
    last_donation_date: row.last_donation_date,
    pledge_status: row.pledge_status ?? null,
    outstanding_pledge_balance: Number(row.outstanding_pledge_balance || 0),
  }
}

export async function fetchHouseholdGivingReportPageAction(
  input: Pick<
    DonorsPageInput,
    "page" | "pageSize" | "search" | "dateFrom" | "dateTo" | "sortBy" | "sortAsc"
  > = {}
) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? DONATIONS_PAGE_SIZE))
  const sortBy = input.sortBy ?? "total_donations"
  const sortAsc = input.sortAsc ?? sortBy === "full_name"

  const { data, error } = await access.supabase.rpc("donation_household_giving_report", {
    p_org_id: access.orgId,
    p_date_from: input.dateFrom ?? null,
    p_date_to: input.dateTo ?? null,
    p_search: input.search ?? null,
    p_sort_by: sortBy === "outstanding_pledge_balance" ? "total_donations" : sortBy,
    p_sort_asc: sortAsc,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  })

  if (error) {
    return {
      success: false as const,
      error: error.message.includes("donation_household_giving_report")
        ? "Household giving report is not available yet. Run migration scripts/149_household_giving_report.sql."
        : error.message,
    }
  }

  const rpcRows = (data || []) as HouseholdGivingReportRpcRow[]
  const households = rpcRows.map(mapHouseholdGivingReportRow)
  const total = Number(rpcRows[0]?.total_count || 0)

  return {
    success: true as const,
    households,
    total,
    page,
    pageSize,
  }
}

type GroupGivingReportRpcRow = {
  group_contact_id: string
  group_name: string | null
  primary_contact_name: string | null
  member_count: number | string | null
  group_gifts_total: number | string | null
  member_gifts_total: number | string | null
  total_donations: number | string | null
  donation_count: number | string | null
  last_donation_date: string | null
  pledge_status: string | null
  outstanding_pledge_balance: number | string | null
  total_count: number | string | null
}

function mapGroupGivingReportRow(row: GroupGivingReportRpcRow): GroupGivingReportRow {
  return {
    group_contact_id: row.group_contact_id,
    group_name: row.group_name || "Unnamed group",
    primary_contact_name: row.primary_contact_name ?? null,
    member_count: Number(row.member_count || 0),
    group_gifts_total: Number(row.group_gifts_total || 0),
    member_gifts_total: Number(row.member_gifts_total || 0),
    total_donations: Number(row.total_donations || 0),
    donation_count: Number(row.donation_count || 0),
    last_donation_date: row.last_donation_date,
    pledge_status: row.pledge_status ?? null,
    outstanding_pledge_balance: Number(row.outstanding_pledge_balance || 0),
  }
}

export async function fetchGroupGivingReportPageAction(
  input: Pick<
    DonorsPageInput,
    "page" | "pageSize" | "search" | "dateFrom" | "dateTo" | "sortBy" | "sortAsc"
  > = {}
) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? DONATIONS_PAGE_SIZE))
  const sortBy = input.sortBy ?? "total_donations"
  const sortAsc = input.sortAsc ?? sortBy === "full_name"

  const { data, error } = await access.supabase.rpc("donation_group_giving_report", {
    p_org_id: access.orgId,
    p_date_from: input.dateFrom ?? null,
    p_date_to: input.dateTo ?? null,
    p_search: input.search ?? null,
    p_sort_by: sortBy === "outstanding_pledge_balance" ? "total_donations" : sortBy,
    p_sort_asc: sortAsc,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  })

  if (error) {
    return {
      success: false as const,
      error: error.message.includes("donation_group_giving_report")
        ? "Group giving report is not available yet. Run migration scripts/166_group_giving_report.sql."
        : error.message,
    }
  }

  const rpcRows = (data || []) as GroupGivingReportRpcRow[]
  const groups = rpcRows.map(mapGroupGivingReportRow)
  const total = Number(rpcRows[0]?.total_count || 0)

  return {
    success: true as const,
    groups,
    total,
    page,
    pageSize,
  }
}

export async function fetchDonorSummaryReportSummaryAction(
  input: Pick<
    DonorsPageInput,
    | "search"
    | "donorName"
    | "email"
    | "phone"
    | "pledgeFilter"
    | "pledgeStatus"
    | "lastGiftFilter"
    | "minTotalGiven"
    | "dateFrom"
    | "dateTo"
  > = {}
) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase.rpc(
    "donation_donor_giving_report_summary",
    buildDonorGivingReportFilterParams(access.orgId, input)
  )

  if (error) return { success: false as const, error: error.message }

  const row = Array.isArray(data) ? data[0] : data

  return {
    success: true as const,
    summary: {
      donorCount: Number(row?.donor_count || 0),
      totalGiven: Number(row?.total_given || 0),
      giftCount: Number(row?.gift_count || 0),
    },
  }
}

export async function fetchDonorSummaryExportAction(input: DonorSummaryReportFilters = {}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const result = await fetchAllDonorSummaryRows(access.supabase, access.orgId, input)

  if (result.error) return { success: false as const, error: result.error }

  return {
    success: true as const,
    donors: result.rows,
    summary: summarizeDonorSummaryRows(result.rows),
    generatedAt: new Date().toISOString(),
  }
}

export async function fetchDonorGivingReportExportContextAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const { loadDonationReceiptSettings } = await import("@/lib/donations/receipt-settings")
  const { formatOrganizationAddress } = await import("@/lib/donations/receipt-types")
  const settings = await loadDonationReceiptSettings(access.supabase, access.orgId)

  return {
    success: true as const,
    context: {
      organizationName: settings.legal_name || "Organization",
      organizationAddress: formatOrganizationAddress(settings),
      taxId: settings.tax_id,
    },
  }
}

export type DonationPickerContact = {
  contactId: string
  full_name: string | null
  email: string | null
  phone: string | null
  contact_type?: string | null
  primary_contact_name?: string | null
}

/** Search org contacts for donation pledge/payment pickers (not limited to existing donors). */
export async function searchContactsForDonationPickerAction(search: string, limit = 50) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  let query = access.supabase
    .from("contacts")
    .select("id, full_name, email, phone, contact_type, primary_contact_name")
    .eq("organization_id", access.orgId)
    .order("full_name", { ascending: true })
    .limit(Math.min(limit, 100))

  if (search.trim()) {
    const term = `%${escapeIlike(search.trim())}%`
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
  }

  const { data, error } = await query

  if (error) return { success: false as const, error: error.message }

  const contacts: DonationPickerContact[] = (data || []).map((row) => ({
    contactId: row.id as string,
    full_name: row.full_name as string | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
    contact_type: row.contact_type as string | null,
    primary_contact_name: row.primary_contact_name as string | null,
  }))

  return { success: true as const, contacts }
}

/** @deprecated Prefer searchContactsForDonationPickerAction — searches contacts, not donor rows. */
export async function searchDonorsForPickerAction(search: string, limit = 50) {
  const result = await searchContactsForDonationPickerAction(search, limit)
  if (!result.success) return result

  return {
    success: true as const,
    donors: result.contacts.map((contact) => ({
      id: contact.contactId,
      full_name: contact.full_name,
      email: contact.email,
      donor_type: null,
    })),
  }
}

export async function fetchOpenPledgesForAllocationAction(donorId?: string | null) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  let query = access.supabase
    .from("pledge_status_view")
    .select(
      "id, donor_id, donor_name, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status"
    )
    .eq("organization_id", access.orgId)
    .gt("balance_remaining", 0)
    .neq("calculated_status", "cancelled")
    .order("donor_name", { ascending: true })
    .limit(500)

  if (donorId) {
    query = query.eq("donor_id", donorId)
  }

  const { data, error } = await query
  if (error) return { success: false as const, error: error.message }
  return { success: true as const, pledges: data || [] }
}
