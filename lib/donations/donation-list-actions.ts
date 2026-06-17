"use server"

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
      "id, amount, payment_date, source, memo, pledge_id, donor_id, status, sender_name",
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
    payments: data || [],
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
  sortBy?: "pledge_date" | "donor_name" | "balance_remaining"
  sortAsc?: boolean
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

  if (input.status && input.status !== "all") {
    query = query.eq("calculated_status", input.status)
  }
  if (input.search?.trim()) {
    const term = `%${escapeIlike(input.search.trim())}%`
    query = query.or(`donor_name.ilike.${term},campaign_name.ilike.${term}`)
  }

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

export async function fetchPledgeSummaryMetricsAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase.rpc("donation_org_pledge_summary", {
    p_org_id: access.orgId,
  })

  if (error) return { success: false as const, error: error.message }

  const row = Array.isArray(data) ? data[0] : data
  return {
    success: true as const,
    metrics: {
      totalPledged: Number(row?.total_pledged || 0),
      totalCollected: Number(row?.total_collected || 0),
      outstandingBalance: Number(row?.outstanding_balance || 0),
      activePledgeCount: Number(row?.active_pledge_count || 0),
    },
  }
}

export type DonorsPageInput = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: "full_name" | "total_donations" | "last_donation_date"
  sortAsc?: boolean
}

export async function fetchDonorSummaryPageAction(input: DonorsPageInput = {}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? DONATIONS_PAGE_SIZE))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortBy = input.sortBy ?? "full_name"
  const sortAsc = input.sortAsc ?? true

  let query = access.supabase
    .from("donor_summary_view")
    .select(
      "id, full_name, email, phone, donor_type, total_donations, donation_count, last_donation_date, has_open_pledge, status",
      { count: "exact" }
    )
    .eq("organization_id", access.orgId)
    .order(sortBy, { ascending: sortAsc, nullsFirst: false })

  if (input.search?.trim()) {
    const term = `%${escapeIlike(input.search.trim())}%`
    query = query.or(`full_name.ilike.${term},email.ilike.${term}`)
  }

  const { data, error, count } = await query.range(from, to)

  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    donors: data || [],
    total: count ?? 0,
    page,
    pageSize,
  }
}

export type DonationPickerContact = {
  contactId: string
  full_name: string | null
  email: string | null
  phone: string | null
}

/** Search org contacts for donation pledge/payment pickers (not limited to existing donors). */
export async function searchContactsForDonationPickerAction(search: string, limit = 50) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  let query = access.supabase
    .from("contacts")
    .select("id, full_name, email, phone")
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
