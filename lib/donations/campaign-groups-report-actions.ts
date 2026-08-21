"use server"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  computeCampaignGroupMetrics,
  fetchCampaignGroups,
} from "@/lib/donations/campaign-group-helpers"
import type { CampaignGroupMetrics } from "@/lib/donations/campaign-group-types"
import {
  type CampaignPaymentRow,
  type CampaignPledgeRow,
} from "@/lib/donations/campaign-analytics"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type OrgCampaignGroupReportRow = CampaignGroupMetrics & {
  campaignId: string
  campaignName: string
  campaignStatus: string | null
}

export async function listOrgCampaignGroupsReportAction(input?: {
  campaignId?: string | null
  status?: string | null
}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  try {
    const writeClient = createServiceRoleClient()

    let campaignsQuery = writeClient
      .from("campaigns")
      .select("id, name, status")
      .eq("organization_id", access.orgId)
      .order("name", { ascending: true })

    if (input?.campaignId) {
      campaignsQuery = campaignsQuery.eq("id", input.campaignId)
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery
    if (campaignsError) {
      return { success: false as const, error: campaignsError.message }
    }

    const campaignRows = campaigns || []
    const campaignNameById = new Map(
      campaignRows.map((row) => [
        row.id as string,
        {
          name: (row.name as string) || "Campaign",
          status: (row.status as string | null) ?? null,
        },
      ])
    )

    const allGroups = []
    for (const campaign of campaignRows) {
      const groups = await fetchCampaignGroups(writeClient, access.orgId, campaign.id as string)
      for (const group of groups) {
        if (input?.status && group.status !== input.status) continue
        allGroups.push(group)
      }
    }

    if (allGroups.length === 0) {
      return {
        success: true as const,
        rows: [] as OrgCampaignGroupReportRow[],
        campaigns: campaignRows.map((row) => ({
          id: row.id as string,
          name: (row.name as string) || "Campaign",
        })),
        totals: { groups: 0, pledged: 0, collected: 0, donors: 0 },
      }
    }

    const contactIds = new Set<string>()
    for (const group of allGroups) {
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

    const campaignIds = [...new Set(allGroups.map((group) => group.campaign_id))]
    const [pledgesResult, paymentsResult] = await Promise.all([
      writeClient
        .from("pledge_status_view")
        .select(
          "id, campaign_id, donor_id, amount_pledged, balance_remaining, calculated_status"
        )
        .eq("organization_id", access.orgId)
        .in("campaign_id", campaignIds),
      writeClient
        .from("payments")
        .select(
          "id, campaign_id, pledge_id, donor_id, contact_id, amount, refunded_amount, status, campaign_group_id"
        )
        .eq("organization_id", access.orgId)
        .in("campaign_id", campaignIds),
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

    const rows: OrgCampaignGroupReportRow[] = []
    for (const campaignId of campaignIds) {
      const campaignGroups = allGroups.filter((group) => group.campaign_id === campaignId)
      const metrics = computeCampaignGroupMetrics({
        groups: campaignGroups,
        campaignId,
        pledges,
        payments,
        contactNames,
      })
      const campaignMeta = campaignNameById.get(campaignId)
      for (const metric of metrics) {
        rows.push({
          ...metric,
          campaignId,
          campaignName: campaignMeta?.name || "Campaign",
          campaignStatus: campaignMeta?.status ?? null,
        })
      }
    }

    rows.sort((a, b) => {
      const byCampaign = a.campaignName.localeCompare(b.campaignName)
      if (byCampaign !== 0) return byCampaign
      return b.collected - a.collected
    })

    const donorKeys = new Set<string>()
    // Approximate unique donors across groups (may double-count multi-group donors).
    let pledged = 0
    let collected = 0
    for (const row of rows) {
      pledged += row.pledged
      collected += row.collected
      donorKeys.add(`${row.groupId}:${row.donorCount}`)
    }

    return {
      success: true as const,
      rows,
      campaigns: campaignRows.map((row) => ({
        id: row.id as string,
        name: (row.name as string) || "Campaign",
      })),
      totals: {
        groups: rows.length,
        pledged,
        collected,
        donors: rows.reduce((sum, row) => sum + row.donorCount, 0),
      },
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
