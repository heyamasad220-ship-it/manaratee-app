import type { SupabaseClient } from "@supabase/supabase-js"

import {
  filterPledgesForCampaign,
  filterPaymentsForCampaign,
  buildPledgeCampaignMap,
  campaignPaymentNetAmount,
  isActivePledgeStatus,
  type CampaignPaymentRow,
  type CampaignPledgeRow,
} from "@/lib/donations/campaign-analytics"
import {
  CAMPAIGN_GROUP_SELECT,
  normalizeCampaignGroupStatus,
  type CampaignGroupMetrics,
  type CampaignGroupRow,
} from "@/lib/donations/campaign-group-types"

export function mapCampaignGroupRow(row: Record<string, unknown>): CampaignGroupRow {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    campaign_id: row.campaign_id as string,
    organizational_group_id: (row.organizational_group_id as string | null) ?? null,
    name: row.name as string,
    lead_contact_id: (row.lead_contact_id as string | null) ?? null,
    goal_amount: row.goal_amount == null ? null : Number(row.goal_amount),
    description: (row.description as string | null) ?? null,
    public_token: row.public_token as string,
    status: normalizeCampaignGroupStatus(row.status as string),
    public_progress_enabled: Boolean(row.public_progress_enabled),
    link_active: row.link_active !== false,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  }
}

export async function fetchCampaignGroups(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string
): Promise<CampaignGroupRow[]> {
  const { data, error } = await supabase
    .from("campaign_groups")
    .select(CAMPAIGN_GROUP_SELECT)
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .order("name", { ascending: true })

  if (error) {
    if (error.code === "42P01" || /campaign_groups/i.test(error.message || "")) {
      return []
    }
    throw new Error(error.message)
  }

  return ((data || []) as Record<string, unknown>[]).map(mapCampaignGroupRow)
}

export function computeCampaignGroupMetrics(input: {
  groups: CampaignGroupRow[]
  campaignId: string
  pledges: CampaignPledgeRow[]
  payments: CampaignPaymentRow[]
  contactNames?: Map<string, string>
}): CampaignGroupMetrics[] {
  const pledgeCampaignById = buildPledgeCampaignMap(input.pledges)
  const campaignPledges = filterPledgesForCampaign(input.campaignId, input.pledges)
  const campaignPayments = filterPaymentsForCampaign(
    input.campaignId,
    input.payments,
    pledgeCampaignById
  )

  return input.groups.map((group) => {
    const groupPledges = campaignPledges.filter(
      (pledge) =>
        (pledge as CampaignPledgeRow & { campaign_group_id?: string | null })
          .campaign_group_id === group.id &&
        isActivePledgeStatus(pledge.calculated_status)
    )
    const groupPledgeIds = new Set(groupPledges.map((p) => p.id))

    const pledged = groupPledges.reduce(
      (sum, pledge) => sum + Number(pledge.amount_pledged || 0),
      0
    )
    const outstanding = groupPledges.reduce(
      (sum, pledge) => sum + Math.max(Number(pledge.balance_remaining || 0), 0),
      0
    )

    const groupPayments = campaignPayments.filter((payment) => {
      const paymentGroupId = (
        payment as CampaignPaymentRow & { campaign_group_id?: string | null }
      ).campaign_group_id
      if (paymentGroupId === group.id) return true
      // Inherit from pledge attribution when payment has no explicit group.
      return Boolean(
        payment.pledge_id &&
          groupPledgeIds.has(payment.pledge_id) &&
          !paymentGroupId
      )
    })

    const collected = groupPayments.reduce(
      (sum, payment) => sum + campaignPaymentNetAmount(payment),
      0
    )

    const donorKeys = new Set<string>()
    for (const payment of groupPayments) {
      if (payment.donor_id) donorKeys.add(`donor:${payment.donor_id}`)
      else if (payment.contact_id) donorKeys.add(`contact:${payment.contact_id}`)
    }
    for (const pledge of groupPledges) {
      if (pledge.donor_id) donorKeys.add(`donor:${pledge.donor_id}`)
    }

    const goalAmount = group.goal_amount
    const progressPercent =
      goalAmount != null && goalAmount > 0
        ? Math.min((collected / goalAmount) * 100, 100)
        : null

    return {
      groupId: group.id,
      name: group.name,
      goalAmount,
      leadContactId: group.lead_contact_id,
      leadName: group.lead_contact_id
        ? input.contactNames?.get(group.lead_contact_id) || null
        : null,
      organizationalGroupId: group.organizational_group_id,
      organizationalGroupName: group.organizational_group_id
        ? input.contactNames?.get(group.organizational_group_id) || null
        : null,
      status: group.status,
      linkActive: group.link_active,
      publicToken: group.public_token,
      publicProgressEnabled: group.public_progress_enabled,
      description: group.description,
      pledged,
      collected,
      outstanding,
      donorCount: donorKeys.size,
      progressPercent,
    }
  })
}
