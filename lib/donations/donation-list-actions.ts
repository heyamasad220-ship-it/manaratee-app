"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

export type PaymentsPageInput = {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}

export async function fetchPaymentsPageAction(input: PaymentsPageInput = {}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? DONATIONS_PAGE_SIZE))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = access.supabase
    .from("payments")
    .select(
      "id, amount, payment_date, source, memo, pledge_id, donor_id, status, sender_name, donors ( donor_type )",
      { count: "exact" }
    )
    .eq("organization_id", access.orgId)
    .order("payment_date", { ascending: false })

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status)
  }
  if (input.dateFrom) {
    query = query.gte("payment_date", input.dateFrom)
  }
  if (input.dateTo) {
    query = query.lte("payment_date", input.dateTo)
  }
  if (input.search?.trim()) {
    const term = `%${escapeIlike(input.search.trim())}%`
    query = query.or(`sender_name.ilike.${term},memo.ilike.${term},source.ilike.${term}`)
  }

  const { data, error, count } = await query.range(from, to)

  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    payments: (data || []).map((row) => {
      const donor = Array.isArray(row.donors) ? row.donors[0] : row.donors
      const { donors: _donors, ...payment } = row as Record<string, unknown> & {
        donors?: { donor_type?: string | null } | { donor_type?: string | null }[] | null
      }
      return {
        ...payment,
        donor_type: (donor?.donor_type as string | null) ?? null,
      }
    }),
    total: count ?? 0,
    page,
    pageSize,
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
    query = query.or(`donor_name.ilike.${term},campaign_name.ilike.${term}`)
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
      "id, organization_id, donor_id, donor_name, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date, frequency, status",
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

export type DonorsPageInput = {
  page?: number
  pageSize?: number
  search?: string
  pledgeFilter?: DonorPledgeFilter
  lapsedOnly?: boolean
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
  phone: string | null
  donor_type: string | null
  total_donations: number
  donation_count: number
  last_donation_date: string | null
  lifetime_last_donation_date: string | null
  has_open_pledge: boolean
  outstanding_pledge_balance: number
}

export type DonorSummaryReportFilters = Pick<
  DonorsPageInput,
  | "search"
  | "pledgeFilter"
  | "lapsedOnly"
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
  phone: string | null
  donor_type: string | null
  total_donations: number | string | null
  donation_count: number | string | null
  last_donation_date: string | null
  lifetime_last_donation_date: string | null
  has_open_pledge: boolean | null
  outstanding_pledge_balance: number | string | null
  total_count: number | string | null
}

function mapDonorGivingReportRow(row: DonorGivingReportRpcRow): DonorSummaryReportRow {
  return {
    id: row.id,
    contact_id: row.contact_id ?? null,
    full_name: row.full_name,
    phone: row.phone,
    donor_type: row.donor_type,
    total_donations: Number(row.total_donations || 0),
    donation_count: Number(row.donation_count || 0),
    last_donation_date: row.last_donation_date,
    lifetime_last_donation_date: row.lifetime_last_donation_date,
    has_open_pledge: Boolean(row.has_open_pledge),
    outstanding_pledge_balance: Number(row.outstanding_pledge_balance || 0),
  }
}

function buildDonorGivingReportFilterParams(
  orgId: string,
  input: Pick<
    DonorSummaryReportFilters,
    "search" | "pledgeFilter" | "lapsedOnly" | "minTotalGiven" | "dateFrom" | "dateTo"
  >
) {
  return {
    p_org_id: orgId,
    p_date_from: input.dateFrom || null,
    p_date_to: input.dateTo || null,
    p_search: input.search?.trim() || null,
    p_pledge_filter: input.pledgeFilter || "all",
    p_donor_type: null,
    p_lapsed_only: Boolean(input.lapsedOnly),
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

export async function fetchDonorSummaryReportSummaryAction(
  input: Pick<
    DonorsPageInput,
    "search" | "pledgeFilter" | "lapsedOnly" | "minTotalGiven" | "dateFrom" | "dateTo"
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
