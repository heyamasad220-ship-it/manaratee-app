"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  attachWishlistFundingMetrics,
  fetchCampaignWishlistItems,
  mapCampaignWishlistItemRow,
  mapWishlistWriteDefaults,
  asWishlistRecord,
} from "@/lib/donations/campaign-wishlist-helpers"
import {
  CAMPAIGN_WISHLIST_SELECT,
  type CampaignWishlistItemMetric,
  type CampaignWishlistWriteInput,
} from "@/lib/donations/campaign-wishlist-types"
import {
  ORGANIZATION_AUDIT_ACTIONS,
  writeOrganizationAuditLog,
} from "@/lib/audit/organization-audit-log"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function createPublicToken() {
  return randomUUID().replace(/-/g, "")
}

function revalidateWishlistPaths(campaignId: string) {
  revalidatePath(`/donations/campaigns/${campaignId}`)
  revalidatePath("/donations/campaigns")
  revalidatePath("/donations/reports/campaigns")
  revalidatePath("/donations")
}

function requireWishlistRow(data: unknown, errorMessage = "Wishlist item not found.") {
  const row = mapCampaignWishlistItemRow(asWishlistRecord(data))
  if (!row.id) throw new Error(errorMessage)
  return row
}

async function loadNameMaps(orgId: string, items: { fund_id: string | null; department_id: string | null }[]) {
  const fundIds = [...new Set(items.map((item) => item.fund_id).filter(Boolean))] as string[]
  const departmentIds = [...new Set(items.map((item) => item.department_id).filter(Boolean))] as string[]
  const writeClient = createServiceRoleClient()
  const fundNames = new Map<string, string>()
  const departmentNames = new Map<string, string>()

  if (fundIds.length > 0) {
    const { data } = await writeClient
      .from("donation_subcategories")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", fundIds)
    for (const row of data || []) fundNames.set(row.id as string, String(row.name || "Fund"))
  }
  if (departmentIds.length > 0) {
    const { data } = await writeClient
      .from("departments")
      .select("id, name")
      .eq("organization_id", orgId)
      .in("id", departmentIds)
    for (const row of data || []) {
      departmentNames.set(row.id as string, String(row.name || "Department"))
    }
  }

  return { fundNames, departmentNames }
}

async function assertSameCampaignItem(
  supabase: ReturnType<typeof createServiceRoleClient>,
  orgId: string,
  campaignId: string,
  itemId: string | null | undefined
) {
  if (!itemId) return
  const { data, error } = await supabase
    .from("campaign_wishlist_items")
    .select("id, campaign_id, organization_id")
    .eq("id", itemId)
    .eq("organization_id", orgId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("Wishlist item not found.")
  const item = requireWishlistRow(data)
  if (item.campaign_id !== campaignId) {
    throw new Error("Wishlist item must belong to the selected campaign.")
  }
}

export async function listCampaignWishlistItemsAction(campaignId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const items = await fetchCampaignWishlistItems(access.supabase, access.orgId, campaignId)
    const names = await loadNameMaps(access.orgId, items)
    const metrics = await attachWishlistFundingMetrics(
      createServiceRoleClient(),
      access.orgId,
      items,
      names
    )
    return { success: true as const, items: metrics }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load wishlist",
    }
  }
}

export async function listWishlistItemsForCampaignPickerAction(campaignId: string | null) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  if (!campaignId) return { success: true as const, items: [] as Array<{ id: string; name: string }> }

  try {
    const items = await fetchCampaignWishlistItems(access.supabase, access.orgId, campaignId)
    return {
      success: true as const,
      items: items
        .filter((item) => item.project_status !== "cancelled")
        .map((item) => ({ id: item.id, name: item.name })),
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load wishlist items",
    }
  }
}

export async function createCampaignWishlistItemAction(
  campaignId: string,
  input: CampaignWishlistWriteInput
) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const payload = mapWishlistWriteDefaults(input)
    const writeClient = createServiceRoleClient()

    const { data: campaign, error: campaignError } = await writeClient
      .from("campaigns")
      .select("id, organization_id")
      .eq("id", campaignId)
      .eq("organization_id", access.orgId)
      .maybeSingle()
    if (campaignError) throw new Error(campaignError.message)
    if (!campaign) return { success: false as const, error: "Campaign not found." }

    if (payload.fund_id) {
      const { data: fund } = await writeClient
        .from("donation_subcategories")
        .select("id")
        .eq("id", payload.fund_id)
        .eq("organization_id", access.orgId)
        .maybeSingle()
      if (!fund) return { success: false as const, error: "Fund must belong to this organization." }
    }
    if (payload.department_id) {
      const { data: department } = await writeClient
        .from("departments")
        .select("id")
        .eq("id", payload.department_id)
        .eq("organization_id", access.orgId)
        .maybeSingle()
      if (!department) {
        return { success: false as const, error: "Department must belong to this organization." }
      }
    }
    if (payload.campaign_phase_id) {
      const { data: phase } = await writeClient
        .from("campaign_phases")
        .select("id")
        .eq("id", payload.campaign_phase_id)
        .eq("campaign_id", campaignId)
        .eq("organization_id", access.orgId)
        .maybeSingle()
      if (!phase) return { success: false as const, error: "Phase must belong to this campaign." }
    }

    const { data, error } = await writeClient
      .from("campaign_wishlist_items")
      .insert({
        organization_id: access.orgId,
        campaign_id: campaignId,
        public_token: createPublicToken(),
        created_by: access.userId,
        updated_by: access.userId,
        ...payload,
      })
      .select(CAMPAIGN_WISHLIST_SELECT)
      .single()

    if (error || !data) throw new Error(error?.message || "Could not create wishlist item.")
    const created = requireWishlistRow(data)

    await writeOrganizationAuditLog({
      organizationId: access.orgId,
      category: "financial",
      action: ORGANIZATION_AUDIT_ACTIONS.PLEDGE_UPDATED,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
      targetType: "campaign_wishlist_item",
      targetId: created.id,
      targetLabel: payload.name,
      summary: `Created wishlist item ${payload.name}`,
      metadata: { campaignId, target_amount: payload.target_amount },
    })

    revalidateWishlistPaths(campaignId)
    return { success: true as const, item: created }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not create wishlist item",
    }
  }
}

export async function updateCampaignWishlistItemAction(
  itemId: string,
  input: CampaignWishlistWriteInput
) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const payload = mapWishlistWriteDefaults(input)
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaign_wishlist_items")
      .select(CAMPAIGN_WISHLIST_SELECT)
      .eq("id", itemId)
      .eq("organization_id", access.orgId)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    if (!existing) return { success: false as const, error: "Wishlist item not found." }
    const current = requireWishlistRow(existing)

    if (payload.project_status === "completed" && !payload.actual_completion_date) {
      payload.actual_completion_date = new Date().toISOString().slice(0, 10)
    }

    const { data, error } = await writeClient
      .from("campaign_wishlist_items")
      .update({
        ...payload,
        updated_by: access.userId,
      })
      .eq("id", itemId)
      .eq("organization_id", access.orgId)
      .select(CAMPAIGN_WISHLIST_SELECT)
      .single()

    if (error || !data) throw new Error(error?.message || "Could not update wishlist item.")
    const updated = requireWishlistRow(data)

    await writeOrganizationAuditLog({
      organizationId: access.orgId,
      category: "financial",
      action: ORGANIZATION_AUDIT_ACTIONS.PLEDGE_UPDATED,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
      targetType: "campaign_wishlist_item",
      targetId: itemId,
      targetLabel: payload.name,
      summary: `Updated wishlist item ${payload.name}`,
      metadata: {
        project_status: payload.project_status,
        public_visible: payload.public_visible,
        target_amount: payload.target_amount,
      },
    })

    revalidateWishlistPaths(current.campaign_id)
    return { success: true as const, item: updated }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not update wishlist item",
    }
  }
}

export async function archiveCampaignWishlistItemAction(itemId: string) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  const writeClient = createServiceRoleClient()
  const { data: existing } = await writeClient
    .from("campaign_wishlist_items")
    .select("id, campaign_id, name")
    .eq("id", itemId)
    .eq("organization_id", access.orgId)
    .maybeSingle()
  if (!existing) return { success: false as const, error: "Wishlist item not found." }
  const current = requireWishlistRow(existing)

  const { error } = await writeClient
    .from("campaign_wishlist_items")
    .update({
      archived_at: new Date().toISOString(),
      public_visible: false,
      link_active: false,
      updated_by: access.userId,
    })
    .eq("id", itemId)
    .eq("organization_id", access.orgId)

  if (error) return { success: false as const, error: error.message }

  await writeOrganizationAuditLog({
    organizationId: access.orgId,
    category: "financial",
    action: ORGANIZATION_AUDIT_ACTIONS.PLEDGE_UPDATED,
    actorUserId: access.userId,
    actorEmail: access.userEmail,
    targetType: "campaign_wishlist_item",
    targetId: itemId,
    targetLabel: current.name,
    summary: `Archived wishlist item ${current.name}`,
  })

  revalidateWishlistPaths(current.campaign_id)
  return { success: true as const }
}

export async function reorderCampaignWishlistItemsAction(campaignId: string, itemIds: string[]) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  const writeClient = createServiceRoleClient()
  for (let index = 0; index < itemIds.length; index += 1) {
    const { error } = await writeClient
      .from("campaign_wishlist_items")
      .update({ sort_order: index, updated_by: access.userId })
      .eq("id", itemIds[index])
      .eq("campaign_id", campaignId)
      .eq("organization_id", access.orgId)
    if (error) return { success: false as const, error: error.message }
  }

  revalidateWishlistPaths(campaignId)
  return { success: true as const }
}

export async function carryForwardWishlistItemAction(input: {
  itemId: string
  destinationCampaignId: string
}) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const writeClient = createServiceRoleClient()
    const { data: source, error: sourceError } = await writeClient
      .from("campaign_wishlist_items")
      .select(CAMPAIGN_WISHLIST_SELECT)
      .eq("id", input.itemId)
      .eq("organization_id", access.orgId)
      .maybeSingle()
    if (sourceError) throw new Error(sourceError.message)
    if (!source) return { success: false as const, error: "Wishlist item not found." }
    const sourceItem = requireWishlistRow(source)
    if (sourceItem.carried_to_item_id) {
      return { success: false as const, error: "This item has already been carried forward." }
    }
    if (sourceItem.campaign_id === input.destinationCampaignId) {
      return { success: false as const, error: "Choose a different destination campaign." }
    }

    const { data: destination, error: destError } = await writeClient
      .from("campaigns")
      .select("id, organization_id, name")
      .eq("id", input.destinationCampaignId)
      .eq("organization_id", access.orgId)
      .maybeSingle()
    if (destError) throw new Error(destError.message)
    if (!destination) return { success: false as const, error: "Destination campaign not found." }

    const metrics = await attachWishlistFundingMetrics(writeClient, access.orgId, [sourceItem])
    const sourceMetric = metrics[0]
    const previousFunding = sourceMetric?.lifetimeCollected ?? sourceItem.previous_funding_amount
    const remainingNeed = Math.max(sourceItem.target_amount - previousFunding, 0)

    const { data: created, error: createError } = await writeClient
      .from("campaign_wishlist_items")
      .insert({
        organization_id: access.orgId,
        campaign_id: input.destinationCampaignId,
        name: sourceItem.name,
        item_type: sourceItem.item_type,
        description: sourceItem.description,
        target_amount: sourceItem.target_amount,
        priority: sourceItem.priority,
        project_status:
          sourceItem.project_status === "completed" || sourceItem.project_status === "cancelled"
            ? "planned"
            : sourceItem.project_status,
        target_completion_date: null,
        actual_completion_date: null,
        completion_notes: null,
        fund_id: sourceItem.fund_id,
        department_id: sourceItem.department_id,
        campaign_phase_id: null,
        public_visible: sourceItem.public_visible,
        public_token: createPublicToken(),
        link_active: true,
        carry_forward_enabled: true,
        carried_from_item_id: sourceItem.id,
        previous_funding_amount: previousFunding,
        remaining_need_at_carry_forward: remainingNeed,
        sort_order: 0,
        notes: sourceItem.notes,
        image_url: sourceItem.image_url,
        created_by: access.userId,
        updated_by: access.userId,
      })
      .select(CAMPAIGN_WISHLIST_SELECT)
      .single()

    if (createError || !created) throw new Error(createError?.message || "Could not carry forward.")
    const createdItem = requireWishlistRow(created)

    const { error: linkError } = await writeClient
      .from("campaign_wishlist_items")
      .update({
        carried_to_item_id: createdItem.id,
        carry_forward_enabled: true,
        updated_by: access.userId,
      })
      .eq("id", sourceItem.id)
      .eq("organization_id", access.orgId)

    if (linkError) throw new Error(linkError.message)

    await writeOrganizationAuditLog({
      organizationId: access.orgId,
      category: "financial",
      action: ORGANIZATION_AUDIT_ACTIONS.PLEDGE_UPDATED,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
      targetType: "campaign_wishlist_item",
      targetId: createdItem.id,
      targetLabel: sourceItem.name,
      summary: `Carried wishlist item ${sourceItem.name} to another campaign`,
      metadata: {
        fromItemId: sourceItem.id,
        toItemId: createdItem.id,
        previousFunding,
        remainingNeed,
      },
    })

    revalidateWishlistPaths(sourceItem.campaign_id)
    revalidateWishlistPaths(input.destinationCampaignId)
    return {
      success: true as const,
      item: createdItem,
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not carry forward wishlist item",
    }
  }
}

export async function listOrgCampaignsForCarryForwardAction(excludeCampaignId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("campaigns")
    .select("id, name, status")
    .eq("organization_id", access.orgId)
    .neq("id", excludeCampaignId)
    .order("name")

  if (error) return { success: false as const, error: error.message }
  return {
    success: true as const,
    campaigns: (data || []).map((row) => ({
      id: row.id as string,
      name: String(row.name || "Untitled campaign"),
      status: String(row.status || ""),
    })),
  }
}

export async function getWishlistItemDetailAction(itemId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const writeClient = createServiceRoleClient()
    const { data, error } = await writeClient
      .from("campaign_wishlist_items")
      .select(CAMPAIGN_WISHLIST_SELECT)
      .eq("id", itemId)
      .eq("organization_id", access.orgId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return { success: false as const, error: "Wishlist item not found." }

    const item = requireWishlistRow(data)
    const names = await loadNameMaps(access.orgId, [item])
    const [metric] = await attachWishlistFundingMetrics(writeClient, access.orgId, [item], names)

    const [{ data: payments }, { data: campaign }, { data: pledgeIds }] = await Promise.all([
      writeClient
        .from("payments")
        .select("id, donor_id, sender_name, amount, refunded_amount, status, payment_date, pledge_id")
        .eq("organization_id", access.orgId)
        .eq("wishlist_item_id", itemId)
        .order("payment_date", { ascending: false })
        .limit(100),
      writeClient.from("campaigns").select("id, name").eq("id", item.campaign_id).maybeSingle(),
      writeClient
        .from("pledges")
        .select("id")
        .eq("organization_id", access.orgId)
        .eq("wishlist_item_id", itemId),
    ])

    const idSet = new Set((pledgeIds || []).map((row) => row.id as string))
    let pledgeRows: Array<Record<string, unknown>> = []
    if (idSet.size > 0) {
      const { data: itemPledges } = await writeClient
        .from("pledge_status_view")
        .select(
          "id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
        )
        .eq("organization_id", access.orgId)
        .in("id", [...idSet])
      pledgeRows = (itemPledges || []) as Array<Record<string, unknown>>
    }

    return {
      success: true as const,
      item: {
        ...metric,
        campaignName: campaign?.name ? String(campaign.name) : null,
      } as CampaignWishlistItemMetric,
      pledges: pledgeRows,
      payments: payments || [],
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load wishlist item",
    }
  }
}

export async function listCampaignWishlistReportAction() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const writeClient = createServiceRoleClient()
    const { data, error } = await writeClient
      .from("campaign_wishlist_items")
      .select(CAMPAIGN_WISHLIST_SELECT)
      .eq("organization_id", access.orgId)
      .is("archived_at", null)
      .order("campaign_id")
      .order("sort_order")
    if (error) throw new Error(error.message)

    const items = (data || []).map((row) => mapCampaignWishlistItemRow(asWishlistRecord(row)))
    const names = await loadNameMaps(access.orgId, items)
    const metrics = await attachWishlistFundingMetrics(writeClient, access.orgId, items, names)

    const campaignIds = [...new Set(metrics.map((item) => item.campaign_id))]
    const campaignNames = new Map<string, string>()
    if (campaignIds.length > 0) {
      const { data: campaigns } = await writeClient
        .from("campaigns")
        .select("id, name")
        .eq("organization_id", access.orgId)
        .in("id", campaignIds)
      for (const row of campaigns || []) {
        campaignNames.set(row.id as string, String(row.name || "Campaign"))
      }
    }

    return {
      success: true as const,
      items: metrics.map((item) => ({
        ...item,
        campaignName: campaignNames.get(item.campaign_id) ?? null,
      })),
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load wishlist report",
    }
  }
}

export async function validateWishlistAttributionAction(input: {
  campaignId: string | null
  wishlistItemId: string | null
}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  if (!input.wishlistItemId) return { success: true as const }
  if (!input.campaignId) {
    return { success: false as const, error: "Select a campaign before attributing a wishlist item." }
  }
  try {
    await assertSameCampaignItem(
      createServiceRoleClient(),
      access.orgId,
      input.campaignId,
      input.wishlistItemId
    )
    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Invalid wishlist attribution",
    }
  }
}
