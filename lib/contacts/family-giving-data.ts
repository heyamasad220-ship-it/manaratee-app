import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  FamilyGivingRollup,
  FamilyListSummary,
  FamilyMemberGivingRow,
  FamilyRecentGiftRow,
} from "@/lib/contacts/family-types"

export type ContactGivingStat = {
  totalDonations: number
  donationCount: number
  lastDonationDate: string | null
}

export function isMissingFamiliesTable(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code === "42P01" || error.code === "PGRST204" || error.code === "PGRST205") {
    return true
  }
  return /families|family_members/i.test(error.message || "")
}

export function familiesMigrationMessage() {
  return "Family households are not available yet. Run migration scripts/148_families_and_family_members.sql."
}

function paymentNetAmount(amount: unknown, refundedAmount: unknown) {
  return Math.max(0, Number(amount || 0) - Number(refundedAmount || 0))
}

function isCountablePayment(status: string | null | undefined, netAmount: number) {
  if (netAmount <= 0) return false
  return String(status || "").toLowerCase() !== "voided"
}

export async function loadContactGivingStatsMap(
  supabase: SupabaseClient,
  organizationId: string,
  contactIds: string[]
): Promise<Map<string, ContactGivingStat>> {
  const stats = new Map<string, ContactGivingStat>()
  const uniqueIds = [...new Set(contactIds.filter(Boolean))]
  if (uniqueIds.length === 0) return stats

  const { data, error } = await supabase
    .from("payments")
    .select("contact_id, amount, refunded_amount, payment_date, status")
    .eq("organization_id", organizationId)
    .in("contact_id", uniqueIds)

  if (error) {
    console.warn("loadContactGivingStatsMap:", error.message)
    return stats
  }

  for (const row of data || []) {
    const contactId = row.contact_id as string | null
    if (!contactId) continue

    const netAmount = paymentNetAmount(row.amount, row.refunded_amount)
    if (!isCountablePayment(row.status as string | null, netAmount)) continue

    const current = stats.get(contactId) || {
      totalDonations: 0,
      donationCount: 0,
      lastDonationDate: null,
    }

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

function rollupMemberStats(
  members: Array<{
    id: string
    contactId: string
    memberName: string | null
    role: string
  }>,
  statsByContactId: Map<string, ContactGivingStat>
): {
  members: FamilyMemberGivingRow[]
  lifetimeTotal: number
  giftCount: number
  lastGiftDate: string | null
} {
  let lifetimeTotal = 0
  let giftCount = 0
  let lastGiftDate: string | null = null

  const memberRows = members.map((member) => {
    const stats = statsByContactId.get(member.contactId) || {
      totalDonations: 0,
      donationCount: 0,
      lastDonationDate: null,
    }

    lifetimeTotal += stats.totalDonations
    giftCount += stats.donationCount

    if (
      stats.lastDonationDate &&
      (!lastGiftDate || stats.lastDonationDate > lastGiftDate)
    ) {
      lastGiftDate = stats.lastDonationDate
    }

    return {
      id: member.id,
      contactId: member.contactId,
      memberName: member.memberName,
      role: member.role,
      totalDonations: stats.totalDonations,
      donationCount: stats.donationCount,
      lastDonationDate: stats.lastDonationDate,
    }
  })

  memberRows.sort((left, right) =>
    (left.memberName || "").localeCompare(right.memberName || "")
  )

  return { members: memberRows, lifetimeTotal, giftCount, lastGiftDate }
}

export async function fetchFamilyGivingRollup(
  supabase: SupabaseClient,
  organizationId: string,
  familyId: string
): Promise<{ ok: true; rollup: FamilyGivingRollup } | { ok: false; error: string }> {
  const { data: family, error: familyError } = await supabase
    .from("families")
    .select(
      `
      id,
      name,
      status,
      primary_contact_id,
      primary:primary_contact_id ( full_name )
    `
    )
    .eq("organization_id", organizationId)
    .eq("id", familyId)
    .maybeSingle()

  if (familyError) {
    if (isMissingFamiliesTable(familyError)) {
      return { ok: false, error: familiesMigrationMessage() }
    }
    return { ok: false, error: familyError.message }
  }

  if (!family) {
    return { ok: false, error: "Family not found." }
  }

  const { data: memberRows, error: membersError } = await supabase
    .from("family_members")
    .select(
      `
      id,
      contact_id,
      role,
      contact:contact_id ( full_name )
    `
    )
    .eq("organization_id", organizationId)
    .eq("family_id", familyId)
    .is("end_date", null)
    .order("role", { ascending: true })

  if (membersError) {
    return { ok: false, error: membersError.message }
  }

  const members = (memberRows || []).map((row) => {
    const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact
    return {
      id: row.id as string,
      contactId: row.contact_id as string,
      memberName: (contact?.full_name as string | null) ?? null,
      role: (row.role as string) || "member",
    }
  })

  const contactIds = members.map((member) => member.contactId)
  const statsByContactId = await loadContactGivingStatsMap(
    supabase,
    organizationId,
    contactIds
  )

  const totals = rollupMemberStats(members, statsByContactId)

  let recentGifts: FamilyRecentGiftRow[] = []

  if (contactIds.length > 0) {
    const { data: recentPayments, error: recentError } = await supabase
      .from("payments")
      .select(
        `
      id,
      contact_id,
      amount,
      refunded_amount,
      payment_date,
      status,
      campaigns:campaign_id ( name ),
      contact:contact_id ( full_name )
    `
      )
      .eq("organization_id", organizationId)
      .in("contact_id", contactIds)
      .order("payment_date", { ascending: false })
      .limit(50)

    if (recentError) {
      return { ok: false, error: recentError.message }
    }

    recentGifts = (recentPayments || [])
      .map((row) => {
        const netAmount = paymentNetAmount(row.amount, row.refunded_amount)
        if (!isCountablePayment(row.status as string | null, netAmount)) return null

        const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact
        const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns

        return {
          id: row.id as string,
          contactId: row.contact_id as string,
          memberName: (contact?.full_name as string | null) ?? null,
          amount: netAmount,
          paymentDate: row.payment_date as string,
          campaignName: (campaign?.name as string | null) ?? null,
        }
      })
      .filter((row): row is FamilyRecentGiftRow => row !== null)
      .slice(0, 20)
  }

  const primary = Array.isArray(family.primary) ? family.primary[0] : family.primary

  return {
    ok: true,
    rollup: {
      familyId: family.id as string,
      familyName: family.name as string,
      status: family.status as string,
      primaryContactId: (family.primary_contact_id as string | null) ?? null,
      primaryName: (primary?.full_name as string | null) ?? null,
      lifetimeTotal: totals.lifetimeTotal,
      giftCount: totals.giftCount,
      lastGiftDate: totals.lastGiftDate,
      memberCount: members.length,
      members: totals.members,
      recentGifts,
    },
  }
}

export async function fetchFamilyListSummaries(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ ok: true; families: FamilyListSummary[] } | { ok: false; error: string }> {
  const { data: families, error } = await supabase
    .from("families")
    .select(
      `
      id,
      name,
      status,
      primary_contact_id,
      primary:primary_contact_id ( full_name, email ),
      family_members ( contact_id, end_date )
    `
    )
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("name", { ascending: true })

  if (error) {
    if (isMissingFamiliesTable(error)) {
      return { ok: false, error: familiesMigrationMessage() }
    }
    return { ok: false, error: error.message }
  }

  const familyRecords = (families || []).map((family) => {
    const primary = Array.isArray(family.primary) ? family.primary[0] : family.primary
    const memberRows = (family.family_members as Array<{ contact_id: string; end_date: string | null }> | null) || []
    const activeContactIds = memberRows
      .filter((row) => !row.end_date)
      .map((row) => row.contact_id)

    return {
      id: family.id as string,
      name: family.name as string,
      status: family.status as string,
      primaryContactId: (family.primary_contact_id as string | null) ?? null,
      primaryName: (primary?.full_name as string | null) ?? null,
      primaryEmail: (primary?.email as string | null) ?? null,
      activeContactIds,
    }
  })

  const allContactIds = [...new Set(familyRecords.flatMap((family) => family.activeContactIds))]
  const statsByContactId = await loadContactGivingStatsMap(
    supabase,
    organizationId,
    allContactIds
  )

  const summaries: FamilyListSummary[] = familyRecords.map((family) => {
    let lifetimeTotal = 0
    let giftCount = 0
    let lastGiftDate: string | null = null

    for (const contactId of family.activeContactIds) {
      const stats = statsByContactId.get(contactId)
      if (!stats) continue
      lifetimeTotal += stats.totalDonations
      giftCount += stats.donationCount
      if (stats.lastDonationDate && (!lastGiftDate || stats.lastDonationDate > lastGiftDate)) {
        lastGiftDate = stats.lastDonationDate
      }
    }

    return {
      id: family.id,
      name: family.name,
      status: family.status,
      primaryContactId: family.primaryContactId,
      primaryName: family.primaryName,
      primaryEmail: family.primaryEmail,
      memberCount: family.activeContactIds.length,
      lifetimeTotal,
      giftCount,
      lastGiftDate,
    }
  })

  return { ok: true, families: summaries }
}
