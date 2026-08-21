"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  type CampaignPaymentRow,
  type CampaignPledgeRow,
} from "@/lib/donations/campaign-analytics"
import {
  computeCampaignGroupMetrics,
  fetchCampaignGroups,
  mapCampaignGroupRow,
} from "@/lib/donations/campaign-group-helpers"
import {
  CAMPAIGN_GROUP_SELECT,
  normalizeCampaignGroupStatus,
  type CampaignGroupWriteInput,
} from "@/lib/donations/campaign-group-types"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function createPublicToken() {
  return randomUUID().replace(/-/g, "")
}

function revalidateGroupPaths(campaignId: string) {
  revalidatePath(`/donations/campaigns/${campaignId}`)
  revalidatePath("/donations/campaigns")
  revalidatePath("/donations")
}

async function loadContactNames(orgId: string, ids: string[]) {
  const map = new Map<string, string>()
  if (ids.length === 0) return map
  const writeClient = createServiceRoleClient()
  const { data } = await writeClient
    .from("contacts")
    .select("id, full_name")
    .eq("organization_id", orgId)
    .in("id", ids)
  for (const row of data || []) {
    map.set(row.id as string, (row.full_name as string) || "Unnamed")
  }
  return map
}

export async function listCampaignGroupsAction(campaignId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const groups = await fetchCampaignGroups(access.supabase, access.orgId, campaignId)

    const contactIds = new Set<string>()
    for (const group of groups) {
      if (group.lead_contact_id) contactIds.add(group.lead_contact_id)
      if (group.organizational_group_id) contactIds.add(group.organizational_group_id)
    }
    const contactNames = await loadContactNames(access.orgId, [...contactIds])

    // Lightweight ledger load for this campaign only.
    const writeClient = createServiceRoleClient()
    const [pledgesResult, paymentsResult] = await Promise.all([
      writeClient
        .from("pledge_status_view")
        .select(
          "id, campaign_id, donor_id, amount_pledged, balance_remaining, calculated_status"
        )
        .eq("organization_id", access.orgId)
        .eq("campaign_id", campaignId),
      writeClient
        .from("payments")
        .select(
          "id, campaign_id, pledge_id, donor_id, contact_id, amount, refunded_amount, status, campaign_group_id"
        )
        .eq("organization_id", access.orgId)
        .eq("campaign_id", campaignId),
    ])

    let pledges = (pledgesResult.data || []) as CampaignPledgeRow[]
    const payments = (paymentsResult.data || []) as CampaignPaymentRow[]

    if (pledges.length > 0) {
      const { data: pledgeGroups } = await writeClient
        .from("pledges")
        .select("id, campaign_group_id")
        .eq("organization_id", access.orgId)
        .in(
          "id",
          pledges.map((p) => p.id)
        )
      if (pledgeGroups) {
        const byId = new Map(
          pledgeGroups.map((row) => [
            row.id as string,
            (row.campaign_group_id as string | null) ?? null,
          ])
        )
        pledges = pledges.map((pledge) => ({
          ...pledge,
          campaign_group_id: byId.get(pledge.id) ?? null,
        })) as CampaignPledgeRow[]
      }
    }

    const metrics = computeCampaignGroupMetrics({
      groups,
      campaignId,
      pledges,
      payments,
      contactNames,
    })

    return {
      success: true as const,
      groups,
      metrics,
      canManage: access.canManageCampaigns,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getCampaignGroupDetailAction(groupId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const writeClient = createServiceRoleClient()
    const { data, error } = await writeClient
      .from("campaign_groups")
      .select(CAMPAIGN_GROUP_SELECT)
      .eq("organization_id", access.orgId)
      .eq("id", groupId)
      .maybeSingle()

    if (error) {
      if (error.code === "42P01" || /campaign_groups/i.test(error.message || "")) {
        return {
          success: false as const,
          error:
            "Campaign groups are not available yet. Run scripts/263_campaign_groups.sql in Supabase.",
        }
      }
      return { success: false as const, error: error.message }
    }
    if (!data) return { success: false as const, error: "Group not found" }

    const group = mapCampaignGroupRow(data as Record<string, unknown>)
    const list = await listCampaignGroupsAction(group.campaign_id)
    if (!list.success) return list

    const metrics = list.metrics.find((row) => row.groupId === group.id) || null

    const { data: gifts } = await writeClient
      .from("payments")
      .select(
        "id, amount, refunded_amount, payment_date, source, status, sender_name, contact_id, donor_id, pledge_id"
      )
      .eq("organization_id", access.orgId)
      .eq("campaign_group_id", group.id)
      .order("payment_date", { ascending: false })
      .limit(100)

    const { data: groupPledges } = await writeClient
      .from("pledge_status_view")
      .select(
        "id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
      )
      .eq("organization_id", access.orgId)
      .eq("campaign_id", group.campaign_id)

    // Filter pledges by campaign_group_id from base table.
    let pledgeRows: Array<Record<string, unknown>> = []
    if (groupPledges && groupPledges.length > 0) {
      const { data: linked } = await writeClient
        .from("pledges")
        .select("id")
        .eq("organization_id", access.orgId)
        .eq("campaign_group_id", group.id)
      const linkedIds = new Set((linked || []).map((row) => row.id as string))
      pledgeRows = (groupPledges as Record<string, unknown>[]).filter((row) =>
        linkedIds.has(row.id as string)
      )
    }

    return {
      success: true as const,
      group,
      metrics,
      payments: gifts || [],
      pledges: pledgeRows,
      canManage: access.canManageCampaigns,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function createCampaignGroupAction(
  campaignId: string,
  input: CampaignGroupWriteInput
) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  const name = input.name.trim()
  if (!name) return { success: false as const, error: "Group name is required" }

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

    const { data, error } = await writeClient
      .from("campaign_groups")
      .insert({
        organization_id: access.orgId,
        campaign_id: campaignId,
        name,
        organizational_group_id: input.organizational_group_id || null,
        lead_contact_id: input.lead_contact_id || null,
        goal_amount: input.goal_amount ?? null,
        description: input.description?.trim() || null,
        public_token: createPublicToken(),
        status: normalizeCampaignGroupStatus(input.status),
        public_progress_enabled: Boolean(input.public_progress_enabled),
        link_active: input.link_active !== false,
      })
      .select(CAMPAIGN_GROUP_SELECT)
      .single()

    if (error) {
      if (error.code === "23505") {
        return {
          success: false as const,
          error: "A group with this name already exists on this campaign",
        }
      }
      if (error.code === "42P01" || /campaign_groups/i.test(error.message || "")) {
        return {
          success: false as const,
          error:
            "Campaign groups are not available yet. Run scripts/263_campaign_groups.sql in Supabase.",
        }
      }
      return { success: false as const, error: error.message }
    }

    revalidateGroupPaths(campaignId)
    return { success: true as const, group: mapCampaignGroupRow(data as Record<string, unknown>) }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function updateCampaignGroupAction(
  groupId: string,
  input: Partial<CampaignGroupWriteInput>
) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaign_groups")
      .select(CAMPAIGN_GROUP_SELECT)
      .eq("organization_id", access.orgId)
      .eq("id", groupId)
      .maybeSingle()

    if (existingError) return { success: false as const, error: existingError.message }
    if (!existing) return { success: false as const, error: "Group not found" }

    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name.trim()
    if (input.organizational_group_id !== undefined) {
      patch.organizational_group_id = input.organizational_group_id || null
    }
    if (input.lead_contact_id !== undefined) {
      patch.lead_contact_id = input.lead_contact_id || null
    }
    if (input.goal_amount !== undefined) patch.goal_amount = input.goal_amount
    if (input.description !== undefined) {
      patch.description = input.description?.trim() || null
    }
    if (input.status !== undefined) {
      patch.status = normalizeCampaignGroupStatus(input.status)
    }
    if (input.public_progress_enabled !== undefined) {
      patch.public_progress_enabled = Boolean(input.public_progress_enabled)
    }
    if (input.link_active !== undefined) {
      patch.link_active = Boolean(input.link_active)
    }

    if (patch.name !== undefined && !String(patch.name)) {
      return { success: false as const, error: "Group name is required" }
    }

    const { data, error } = await writeClient
      .from("campaign_groups")
      .update(patch)
      .eq("organization_id", access.orgId)
      .eq("id", groupId)
      .select(CAMPAIGN_GROUP_SELECT)
      .maybeSingle()

    if (error || !data) {
      if (error?.code === "23505") {
        return {
          success: false as const,
          error: "A group with this name already exists on this campaign",
        }
      }
      return { success: false as const, error: error?.message || "Failed to update group" }
    }

    revalidateGroupPaths(existing.campaign_id as string)
    return { success: true as const, group: mapCampaignGroupRow(data as Record<string, unknown>) }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function regenerateCampaignGroupLinkAction(groupId: string) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaign_groups")
      .select("id, campaign_id")
      .eq("organization_id", access.orgId)
      .eq("id", groupId)
      .maybeSingle()

    if (existingError) return { success: false as const, error: existingError.message }
    if (!existing) return { success: false as const, error: "Group not found" }

    const { data, error } = await writeClient
      .from("campaign_groups")
      .update({
        public_token: createPublicToken(),
        link_active: true,
      })
      .eq("organization_id", access.orgId)
      .eq("id", groupId)
      .select(CAMPAIGN_GROUP_SELECT)
      .maybeSingle()

    if (error || !data) {
      return { success: false as const, error: error?.message || "Failed to regenerate link" }
    }

    revalidateGroupPaths(existing.campaign_id as string)
    return { success: true as const, group: mapCampaignGroupRow(data as Record<string, unknown>) }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function deleteCampaignGroupAction(groupId: string) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaign_groups")
      .select("id, campaign_id")
      .eq("organization_id", access.orgId)
      .eq("id", groupId)
      .maybeSingle()

    if (existingError) return { success: false as const, error: existingError.message }
    if (!existing) return { success: false as const, error: "Group not found" }

    const [{ count: paymentCount }, { count: pledgeCount }] = await Promise.all([
      writeClient
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", access.orgId)
        .eq("campaign_group_id", groupId),
      writeClient
        .from("pledges")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", access.orgId)
        .eq("campaign_group_id", groupId),
    ])

    if ((paymentCount || 0) > 0 || (pledgeCount || 0) > 0) {
      return {
        success: false as const,
        error:
          "This group has pledges or donations. Deactivate the link or archive the group instead of deleting.",
      }
    }

    const { error } = await writeClient
      .from("campaign_groups")
      .delete()
      .eq("organization_id", access.orgId)
      .eq("id", groupId)

    if (error) return { success: false as const, error: error.message }

    revalidateGroupPaths(existing.campaign_id as string)
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function searchOrganizationalGroupsAction(search: string, limit = 20) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const trimmed = search.trim()
  try {
    let query = access.supabase
      .from("contacts")
      .select("id, full_name, email, contact_type")
      .eq("organization_id", access.orgId)
      .eq("contact_type", "group")
      .order("full_name", { ascending: true })
      .limit(limit)

    if (trimmed.length >= 2) {
      const escaped = trimmed.replace(/[%_\\,]/g, "\\$&")
      query = query.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
    }

    const { data, error } = await query
    if (error) return { success: false as const, error: error.message }

    return {
      success: true as const,
      groups: (data || []).map((row) => ({
        id: row.id as string,
        name: (row.full_name as string) || "Unnamed group",
        email: (row.email as string | null) ?? null,
      })),
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
