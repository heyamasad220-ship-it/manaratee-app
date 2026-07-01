import type { SupabaseClient } from "@supabase/supabase-js"

import type { GroupMemberRow } from "@/lib/contacts/group-member-types"

export type GroupMemberGivingStat = {
  totalDonations: number
  donationCount: number
  lastDonationDate: string | null
}

export type FetchGroupMembersOptions = {
  includeGivingStats?: boolean
  skipGroupValidation?: boolean
}

export function isMissingGroupMembersTable(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code === "42P01" || error.code === "PGRST204" || error.code === "PGRST205") {
    return true
  }
  return /contact_group_members/i.test(error.message || "")
}

export function groupMembersMigrationMessage() {
  return "Group membership is not available yet. Run migration scripts/135_contact_group_members.sql."
}

export function formatGroupMemberActionError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (error && typeof error === "object") {
    const record = error as { message?: string; code?: string; details?: string }
    if (record.message?.trim()) return record.message
    if (record.details?.trim()) return record.details
    if (record.code) return `${fallback} (${record.code})`
  }

  return fallback
}

async function loadMemberContactsByIds(
  supabase: SupabaseClient,
  organizationId: string,
  contactIds: string[]
) {
  const contacts = new Map<
    string,
    { full_name: string | null; email: string | null; phone: string | null }
  >()

  if (contactIds.length === 0) return contacts

  const { data, error } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("organization_id", organizationId)
    .in("id", contactIds)

  if (error) return contacts

  for (const row of data || []) {
    contacts.set(row.id as string, {
      full_name: row.full_name as string | null,
      email: row.email as string | null,
      phone: row.phone as string | null,
    })
  }

  return contacts
}

async function loadAttributedMemberGivingForGroup(
  supabase: SupabaseClient,
  organizationId: string,
  groupContactId: string
) {
  const stats = new Map<string, GroupMemberGivingStat>()

  const { data, error } = await supabase
    .from("payments")
    .select("contact_id, amount, refunded_amount, payment_date, status")
    .eq("organization_id", organizationId)
    .eq("attributed_group_contact_id", groupContactId)

  if (error) {
    if (error.code === "42703") return stats
    return stats
  }

  for (const row of data || []) {
    if (String(row.status || "").toLowerCase() === "voided") continue

    const contactId = row.contact_id as string | null
    if (!contactId) continue

    const current = stats.get(contactId) || {
      totalDonations: 0,
      donationCount: 0,
      lastDonationDate: null,
    }
    const netAmount = Number(row.amount || 0) - Number(row.refunded_amount || 0)
    current.totalDonations += netAmount
    current.donationCount += 1

    const paymentDate = row.payment_date as string | null
    if (paymentDate && (!current.lastDonationDate || paymentDate > current.lastDonationDate)) {
      current.lastDonationDate = paymentDate
    }

    stats.set(contactId, current)
  }

  return stats
}

export async function loadGroupMemberGivingStats(
  supabase: SupabaseClient,
  organizationId: string,
  groupContactId: string
) {
  return loadAttributedMemberGivingForGroup(supabase, organizationId, groupContactId)
}

export async function loadGroupContactRecord(
  supabase: SupabaseClient,
  organizationId: string,
  groupContactId: string
) {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, full_name, contact_type")
    .eq("organization_id", organizationId)
    .eq("id", groupContactId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false as const, error: "Group contact was not found." }
  }

  if (data.contact_type !== "group") {
    return { ok: false as const, error: "Contact is not a group record." }
  }

  return { ok: true as const, contact: data }
}

export async function upsertActiveGroupMember(
  supabase: SupabaseClient,
  organizationId: string,
  groupContactId: string,
  memberContactId: string
) {
  const { error } = await supabase.from("contact_group_members").upsert(
    {
      organization_id: organizationId,
      group_contact_id: groupContactId,
      member_contact_id: memberContactId,
      status: "active",
    },
    { onConflict: "group_contact_id,member_contact_id" }
  )

  if (!error) return { ok: true as const }

  if (isMissingGroupMembersTable(error)) {
    return {
      ok: false as const,
      error: groupMembersMigrationMessage(),
    }
  }

  return { ok: false as const, error: error.message }
}

export async function fetchGroupMembers(
  supabase: SupabaseClient,
  organizationId: string,
  groupContactId: string,
  options: FetchGroupMembersOptions = {}
): Promise<
  { success: true; members: GroupMemberRow[] } | { success: false; error: string }
> {
  const includeGivingStats = options.includeGivingStats ?? true

  if (!options.skipGroupValidation) {
    const group = await loadGroupContactRecord(supabase, organizationId, groupContactId)
    if (!group.ok) return { success: false, error: group.error }
  }

  const { data, error } = await supabase
    .from("contact_group_members")
    .select("id, member_contact_id, status, notes")
    .eq("organization_id", organizationId)
    .eq("group_contact_id", groupContactId)
    .eq("status", "active")
    .order("created_at", { ascending: true })

  if (error) {
    if (isMissingGroupMembersTable(error)) {
      return { success: false, error: groupMembersMigrationMessage() }
    }
    return {
      success: false,
      error: formatGroupMemberActionError(error, "Could not load group members."),
    }
  }

  const memberContactIds = (data || []).map((row) => row.member_contact_id as string)
  const memberContacts = await loadMemberContactsByIds(
    supabase,
    organizationId,
    memberContactIds
  )

  const givingStats = includeGivingStats
    ? await loadAttributedMemberGivingForGroup(supabase, organizationId, groupContactId)
    : null

  const members: GroupMemberRow[] = (data || []).map((row) => {
    const contactId = row.member_contact_id as string
    const memberRecord = memberContacts.get(contactId)
    const stat = givingStats?.get(contactId)

    return {
      id: row.id as string,
      memberContactId: contactId,
      memberName: memberRecord?.full_name ?? null,
      memberEmail: memberRecord?.email ?? null,
      memberPhone: memberRecord?.phone ?? null,
      status: row.status as string,
      notes: (row.notes as string | null) ?? null,
      totalDonations: stat?.totalDonations ?? 0,
      donationCount: stat?.donationCount ?? 0,
      lastDonationDate: stat?.lastDonationDate ?? null,
    }
  })

  return { success: true, members }
}

export { loadMemberContactsByIds }
