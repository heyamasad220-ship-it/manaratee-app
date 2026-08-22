import type { SupabaseClient } from "@supabase/supabase-js"

import {
  CAMPAIGN_WISHLIST_SELECT,
  normalizeWishlistItemType,
  normalizeWishlistPriority,
  normalizeWishlistProjectStatus,
  type CampaignWishlistItemMetric,
  type CampaignWishlistItemRow,
  type WishlistItemType,
  type WishlistPriority,
  type WishlistProjectStatus,
} from "@/lib/donations/campaign-wishlist-types"
import {
  computeWishlistFunding,
  isOpenWishlistPledgeStatus,
  wishlistPaymentNet,
} from "@/lib/donations/campaign-wishlist-funding"

export function asWishlistRecord(data: unknown): Record<string, unknown> {
  return (data ?? {}) as Record<string, unknown>
}

export function mapCampaignWishlistItemRow(row: Record<string, unknown>): CampaignWishlistItemRow {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    campaign_id: row.campaign_id as string,
    name: String(row.name || "").trim(),
    item_type: normalizeWishlistItemType(row.item_type as string | null),
    description: (row.description as string | null) ?? null,
    target_amount: Number(row.target_amount || 0),
    priority: normalizeWishlistPriority(row.priority as string | null),
    project_status: normalizeWishlistProjectStatus(row.project_status as string | null),
    target_completion_date: (row.target_completion_date as string | null) ?? null,
    actual_completion_date: (row.actual_completion_date as string | null) ?? null,
    completion_notes: (row.completion_notes as string | null) ?? null,
    fund_id: (row.fund_id as string | null) ?? null,
    department_id: (row.department_id as string | null) ?? null,
    campaign_phase_id: (row.campaign_phase_id as string | null) ?? null,
    public_visible: Boolean(row.public_visible),
    public_token: String(row.public_token || ""),
    link_active: row.link_active !== false,
    carry_forward_enabled: Boolean(row.carry_forward_enabled),
    carried_from_item_id: (row.carried_from_item_id as string | null) ?? null,
    carried_to_item_id: (row.carried_to_item_id as string | null) ?? null,
    previous_funding_amount: Number(row.previous_funding_amount || 0),
    remaining_need_at_carry_forward:
      row.remaining_need_at_carry_forward == null
        ? null
        : Number(row.remaining_need_at_carry_forward),
    sort_order: Number(row.sort_order || 0),
    notes: (row.notes as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
    archived_at: (row.archived_at as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  }
}

export async function fetchCampaignWishlistItems(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
) {
  const { data, error } = await supabase
    .from("campaign_wishlist_items")
    .select(CAMPAIGN_WISHLIST_SELECT)
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return (data || []).map((row) => mapCampaignWishlistItemRow(asWishlistRecord(row)))
}

export async function attachWishlistFundingMetrics(
  supabase: SupabaseClient,
  organizationId: string,
  items: CampaignWishlistItemRow[],
  names?: { fundNames?: Map<string, string>; departmentNames?: Map<string, string> }
): Promise<CampaignWishlistItemMetric[]> {
  if (items.length === 0) return []

  const itemIds = items.map((item) => item.id)

  const { data: pledges, error: pledgesError } = await supabase
    .from("pledges")
    .select("id, wishlist_item_id, amount_pledged, status")
    .eq("organization_id", organizationId)
    .in("wishlist_item_id", itemIds)

  if (pledgesError) throw new Error(pledgesError.message)

  const pledgedByItem = new Map<string, number>()
  const pledgeIdsByItem = new Map<string, string[]>()
  const allPledgeIds: string[] = []
  for (const row of pledges || []) {
    const itemId = row.wishlist_item_id as string | null
    if (!itemId || !isOpenWishlistPledgeStatus(row.status as string | null)) continue
    pledgedByItem.set(itemId, (pledgedByItem.get(itemId) || 0) + Number(row.amount_pledged || 0))
    const list = pledgeIdsByItem.get(itemId) || []
    list.push(row.id as string)
    pledgeIdsByItem.set(itemId, list)
    allPledgeIds.push(row.id as string)
  }

  const paymentFilters = [`wishlist_item_id.in.(${itemIds.join(",")})`]
  if (allPledgeIds.length > 0) {
    paymentFilters.push(`pledge_id.in.(${allPledgeIds.join(",")})`)
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, wishlist_item_id, pledge_id, amount, refunded_amount, status")
    .eq("organization_id", organizationId)
    .or(paymentFilters.join(","))

  if (paymentsError) throw new Error(paymentsError.message)

  const pledgeItemByPledgeId = new Map<string, string>()
  for (const [itemId, pledgeIds] of pledgeIdsByItem) {
    for (const pledgeId of pledgeIds) pledgeItemByPledgeId.set(pledgeId, itemId)
  }

  const collectedByItem = new Map<string, number>()
  const countedPaymentIds = new Set<string>()

  for (const row of payments || []) {
    const paymentId = String(row.id)
    if (countedPaymentIds.has(paymentId)) continue
    const direct = (row.wishlist_item_id as string | null) || null
    const inherited = !direct && row.pledge_id ? pledgeItemByPledgeId.get(String(row.pledge_id)) ?? null : null
    const itemId = direct || inherited
    if (!itemId) continue
    countedPaymentIds.add(paymentId)
    collectedByItem.set(itemId, (collectedByItem.get(itemId) || 0) + wishlistPaymentNet(row))
  }

  return items.map((item) => {
    const funding = computeWishlistFunding({
      targetAmount: item.target_amount,
      previousFundingAmount: item.previous_funding_amount,
      pledged: pledgedByItem.get(item.id) || 0,
      collected: collectedByItem.get(item.id) || 0,
    })
    return {
      ...item,
      ...funding,
      fundName: item.fund_id ? names?.fundNames?.get(item.fund_id) ?? null : null,
      departmentName: item.department_id
        ? names?.departmentNames?.get(item.department_id) ?? null
        : null,
    }
  })
}

export function mapWishlistWriteDefaults(input: {
  name: string
  item_type?: string
  description?: string | null
  target_amount: number
  priority?: string
  project_status?: string
  target_completion_date?: string | null
  actual_completion_date?: string | null
  completion_notes?: string | null
  fund_id?: string | null
  department_id?: string | null
  campaign_phase_id?: string | null
  public_visible?: boolean
  link_active?: boolean
  carry_forward_enabled?: boolean
  sort_order?: number
  notes?: string | null
  image_url?: string | null
}) {
  const name = String(input.name || "").trim()
  const target = Number(input.target_amount)
  if (!name) throw new Error("Item name is required.")
  if (!Number.isFinite(target) || target < 0) {
    throw new Error("Target amount must be zero or greater.")
  }

  return {
    name,
    item_type: normalizeWishlistItemType(input.item_type) as WishlistItemType,
    description: input.description?.trim() || null,
    target_amount: target,
    priority: normalizeWishlistPriority(input.priority) as WishlistPriority,
    project_status: normalizeWishlistProjectStatus(input.project_status) as WishlistProjectStatus,
    target_completion_date: input.target_completion_date || null,
    actual_completion_date: input.actual_completion_date || null,
    completion_notes: input.completion_notes?.trim() || null,
    fund_id: input.fund_id || null,
    department_id: input.department_id || null,
    campaign_phase_id: input.campaign_phase_id || null,
    public_visible: Boolean(input.public_visible),
    link_active: input.link_active !== false,
    carry_forward_enabled: Boolean(input.carry_forward_enabled),
    sort_order: Number(input.sort_order || 0),
    notes: input.notes?.trim() || null,
    image_url: input.image_url?.trim() || null,
  }
}
