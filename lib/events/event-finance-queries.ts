"use server"

import { isVoidedPayment } from "@/lib/donations/campaign-analytics"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type {
  EventCampaignOption,
  LinkedCampaignSummary,
} from "@/lib/events/event-finance-types"

export async function listActiveCampaignsForEvent(): Promise<EventCampaignOption[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name")

  if (error) {
    if (error.code === "42P01") return []
    console.error("listActiveCampaignsForEvent:", error.message)
    return []
  }

  return (data || []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }))
}

export async function getLinkedCampaignSummary(
  campaignId: string | null | undefined
): Promise<LinkedCampaignSummary | null> {
  if (!campaignId) return null

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle()

  if (campaignError || !campaign) return null

  const [paymentsResult, pledgesResult] = await Promise.all([
    supabase
      .from("payments")
      .select("amount_cents, status, contact_id")
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId),
    supabase
      .from("pledges")
      .select("amount_cents, amount_paid_cents, status, contact_id")
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId),
  ])

  let raisedCents = 0
  const donorIds = new Set<string>()
  for (const row of paymentsResult.data || []) {
    if (isVoidedPayment(row.status as string)) continue
    raisedCents += Number(row.amount_cents || 0)
    const contactId = (row as { contact_id?: string | null }).contact_id
    if (contactId) donorIds.add(contactId)
  }

  let pledgeCents = 0
  let pledgeBalanceCents = 0
  for (const row of pledgesResult.data || []) {
    const status = (row.status as string) || ""
    if (status === "canceled" || status === "cancelled") continue
    const pledged = Number(row.amount_cents || 0)
    const paid = Number(row.amount_paid_cents || 0)
    pledgeCents += pledged
    pledgeBalanceCents += Math.max(0, pledged - paid)
    const contactId = row.contact_id as string | null
    if (contactId) donorIds.add(contactId)
  }

  return {
    campaignId: campaign.id as string,
    campaignName: campaign.name as string,
    raisedCents,
    pledgeCents,
    pledgeBalanceCents,
    donorCount: donorIds.size,
    currency: "USD",
  }
}
