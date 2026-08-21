"use server"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  CAMPAIGN_PROSPECT_ASKED_STAGES,
  CAMPAIGN_PROSPECT_SELECT,
  isProspectFollowUpOverdue,
  normalizeProspectStage,
  type CampaignProspectStage,
} from "@/lib/donations/campaign-prospect-types"
import {
  computeCampaignGroupMetrics,
  fetchCampaignGroups,
} from "@/lib/donations/campaign-group-actions"
import {
  type CampaignPaymentRow,
  type CampaignPledgeRow,
} from "@/lib/donations/campaign-analytics"
import { donationCampaignWorkspaceHref } from "@/lib/donations/campaign-workspace-paths"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type CampaignOverviewActionItem = {
  id: string
  label: string
  href: string
  severity: "urgent" | "attention" | "info"
}

export type CampaignTeamMetricRow = {
  assigneeContactId: string | null
  assigneeName: string
  assignedCount: number
  overdueCount: number
  askedCount: number
  pledgedCount: number
  openPipelineCount: number
  suggestedAskTotal: number
}

export type CampaignGroupOverviewRow = {
  groupId: string
  name: string
  goalAmount: number | null
  collected: number
  pledged: number
  progressPercent: number | null
  donorCount: number
}

export type CampaignOverviewInsights = {
  actionItems: CampaignOverviewActionItem[]
  teamMetrics: CampaignTeamMetricRow[]
  groups: CampaignGroupOverviewRow[]
  groupsCollectedTotal: number
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(days: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function isOpenPipelineStage(stage: CampaignProspectStage) {
  return (
    stage !== "pledged" &&
    stage !== "declined" &&
    stage !== "no_response"
  )
}

export async function getCampaignOverviewInsightsAction(campaignId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const writeClient = createServiceRoleClient()
    const today = todayIsoDate()
    const upcomingEnd = addDaysIso(7)

    const { data: prospectRows, error: prospectError } = await writeClient
      .from("campaign_prospects")
      .select(CAMPAIGN_PROSPECT_SELECT)
      .eq("organization_id", access.orgId)
      .eq("campaign_id", campaignId)

    if (prospectError) {
      if (
        prospectError.code === "42P01" ||
        /campaign_prospects/i.test(prospectError.message || "")
      ) {
        return {
          success: true as const,
          insights: {
            actionItems: [],
            teamMetrics: [],
            groups: [],
            groupsCollectedTotal: 0,
          } satisfies CampaignOverviewInsights,
        }
      }
      return { success: false as const, error: prospectError.message }
    }

    const prospects = (prospectRows || []).map((row) => ({
      id: row.id as string,
      contact_id: row.contact_id as string,
      assigned_to_contact_id: (row.assigned_to_contact_id as string | null) ?? null,
      stage: normalizeProspectStage(row.stage as string),
      suggested_ask_amount:
        row.suggested_ask_amount == null ? null : Number(row.suggested_ask_amount),
      next_follow_up_at: (row.next_follow_up_at as string | null) ?? null,
      converted_pledge_id: (row.converted_pledge_id as string | null) ?? null,
    }))

    const contactIds = new Set<string>()
    for (const prospect of prospects) {
      if (prospect.assigned_to_contact_id) contactIds.add(prospect.assigned_to_contact_id)
    }

    const groups = await fetchCampaignGroups(writeClient, access.orgId, campaignId)
    for (const group of groups) {
      if (group.lead_contact_id) contactIds.add(group.lead_contact_id)
      if (group.organizational_group_id) contactIds.add(group.organizational_group_id)
    }

    const contactNames = new Map<string, string>()
    if (contactIds.size > 0) {
      const { data: contacts } = await writeClient
        .from("contacts")
        .select("id, full_name")
        .eq("organization_id", access.orgId)
        .in("id", [...contactIds])
      for (const contact of contacts || []) {
        contactNames.set(contact.id as string, (contact.full_name as string) || "Unnamed")
      }
    }

    const overdue = prospects.filter((prospect) =>
      isProspectFollowUpOverdue(prospect.next_follow_up_at, prospect.stage)
    )
    const upcoming = prospects.filter((prospect) => {
      if (!prospect.next_follow_up_at) return false
      if (!isOpenPipelineStage(prospect.stage)) return false
      return (
        prospect.next_follow_up_at >= today && prospect.next_follow_up_at <= upcomingEnd
      )
    })
    const unassigned = prospects.filter(
      (prospect) => !prospect.assigned_to_contact_id && isOpenPipelineStage(prospect.stage)
    )
    const askedWithoutPledge = prospects.filter(
      (prospect) =>
        prospect.stage === "asked" && !prospect.converted_pledge_id
    )

    const actionItems: CampaignOverviewActionItem[] = []
    if (overdue.length > 0) {
      actionItems.push({
        id: "overdue-follow-ups",
        label: `${overdue.length} overdue prospect follow-up${overdue.length === 1 ? "" : "s"}`,
        href: donationCampaignWorkspaceHref(campaignId, {
          tab: "prospects",
          followUp: "overdue",
        }),
        severity: "urgent",
      })
    }
    if (upcoming.length > 0) {
      actionItems.push({
        id: "upcoming-follow-ups",
        label: `${upcoming.length} follow-up${upcoming.length === 1 ? "" : "s"} due in the next 7 days`,
        href: donationCampaignWorkspaceHref(campaignId, {
          tab: "prospects",
          followUp: "upcoming",
        }),
        severity: "attention",
      })
    }
    if (unassigned.length > 0) {
      actionItems.push({
        id: "unassigned-prospects",
        label: `${unassigned.length} open prospect${unassigned.length === 1 ? "" : "s"} unassigned`,
        href: donationCampaignWorkspaceHref(campaignId, {
          tab: "prospects",
          assignee: "unassigned",
        }),
        severity: "attention",
      })
    }
    if (askedWithoutPledge.length > 0) {
      actionItems.push({
        id: "asked-without-pledge",
        label: `${askedWithoutPledge.length} asked prospect${askedWithoutPledge.length === 1 ? "" : "s"} still need a pledge`,
        href: donationCampaignWorkspaceHref(campaignId, {
          tab: "prospects",
          stage: "asked",
          pledged: "not_pledged",
        }),
        severity: "info",
      })
    }

    const teamMap = new Map<string, CampaignTeamMetricRow>()
    const ensureTeamRow = (assigneeContactId: string | null): CampaignTeamMetricRow => {
      const key = assigneeContactId || "__unassigned__"
      let row = teamMap.get(key)
      if (!row) {
        row = {
          assigneeContactId,
          assigneeName: assigneeContactId
            ? contactNames.get(assigneeContactId) || "Unknown"
            : "Unassigned",
          assignedCount: 0,
          overdueCount: 0,
          askedCount: 0,
          pledgedCount: 0,
          openPipelineCount: 0,
          suggestedAskTotal: 0,
        }
        teamMap.set(key, row)
      }
      return row
    }

    for (const prospect of prospects) {
      const row = ensureTeamRow(prospect.assigned_to_contact_id)
      row.assignedCount += 1
      if (isProspectFollowUpOverdue(prospect.next_follow_up_at, prospect.stage)) {
        row.overdueCount += 1
      }
      if (CAMPAIGN_PROSPECT_ASKED_STAGES.includes(prospect.stage)) {
        row.askedCount += 1
      }
      if (prospect.stage === "pledged") {
        row.pledgedCount += 1
      }
      if (isOpenPipelineStage(prospect.stage)) {
        row.openPipelineCount += 1
      }
      row.suggestedAskTotal += Number(prospect.suggested_ask_amount || 0)
    }

    const teamMetrics = [...teamMap.values()].sort((a, b) => {
      if (a.assigneeContactId == null) return 1
      if (b.assigneeContactId == null) return -1
      if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount
      return b.assignedCount - a.assignedCount
    })

    // Group metrics from ledger
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
          pledges.map((pledge) => pledge.id)
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
        }))
      }
    }

    const groupMetrics = computeCampaignGroupMetrics({
      groups,
      campaignId,
      pledges,
      payments,
      contactNames,
    })

    const groupRows: CampaignGroupOverviewRow[] = groupMetrics
      .map((row) => ({
        groupId: row.groupId,
        name: row.name,
        goalAmount: row.goalAmount,
        collected: row.collected,
        pledged: row.pledged,
        progressPercent: row.progressPercent,
        donorCount: row.donorCount,
      }))
      .sort((a, b) => b.collected - a.collected)

    const groupsBelowGoal = groupRows.filter(
      (row) =>
        row.goalAmount != null &&
        row.goalAmount > 0 &&
        row.collected < row.goalAmount
    )
    if (groupsBelowGoal.length > 0 && groupRows.length > 0) {
      actionItems.push({
        id: "groups-below-goal",
        label: `${groupsBelowGoal.length} campaign group${groupsBelowGoal.length === 1 ? "" : "s"} below goal`,
        href: donationCampaignWorkspaceHref(campaignId, { tab: "groups" }),
        severity: "info",
      })
    }

    return {
      success: true as const,
      insights: {
        actionItems,
        teamMetrics,
        groups: groupRows,
        groupsCollectedTotal: groupRows.reduce((sum, row) => sum + row.collected, 0),
      } satisfies CampaignOverviewInsights,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
