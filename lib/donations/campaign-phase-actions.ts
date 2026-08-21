"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  CAMPAIGN_PHASE_SELECT,
  type CampaignPhaseRow,
  type CampaignPhaseWriteInput,
} from "@/lib/donations/campaign-phase-types"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function fetchCampaignPhases(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<CampaignPhaseRow[]> {
  const { data, error } = await supabase
    .from("campaign_phases")
    .select(CAMPAIGN_PHASE_SELECT)
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    // Migration not applied yet — treat as no phases.
    if (error.code === "42P01" || /campaign_phases/i.test(error.message || "")) {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []) as CampaignPhaseRow[]
}

/**
 * Replace campaign phases with the provided list.
 * Existing phase rows kept by id; missing ids are deleted (FK SET NULL on pledges/payments).
 */
export async function syncCampaignPhases(
  organizationId: string,
  campaignId: string,
  phases: CampaignPhaseWriteInput[],
  options?: { goalBreakdownEnabled?: boolean }
): Promise<{ success: true; phases: CampaignPhaseRow[] } | { success: false; error: string }> {
  const writeClient = createServiceRoleClient()

  const { data: campaign, error: campaignError } = await writeClient
    .from("campaigns")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle()

  if (campaignError) {
    return { success: false, error: campaignError.message }
  }
  if (!campaign) {
    return { success: false, error: "Campaign not found" }
  }

  if (options?.goalBreakdownEnabled != null) {
    const { error: flagError } = await writeClient
      .from("campaigns")
      .update({ goal_breakdown_enabled: options.goalBreakdownEnabled })
      .eq("organization_id", organizationId)
      .eq("id", campaignId)

    if (flagError) {
      // Column may not exist until migration 260 is applied.
      if (
        flagError.code !== "42703" &&
        !/goal_breakdown_enabled/i.test(flagError.message || "")
      ) {
        return { success: false, error: flagError.message }
      }
    }
  }

  const normalized = phases
    .map((phase, index) => ({
      id: phase.id?.trim() || null,
      name: phase.name.trim(),
      goal_amount:
        phase.goal_amount == null || Number.isNaN(Number(phase.goal_amount))
          ? null
          : Number(phase.goal_amount),
      start_date: phase.start_date || null,
      deadline: phase.deadline || null,
      sort_order: phase.sort_order ?? index,
      status: (phase.status || "active").toLowerCase(),
    }))
    .filter((phase) => phase.name.length > 0)

  if (!(options?.goalBreakdownEnabled ?? true) || normalized.length === 0) {
    const { error: deleteAllError } = await writeClient
      .from("campaign_phases")
      .delete()
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)

    if (deleteAllError) {
      if (
        deleteAllError.code === "42P01" ||
        /campaign_phases/i.test(deleteAllError.message || "")
      ) {
        return { success: true, phases: [] }
      }
      return { success: false, error: deleteAllError.message }
    }

    return { success: true, phases: [] }
  }

  const { data: existing, error: existingError } = await writeClient
    .from("campaign_phases")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)

  if (existingError) {
    if (
      existingError.code === "42P01" ||
      /campaign_phases/i.test(existingError.message || "")
    ) {
      return {
        success: false,
        error:
          "Campaign phases are not available yet. Run scripts/260_campaign_phases.sql in Supabase.",
      }
    }
    return { success: false, error: existingError.message }
  }

  const keepIds = new Set(
    normalized.map((phase) => phase.id).filter((id): id is string => Boolean(id))
  )
  const toDelete = (existing || [])
    .map((row) => row.id as string)
    .filter((id) => !keepIds.has(id))

  if (toDelete.length > 0) {
    const { error: deleteError } = await writeClient
      .from("campaign_phases")
      .delete()
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)
      .in("id", toDelete)

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }
  }

  for (const phase of normalized) {
    if (phase.id) {
      const { error: updateError } = await writeClient
        .from("campaign_phases")
        .update({
          name: phase.name,
          goal_amount: phase.goal_amount,
          start_date: phase.start_date,
          deadline: phase.deadline,
          sort_order: phase.sort_order,
          status: phase.status,
        })
        .eq("organization_id", organizationId)
        .eq("campaign_id", campaignId)
        .eq("id", phase.id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }
      continue
    }

    const { error: insertError } = await writeClient.from("campaign_phases").insert({
      organization_id: organizationId,
      campaign_id: campaignId,
      name: phase.name,
      goal_amount: phase.goal_amount,
      start_date: phase.start_date,
      deadline: phase.deadline,
      sort_order: phase.sort_order,
      status: phase.status,
    })

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  try {
    const synced = await fetchCampaignPhases(writeClient, organizationId, campaignId)
    return { success: true, phases: synced }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}
