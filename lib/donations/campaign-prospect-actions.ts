"use server"

import { revalidatePath } from "next/cache"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import { handleDonationAffiliationSync } from "@/lib/contacts/contact-affiliation-sync"
import {
  CAMPAIGN_PROSPECT_ASKED_STAGES,
  CAMPAIGN_PROSPECT_SELECT,
  campaignProspectStageFilterValues,
  displayCampaignProspectStage,
  normalizeProspectPriority,
  normalizeProspectStage,
  type CampaignProspectListItem,
  type CampaignProspectRow,
  type CampaignProspectsPageInput,
  type CampaignProspectWriteInput,
} from "@/lib/donations/campaign-prospect-types"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function revalidateProspectPaths(campaignId: string) {
  revalidatePath(`/donations/campaigns/${campaignId}`)
  revalidatePath("/donations/campaigns")
  revalidatePath("/donations")
}

function mapProspectRow(row: Record<string, unknown>): CampaignProspectRow {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    campaign_id: row.campaign_id as string,
    contact_id: row.contact_id as string,
    ask_level_id: (row.ask_level_id as string | null) ?? null,
    suggested_ask_amount:
      row.suggested_ask_amount == null ? null : Number(row.suggested_ask_amount),
    assigned_to_contact_id: (row.assigned_to_contact_id as string | null) ?? null,
    stage: displayCampaignProspectStage(row.stage as string),
    priority: normalizeProspectPriority(row.priority as string),
    last_contacted_at: (row.last_contacted_at as string | null) ?? null,
    next_follow_up_at: (row.next_follow_up_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    converted_pledge_id: (row.converted_pledge_id as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  }
}

async function loadContactNames(
  orgId: string,
  contactIds: string[]
): Promise<Map<string, { name: string; email: string | null }>> {
  const map = new Map<string, { name: string; email: string | null }>()
  if (contactIds.length === 0) return map

  const writeClient = createServiceRoleClient()
  const { data } = await writeClient
    .from("contacts")
    .select("id, full_name, email")
    .eq("organization_id", orgId)
    .in("id", contactIds)

  for (const row of data || []) {
    map.set(row.id as string, {
      name: (row.full_name as string) || "Unnamed contact",
      email: (row.email as string | null) ?? null,
    })
  }
  return map
}

async function loadAskLevelAmounts(
  orgId: string,
  askLevelIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (askLevelIds.length === 0) return map

  const writeClient = createServiceRoleClient()
  const { data } = await writeClient
    .from("campaign_ask_levels")
    .select("id, ask_amount")
    .eq("organization_id", orgId)
    .in("id", askLevelIds)

  for (const row of data || []) {
    map.set(row.id as string, Number(row.ask_amount || 0))
  }
  return map
}

async function loadPledgeAmounts(
  orgId: string,
  pledgeIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (pledgeIds.length === 0) return map

  const writeClient = createServiceRoleClient()
  const { data } = await writeClient
    .from("pledges")
    .select("id, amount_pledged")
    .eq("organization_id", orgId)
    .in("id", pledgeIds)

  for (const row of data || []) {
    map.set(row.id as string, Number(row.amount_pledged || 0))
  }
  return map
}

async function enrichProspects(
  orgId: string,
  rows: CampaignProspectRow[]
): Promise<CampaignProspectListItem[]> {
  const contactIds = new Set<string>()
  const askLevelIds = new Set<string>()
  const pledgeIds = new Set<string>()

  for (const row of rows) {
    contactIds.add(row.contact_id)
    if (row.assigned_to_contact_id) contactIds.add(row.assigned_to_contact_id)
    if (row.ask_level_id) askLevelIds.add(row.ask_level_id)
    if (row.converted_pledge_id) pledgeIds.add(row.converted_pledge_id)
  }

  const [contacts, askLevels, pledges] = await Promise.all([
    loadContactNames(orgId, [...contactIds]),
    loadAskLevelAmounts(orgId, [...askLevelIds]),
    loadPledgeAmounts(orgId, [...pledgeIds]),
  ])

  return rows.map((row) => ({
    ...row,
    contactName: contacts.get(row.contact_id)?.name || "Unknown contact",
    contactEmail: contacts.get(row.contact_id)?.email ?? null,
    assignedToName: row.assigned_to_contact_id
      ? contacts.get(row.assigned_to_contact_id)?.name || "Unknown"
      : null,
    askLevelAmount: row.ask_level_id ? askLevels.get(row.ask_level_id) ?? null : null,
    pledgeAmount: row.converted_pledge_id
      ? pledges.get(row.converted_pledge_id) ?? null
      : null,
  }))
}

export async function fetchCampaignProspectAskLevelStats(
  organizationId: string,
  campaignId: string
): Promise<Map<string, { prospects: number; asked: number }>> {
  const writeClient = createServiceRoleClient()
  const { data, error } = await writeClient
    .from("campaign_prospects")
    .select("ask_level_id, stage")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .not("ask_level_id", "is", null)

  const map = new Map<string, { prospects: number; asked: number }>()
  if (error || !data) return map

  for (const row of data) {
    const askLevelId = row.ask_level_id as string
    const stage = normalizeProspectStage(row.stage as string)
    const current = map.get(askLevelId) || { prospects: 0, asked: 0 }
    current.prospects += 1
    if (CAMPAIGN_PROSPECT_ASKED_STAGES.includes(stage)) {
      current.asked += 1
    }
    map.set(askLevelId, current)
  }

  return map
}

export async function fetchCampaignProspectsPageAction(input: CampaignProspectsPageInput) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const campaignId = input.campaignId?.trim()
  if (!campaignId) return { success: false as const, error: "Campaign is required" }

  const page = Math.max(1, input.page || 1)
  const pageSize = Math.min(Math.max(input.pageSize || DONATIONS_PAGE_SIZE, 1), 100)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  try {
    let query = access.supabase
      .from("campaign_prospects")
      .select(CAMPAIGN_PROSPECT_SELECT, { count: "exact" })
      .eq("organization_id", access.orgId)
      .eq("campaign_id", campaignId)

    if (input.assignedToContactId === "__unassigned__") {
      query = query.is("assigned_to_contact_id", null)
    } else if (input.assignedToContactId === "__assigned__") {
      query = query.not("assigned_to_contact_id", "is", null)
    } else if (input.assignedToContactId) {
      query = query.eq("assigned_to_contact_id", input.assignedToContactId)
    }
    if (input.askLevelId) {
      query = query.eq("ask_level_id", input.askLevelId)
    }
    if (input.stage && input.stage !== "all") {
      query = query.in("stage", campaignProspectStageFilterValues(input.stage))
    }
    if (input.priority && input.priority !== "all") {
      query = query.eq("priority", input.priority)
    }
    if (input.pledged === "pledged") {
      query = query.not("converted_pledge_id", "is", null)
    } else if (input.pledged === "not_pledged") {
      query = query.is("converted_pledge_id", null)
    }

    const today = new Date()
    const todayIso = today.toISOString().slice(0, 10)
    if (input.followUp === "overdue") {
      query = query
        .lt("next_follow_up_at", todayIso)
        .not("stage", "in", "(pledged,declined,no_response)")
    } else if (input.followUp === "upcoming") {
      const end = new Date(today)
      end.setDate(end.getDate() + 7)
      query = query
        .gte("next_follow_up_at", todayIso)
        .lte("next_follow_up_at", end.toISOString().slice(0, 10))
        .not("stage", "in", "(pledged,declined,no_response)")
    }

    const sortBy = input.sortBy || "next_follow_up"
    const ascending = Boolean(input.sortAsc)
    if (sortBy === "suggested_ask") {
      query = query.order("suggested_ask_amount", { ascending, nullsFirst: false })
    } else if (sortBy === "stage") {
      query = query.order("stage", { ascending })
    } else if (sortBy === "assigned_to") {
      query = query.order("assigned_to_contact_id", { ascending, nullsFirst: false })
    } else {
      query = query.order("next_follow_up_at", { ascending: ascending || false, nullsFirst: false })
    }
    query = query.order("created_at", { ascending: false })

    const { data, error, count } = await query.range(from, to)

    if (error) {
      if (error.code === "42P01" || /campaign_prospects/i.test(error.message || "")) {
        return {
          success: false as const,
          error:
            "Prospects are not available yet. Run scripts/262_campaign_prospects.sql in Supabase.",
        }
      }
      return { success: false as const, error: error.message }
    }

    let rows = ((data || []) as Record<string, unknown>[]).map(mapProspectRow)

    const search = input.search?.trim().toLowerCase()
    if (search) {
      const enriched = await enrichProspects(access.orgId, rows)
      const filtered = enriched.filter(
        (row) =>
          row.contactName.toLowerCase().includes(search) ||
          (row.contactEmail || "").toLowerCase().includes(search) ||
          (row.assignedToName || "").toLowerCase().includes(search) ||
          (row.notes || "").toLowerCase().includes(search)
      )
      return {
        success: true as const,
        prospects: filtered,
        total: filtered.length,
        page: 1,
        pageSize,
        canManage: access.canManage,
      }
    }

    const prospects = await enrichProspects(access.orgId, rows)

    if (sortBy === "contact") {
      prospects.sort((a, b) => {
        const cmp = a.contactName.localeCompare(b.contactName)
        return ascending ? cmp : -cmp
      })
    }

    return {
      success: true as const,
      prospects,
      total: count ?? prospects.length,
      page,
      pageSize,
      canManage: access.canManage,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function listCampaignProspectAssigneesAction(campaignId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const id = campaignId.trim()
  if (!id) return { success: false as const, error: "Campaign is required" }

  try {
    const { data, error } = await access.supabase
      .from("campaign_prospects")
      .select("assigned_to_contact_id")
      .eq("organization_id", access.orgId)
      .eq("campaign_id", id)
      .not("assigned_to_contact_id", "is", null)

    if (error) {
      if (error.code === "42P01" || /campaign_prospects/i.test(error.message || "")) {
        return { success: true as const, assignees: [] as Array<{ id: string; name: string }> }
      }
      return { success: false as const, error: error.message }
    }

    const assigneeIds = [
      ...new Set(
        (data || [])
          .map((row) => row.assigned_to_contact_id as string | null)
          .filter((value): value is string => Boolean(value))
      ),
    ]
    const names = await loadContactNames(access.orgId, assigneeIds)
    const assignees = assigneeIds
      .map((assigneeId) => ({
        id: assigneeId,
        name: names.get(assigneeId)?.name || "Unknown",
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { success: true as const, assignees }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function createCampaignProspectAction(
  campaignId: string,
  input: CampaignProspectWriteInput
) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }

  const contactId = input.contact_id?.trim()
  if (!contactId) return { success: false as const, error: "Contact is required" }
  if (!campaignId.trim()) return { success: false as const, error: "Campaign is required" }

  try {
    const writeClient = createServiceRoleClient()

    const { data: campaign, error: campaignError } = await writeClient
      .from("campaigns")
      .select("id")
      .eq("organization_id", access.orgId)
      .eq("id", campaignId)
      .maybeSingle()

    if (campaignError) return { success: false as const, error: campaignError.message }
    if (!campaign) return { success: false as const, error: "Campaign not found" }

    const { data: contact, error: contactError } = await writeClient
      .from("contacts")
      .select("id")
      .eq("organization_id", access.orgId)
      .eq("id", contactId)
      .maybeSingle()

    if (contactError) return { success: false as const, error: contactError.message }
    if (!contact) return { success: false as const, error: "Contact not found" }

    let stage = normalizeProspectStage(input.stage)

    const { data, error } = await writeClient
      .from("campaign_prospects")
      .insert({
        organization_id: access.orgId,
        campaign_id: campaignId,
        contact_id: contactId,
        ask_level_id: input.ask_level_id || null,
        suggested_ask_amount: input.suggested_ask_amount ?? null,
        assigned_to_contact_id: input.assigned_to_contact_id || null,
        stage,
        priority: normalizeProspectPriority(input.priority),
        last_contacted_at: input.last_contacted_at || null,
        next_follow_up_at: input.next_follow_up_at || null,
        notes: input.notes?.trim() || null,
      })
      .select(CAMPAIGN_PROSPECT_SELECT)
      .single()

    if (error) {
      if (error.code === "23505") {
        return {
          success: false as const,
          error: "This contact is already a prospect for this campaign",
        }
      }
      if (error.code === "42P01" || /campaign_prospects/i.test(error.message || "")) {
        return {
          success: false as const,
          error:
            "Prospects are not available yet. Run scripts/262_campaign_prospects.sql in Supabase.",
        }
      }
      return { success: false as const, error: error.message }
    }

    revalidateProspectPaths(campaignId)
    const [enriched] = await enrichProspects(access.orgId, [mapProspectRow(data)])
    return { success: true as const, prospect: enriched }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function updateCampaignProspectAction(
  prospectId: string,
  input: Partial<CampaignProspectWriteInput> & { stage?: string; priority?: string }
) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }

  if (!prospectId.trim()) return { success: false as const, error: "Prospect is required" }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaign_prospects")
      .select(CAMPAIGN_PROSPECT_SELECT)
      .eq("organization_id", access.orgId)
      .eq("id", prospectId)
      .maybeSingle()

    if (existingError) return { success: false as const, error: existingError.message }
    if (!existing) return { success: false as const, error: "Prospect not found" }

    const patch: Record<string, unknown> = {}
    if (input.contact_id !== undefined) patch.contact_id = input.contact_id
    if (input.ask_level_id !== undefined) patch.ask_level_id = input.ask_level_id || null
    if (input.suggested_ask_amount !== undefined) {
      patch.suggested_ask_amount = input.suggested_ask_amount
    }
    if (input.assigned_to_contact_id !== undefined) {
      patch.assigned_to_contact_id = input.assigned_to_contact_id || null
    }
    if (input.stage !== undefined) patch.stage = normalizeProspectStage(input.stage)
    if (input.priority !== undefined) {
      patch.priority = normalizeProspectPriority(input.priority)
    }
    if (input.last_contacted_at !== undefined) {
      patch.last_contacted_at = input.last_contacted_at || null
    }
    if (input.next_follow_up_at !== undefined) {
      patch.next_follow_up_at = input.next_follow_up_at || null
    }
    if (input.notes !== undefined) patch.notes = input.notes?.trim() || null

    const { data, error } = await writeClient
      .from("campaign_prospects")
      .update(patch)
      .eq("organization_id", access.orgId)
      .eq("id", prospectId)
      .select(CAMPAIGN_PROSPECT_SELECT)
      .maybeSingle()

    if (error || !data) {
      if (error?.code === "23505") {
        return {
          success: false as const,
          error: "This contact is already a prospect for this campaign",
        }
      }
      return { success: false as const, error: error?.message || "Failed to update prospect" }
    }

    revalidateProspectPaths(existing.campaign_id as string)
    const [enriched] = await enrichProspects(access.orgId, [mapProspectRow(data)])
    return { success: true as const, prospect: enriched }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function updateCampaignProspectStageAction(
  prospectId: string,
  stage: string
) {
  return updateCampaignProspectAction(prospectId, {
    stage: normalizeProspectStage(stage),
  })
}

export async function bulkAssignCampaignProspectsAction(input: {
  prospectIds: string[]
  assignedToContactId: string | null
}) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }

  const ids = (input.prospectIds || []).filter(Boolean)
  if (ids.length === 0) {
    return { success: false as const, error: "Select at least one prospect" }
  }

  try {
    const writeClient = createServiceRoleClient()
    const patch: Record<string, unknown> = {
      assigned_to_contact_id: input.assignedToContactId || null,
    }

    const { data: existing } = await writeClient
      .from("campaign_prospects")
      .select("id, campaign_id, stage")
      .eq("organization_id", access.orgId)
      .in("id", ids)

    const { error } = await writeClient
      .from("campaign_prospects")
      .update(patch)
      .eq("organization_id", access.orgId)
      .in("id", ids)

    if (error) return { success: false as const, error: error.message }

    const campaignId = (existing?.[0]?.campaign_id as string) || ""
    if (campaignId) revalidateProspectPaths(campaignId)

    return { success: true as const, updatedCount: ids.length }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function deleteCampaignProspectAction(prospectId: string) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaign_prospects")
      .select("id, campaign_id, converted_pledge_id")
      .eq("organization_id", access.orgId)
      .eq("id", prospectId)
      .maybeSingle()

    if (existingError) return { success: false as const, error: existingError.message }
    if (!existing) return { success: false as const, error: "Prospect not found" }
    if (existing.converted_pledge_id) {
      return {
        success: false as const,
        error: "This prospect is linked to a pledge and cannot be deleted",
      }
    }

    const { error } = await writeClient
      .from("campaign_prospects")
      .delete()
      .eq("organization_id", access.orgId)
      .eq("id", prospectId)

    if (error) return { success: false as const, error: error.message }

    revalidateProspectPaths(existing.campaign_id as string)
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getCampaignProspectForConversionAction(prospectId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  if (!prospectId.trim()) {
    return { success: false as const, error: "Prospect is required" }
  }

  try {
    const writeClient = createServiceRoleClient()
    const { data, error } = await writeClient
      .from("campaign_prospects")
      .select(CAMPAIGN_PROSPECT_SELECT)
      .eq("organization_id", access.orgId)
      .eq("id", prospectId)
      .maybeSingle()

    if (error) {
      if (error.code === "42P01" || /campaign_prospects/i.test(error.message || "")) {
        return {
          success: false as const,
          error:
            "Prospects are not available yet. Run scripts/262_campaign_prospects.sql in Supabase.",
        }
      }
      return { success: false as const, error: error.message }
    }
    if (!data) return { success: false as const, error: "Prospect not found" }

    const prospect = mapProspectRow(data as Record<string, unknown>)
    if (prospect.converted_pledge_id) {
      return {
        success: false as const,
        error: "This prospect already has a linked pledge",
        prospectId: prospect.id,
        pledgeId: prospect.converted_pledge_id,
      }
    }

    const [enriched] = await enrichProspects(access.orgId, [prospect])

    const { data: campaign } = await writeClient
      .from("campaigns")
      .select("id, name")
      .eq("organization_id", access.orgId)
      .eq("id", prospect.campaign_id)
      .maybeSingle()
    const campaignName = (campaign?.name as string | null) ?? null

    return {
      success: true as const,
      prospect: enriched,
      campaignName,
      campaignPhaseId: null,
      phaseName: null,
      canManage: access.canManage,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

/**
 * Create ONE pledge from a prospect and link them.
 * Preserves suggested_ask_amount on the prospect; does not overwrite it with the pledge amount.
 */
export async function convertCampaignProspectToPledgeAction(input: {
  prospectId: string
  amountPledged: number
  pledgeDate?: string | null
  frequency?: string | null
  notes?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  wishlistItemId?: string | null
}) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }

  const amount = Number(input.amountPledged)
  if (!(amount > 0)) {
    return { success: false as const, error: "Enter a valid pledge amount" }
  }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaign_prospects")
      .select(CAMPAIGN_PROSPECT_SELECT)
      .eq("organization_id", access.orgId)
      .eq("id", input.prospectId)
      .maybeSingle()

    if (existingError) return { success: false as const, error: existingError.message }
    if (!existing) return { success: false as const, error: "Prospect not found" }

    const prospect = mapProspectRow(existing as Record<string, unknown>)
    if (prospect.converted_pledge_id) {
      return {
        success: false as const,
        error: "This prospect already has a linked pledge",
        pledgeId: prospect.converted_pledge_id,
      }
    }

    const donorId = await ensureDonorExtensionForContact(
      access.orgId,
      prospect.contact_id,
      writeClient
    )
    if (!donorId) {
      return {
        success: false as const,
        error: "Could not resolve a donor record for this contact",
      }
    }

    const frequency = String(input.frequency || "one_time")
      .toLowerCase()
      .replace(/-/g, "_")
    const pledgeDate =
      (input.pledgeDate && input.pledgeDate.slice(0, 10)) ||
      new Date().toISOString().slice(0, 10)

    const suggestedNote =
      prospect.suggested_ask_amount != null
        ? `Suggested ask: $${Number(prospect.suggested_ask_amount).toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}`
        : null
    const userNotes = input.notes?.trim() || null
    const combinedNotes = [userNotes, suggestedNote].filter(Boolean).join("\n") || null

    const insertPayload: Record<string, unknown> = {
      organization_id: access.orgId,
      donor_id: donorId,
      campaign_id: prospect.campaign_id,
      category_id: input.categoryId || null,
      subcategory_id: input.subcategoryId || null,
      wishlist_item_id: input.wishlistItemId || null,
      amount_pledged: amount,
      pledge_date: pledgeDate,
      pledge_type: frequency,
      frequency,
      status: "open",
      notes: combinedNotes,
      campaign_phase_id: null,
      ask_level_id: prospect.ask_level_id,
      campaign_prospect_id: prospect.id,
    }

    let { data: pledge, error: pledgeError } = await writeClient
      .from("pledges")
      .insert(insertPayload)
      .select("id, amount_pledged, campaign_id")
      .single()

    // Graceful if migration columns missing.
    if (
      pledgeError &&
      (pledgeError.code === "42703" ||
        /campaign_phase_id|ask_level_id|campaign_prospect_id|wishlist_item_id/i.test(
          pledgeError.message || ""
        ))
    ) {
      delete insertPayload.campaign_phase_id
      delete insertPayload.ask_level_id
      delete insertPayload.campaign_prospect_id
      delete insertPayload.wishlist_item_id
      const retry = await writeClient
        .from("pledges")
        .insert(insertPayload)
        .select("id, amount_pledged, campaign_id")
        .single()
      pledge = retry.data
      pledgeError = retry.error
    }

    if (pledgeError || !pledge) {
      return {
        success: false as const,
        error: pledgeError?.message || "Failed to create pledge",
      }
    }

    const { error: prospectUpdateError } = await writeClient
      .from("campaign_prospects")
      .update({
        stage: "pledged",
        converted_pledge_id: pledge.id,
        // Never overwrite suggested_ask_amount.
      })
      .eq("organization_id", access.orgId)
      .eq("id", prospect.id)

    if (prospectUpdateError) {
      // Roll back pledge to avoid orphan conversion state.
      await writeClient
        .from("pledges")
        .delete()
        .eq("organization_id", access.orgId)
        .eq("id", pledge.id)
      return { success: false as const, error: prospectUpdateError.message }
    }

    try {
      await handleDonationAffiliationSync({
        organizationId: access.orgId,
        donorId,
        contactId: prospect.contact_id,
      })
    } catch (syncError) {
      console.error(
        `[prospect-convert] affiliation sync failed: ${
          syncError instanceof Error ? syncError.message : String(syncError)
        }`
      )
    }

    revalidateProspectPaths(prospect.campaign_id)
    revalidatePath("/donations/campaigns/pledges")
    revalidatePath("/donations")

    return {
      success: true as const,
      pledgeId: pledge.id as string,
      amountPledged: Number(pledge.amount_pledged || amount),
      suggestedAskAmount: prospect.suggested_ask_amount,
      campaignId: prospect.campaign_id,
      contactId: prospect.contact_id,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
