"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  CAMPAIGN_ASK_LEVEL_SELECT,
  type CampaignAskLevelRow,
  type CampaignAskLevelWriteInput,
} from "@/lib/donations/campaign-ask-level-types"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { revalidatePath } from "next/cache"

export async function fetchCampaignAskLevels(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<CampaignAskLevelRow[]> {
  const { data, error } = await supabase
    .from("campaign_ask_levels")
    .select(CAMPAIGN_ASK_LEVEL_SELECT)
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .order("sort_order", { ascending: true })
    .order("ask_amount", { ascending: false })

  if (error) {
    if (error.code === "42P01" || /campaign_ask_levels/i.test(error.message || "")) {
      return []
    }
    throw new Error(error.message)
  }

  return ((data || []) as CampaignAskLevelRow[]).map((row) => ({
    ...row,
    ask_amount: Number(row.ask_amount),
    target_count: Number(row.target_count || 0),
    sort_order: Number(row.sort_order || 0),
  }))
}

export async function syncCampaignAskLevels(
  organizationId: string,
  campaignId: string,
  levels: CampaignAskLevelWriteInput[]
): Promise<{ success: true; levels: CampaignAskLevelRow[] } | { success: false; error: string }> {
  const writeClient = createServiceRoleClient()

  const { data: campaign, error: campaignError } = await writeClient
    .from("campaigns")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle()

  if (campaignError) return { success: false, error: campaignError.message }
  if (!campaign) return { success: false, error: "Campaign not found" }

  const normalized = levels
    .map((level, index) => ({
      id: level.id?.trim() || null,
      ask_amount: Number(level.ask_amount),
      target_count: Math.max(0, Math.floor(Number(level.target_count) || 0)),
      campaign_phase_id: null,
      sort_order: level.sort_order ?? index,
    }))
    .filter((level) => Number.isFinite(level.ask_amount) && level.ask_amount > 0)

  const { data: existing, error: existingError } = await writeClient
    .from("campaign_ask_levels")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)

  if (existingError) {
    if (
      existingError.code === "42P01" ||
      /campaign_ask_levels/i.test(existingError.message || "")
    ) {
      return {
        success: false,
        error:
          "Ask levels are not available yet. Run scripts/261_campaign_ask_levels.sql in Supabase.",
      }
    }
    return { success: false, error: existingError.message }
  }

  const keepIds = new Set(
    normalized.map((level) => level.id).filter((id): id is string => Boolean(id))
  )
  const toDelete = (existing || [])
    .map((row) => row.id as string)
    .filter((id) => !keepIds.has(id))

  if (toDelete.length > 0) {
    const { error: deleteError } = await writeClient
      .from("campaign_ask_levels")
      .delete()
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .in("id", toDelete)

    if (deleteError) return { success: false, error: deleteError.message }
  }

  for (const level of normalized) {
    if (level.id) {
      const { error: updateError } = await writeClient
        .from("campaign_ask_levels")
        .update({
          ask_amount: level.ask_amount,
          target_count: level.target_count,
          campaign_phase_id: level.campaign_phase_id,
          sort_order: level.sort_order,
        })
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .eq("id", level.id)

      if (updateError) return { success: false, error: updateError.message }
      continue
    }

    const { error: insertError } = await writeClient.from("campaign_ask_levels").insert({
      organization_id: organizationId,
      campaign_id: campaignId,
      ask_amount: level.ask_amount,
      target_count: level.target_count,
      campaign_phase_id: level.campaign_phase_id,
      sort_order: level.sort_order,
    })

    if (insertError) return { success: false, error: insertError.message }
  }

  try {
    const synced = await fetchCampaignAskLevels(writeClient, organizationId, campaignId)
    return { success: true, levels: synced }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

export async function saveCampaignAskLevelsAction(
  campaignId: string,
  levels: CampaignAskLevelWriteInput[]
) {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false as const, error: access.error }

  if (!campaignId.trim()) {
    return { success: false as const, error: "Campaign is required" }
  }

  const result = await syncCampaignAskLevels(access.orgId, campaignId, levels)
  if (!result.success) {
    return { success: false as const, error: result.error }
  }

  revalidatePath(`/donations/campaigns/${campaignId}`)
  revalidatePath("/donations/campaigns")

  return { success: true as const, levels: result.levels }
}
