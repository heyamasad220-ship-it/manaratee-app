"use server"

import { donationCampaignWorkspaceHref } from "@/lib/donations/campaign-workspace-paths"
import {
  CAMPAIGN_PROSPECT_STAGE_LABELS,
  normalizeProspectStage,
} from "@/lib/donations/campaign-prospect-types"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type ContactFundDevelopmentHistoryItem = {
  id: string
  kind: "prospect" | "assignment" | "group_gift"
  date: string | null
  title: string
  detail: string
  href: string | null
  amountLabel: string | null
}

export async function loadContactFundDevelopmentHistoryAction(contactId: string) {
  const allowed = await hasPermission(PERMISSIONS.DONATIONS_VIEW)
  if (!allowed) {
    return { success: false as const, error: "Fund Development access required", denied: true as const }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No active organization" }
  }

  const trimmedContactId = contactId?.trim()
  if (!trimmedContactId) {
    return { success: false as const, error: "Contact is required" }
  }

  try {
    const supabase = await createClient()
    const writeClient = createServiceRoleClient()
    const items: ContactFundDevelopmentHistoryItem[] = []

    const { data: asProspect, error: prospectError } = await writeClient
      .from("campaign_prospects")
      .select(
        "id, campaign_id, stage, suggested_ask_amount, next_follow_up_at, last_contacted_at, converted_pledge_id, updated_at, created_at"
      )
      .eq("organization_id", organizationId)
      .eq("contact_id", trimmedContactId)
      .order("updated_at", { ascending: false })
      .limit(25)

    if (prospectError && prospectError.code !== "42P01") {
      return { success: false as const, error: prospectError.message }
    }

    const { data: asAssignee } = await writeClient
      .from("campaign_prospects")
      .select(
        "id, campaign_id, contact_id, stage, next_follow_up_at, updated_at, created_at"
      )
      .eq("organization_id", organizationId)
      .eq("assigned_to_contact_id", trimmedContactId)
      .order("updated_at", { ascending: false })
      .limit(25)

    const campaignIds = new Set<string>()
    for (const row of asProspect || []) campaignIds.add(row.campaign_id as string)
    for (const row of asAssignee || []) campaignIds.add(row.campaign_id as string)

    const prospectContactIds = new Set<string>()
    for (const row of asAssignee || []) {
      if (row.contact_id) prospectContactIds.add(row.contact_id as string)
    }

    const campaignNames = new Map<string, string>()
    if (campaignIds.size > 0) {
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("organization_id", organizationId)
        .in("id", [...campaignIds])
      for (const campaign of campaigns || []) {
        campaignNames.set(campaign.id as string, (campaign.name as string) || "Campaign")
      }
    }

    const prospectNames = new Map<string, string>()
    if (prospectContactIds.size > 0) {
      const { data: contacts } = await writeClient
        .from("contacts")
        .select("id, full_name")
        .eq("organization_id", organizationId)
        .in("id", [...prospectContactIds])
      for (const contact of contacts || []) {
        prospectNames.set(contact.id as string, (contact.full_name as string) || "Prospect")
      }
    }

    for (const row of asProspect || []) {
      const stage = normalizeProspectStage(row.stage as string)
      const campaignName = campaignNames.get(row.campaign_id as string) || "Campaign"
      items.push({
        id: `prospect-${row.id}`,
        kind: "prospect",
        date:
          (row.last_contacted_at as string | null) ||
          (row.next_follow_up_at as string | null) ||
          (row.updated_at as string | null) ||
          (row.created_at as string | null),
        title: `Prospect · ${campaignName}`,
        detail: CAMPAIGN_PROSPECT_STAGE_LABELS[stage],
        href: donationCampaignWorkspaceHref(row.campaign_id as string, { tab: "prospects" }),
        amountLabel:
          row.suggested_ask_amount != null
            ? `Ask ${formatDonationCurrency(Number(row.suggested_ask_amount))}`
            : null,
      })
    }

    for (const row of asAssignee || []) {
      const stage = normalizeProspectStage(row.stage as string)
      const campaignName = campaignNames.get(row.campaign_id as string) || "Campaign"
      const prospectName = prospectNames.get(row.contact_id as string) || "Prospect"
      items.push({
        id: `assignment-${row.id}`,
        kind: "assignment",
        date:
          (row.next_follow_up_at as string | null) ||
          (row.updated_at as string | null) ||
          (row.created_at as string | null),
        title: `Assigned · ${campaignName}`,
        detail: `${prospectName} · ${CAMPAIGN_PROSPECT_STAGE_LABELS[stage]}`,
        href: donationCampaignWorkspaceHref(row.campaign_id as string, { tab: "prospects" }),
        amountLabel: null,
      })
    }

    const { data: groupPayments } = await writeClient
      .from("payments")
      .select(
        "id, amount, payment_date, campaign_id, campaign_group_id, status, refunded_amount"
      )
      .eq("organization_id", organizationId)
      .eq("contact_id", trimmedContactId)
      .not("campaign_group_id", "is", null)
      .order("payment_date", { ascending: false })
      .limit(25)

    const groupIds = new Set<string>()
    for (const payment of groupPayments || []) {
      if (payment.campaign_group_id) groupIds.add(payment.campaign_group_id as string)
      if (payment.campaign_id) campaignIds.add(payment.campaign_id as string)
    }

    if (campaignIds.size > campaignNames.size) {
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("organization_id", organizationId)
        .in("id", [...campaignIds])
      for (const campaign of campaigns || []) {
        campaignNames.set(campaign.id as string, (campaign.name as string) || "Campaign")
      }
    }

    const groupNames = new Map<string, string>()
    if (groupIds.size > 0) {
      const { data: groups } = await writeClient
        .from("campaign_groups")
        .select("id, name, campaign_id")
        .eq("organization_id", organizationId)
        .in("id", [...groupIds])
      for (const group of groups || []) {
        groupNames.set(group.id as string, (group.name as string) || "Group")
      }
    }

    for (const payment of groupPayments || []) {
      const groupName = groupNames.get(payment.campaign_group_id as string) || "Group"
      const campaignName = campaignNames.get(payment.campaign_id as string) || "Campaign"
      items.push({
        id: `group-gift-${payment.id}`,
        kind: "group_gift",
        date: (payment.payment_date as string | null) ?? null,
        title: `Group gift · ${groupName}`,
        detail: campaignName,
        href: payment.campaign_id
          ? donationCampaignWorkspaceHref(payment.campaign_id as string, {
              tab: "groups",
              groupId: payment.campaign_group_id as string,
            })
          : null,
        amountLabel: formatDonationCurrency(Number(payment.amount || 0)),
      })
    }

    items.sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0
      const bTime = b.date ? new Date(b.date).getTime() : 0
      return bTime - aTime
    })

    return {
      success: true as const,
      items: items.slice(0, 40),
      canView: true as const,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
