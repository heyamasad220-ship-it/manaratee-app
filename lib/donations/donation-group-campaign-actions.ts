"use server"

import { requireContactsViewAccess } from "@/lib/contacts/group-member-access"
import {
  countsTowardGivingTotals,
  paymentNetAmount,
} from "@/lib/donations/payment-net-amount"

export type GroupCampaignMemberGift = {
  contactId: string | null
  memberName: string
  amount: number
  giftCount: number
  isPooledGroupGift: boolean
}

export type GroupCampaignGiftRow = {
  campaignId: string | null
  campaignName: string
  combinedTotal: number
  groupDirectTotal: number
  memberGiftsTotal: number
  giftCount: number
  lastGiftDate: string | null
  members: GroupCampaignMemberGift[]
}

export type GroupCampaignGivingSummary = {
  combinedTotal: number
  groupDirectTotal: number
  memberGiftsTotal: number
  giftCount: number
  campaignCount: number
  campaigns: GroupCampaignGiftRow[]
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code === "42703" || error.code === "PGRST204") return true
  const message = (error.message || "").toLowerCase()
  return message.includes("does not exist") || message.includes("could not find")
}

export async function fetchGroupCampaignGivingAction(
  groupContactId: string
): Promise<
  | { success: true; summary: GroupCampaignGivingSummary }
  | { success: false; error: string }
> {
  const access = await requireContactsViewAccess()
  if (!access.ok) return { success: false, error: access.error }

  const { data: group, error: groupError } = await access.supabase
    .from("contacts")
    .select("id, contact_type, full_name")
    .eq("organization_id", access.organizationId)
    .eq("id", groupContactId)
    .maybeSingle()

  if (groupError || !group || group.contact_type !== "group") {
    return { success: false, error: "Giving group not found." }
  }

  const groupName = (group.full_name as string | null)?.trim() || "Group"

  const selectWithCampaign =
    "id, contact_id, amount, refunded_amount, payment_date, status, campaign_id, attributed_group_contact_id, memo"
  const selectWithoutCampaign =
    "id, contact_id, amount, refunded_amount, payment_date, status, attributed_group_contact_id, memo"

  let payments: Array<Record<string, unknown>> = []
  let hasCampaignColumn = true

  const attributedResult = await access.supabase
    .from("payments")
    .select(selectWithCampaign)
    .eq("organization_id", access.organizationId)
    .eq("attributed_group_contact_id", groupContactId)
    .limit(2000)

  if (attributedResult.error && isMissingColumnError(attributedResult.error)) {
    hasCampaignColumn = false
    const retryAttributed = await access.supabase
      .from("payments")
      .select(selectWithoutCampaign)
      .eq("organization_id", access.organizationId)
      .eq("attributed_group_contact_id", groupContactId)
      .limit(2000)
    if (retryAttributed.error) {
      return {
        success: false,
        error: retryAttributed.error.message || "Could not load attributed gifts.",
      }
    }
    payments = (retryAttributed.data || []) as Array<Record<string, unknown>>
  } else if (attributedResult.error) {
    return {
      success: false,
      error: attributedResult.error.message || "Could not load attributed gifts.",
    }
  } else {
    payments = (attributedResult.data || []) as Array<Record<string, unknown>>
  }

  const directQuery = access.supabase
    .from("payments")
    .select(hasCampaignColumn ? selectWithCampaign : selectWithoutCampaign)
    .eq("organization_id", access.organizationId)
    .eq("contact_id", groupContactId)
    .is("attributed_group_contact_id", null)
    .limit(2000)

  const directResult = await directQuery
  if (directResult.error) {
    return {
      success: false,
      error: directResult.error.message || "Could not load group gifts.",
    }
  }

  const seen = new Set(payments.map((row) => row.id as string))
  for (const row of (directResult.data || []) as Array<Record<string, unknown>>) {
    const id = row.id as string
    if (!seen.has(id)) {
      payments.push(row)
      seen.add(id)
    }
  }

  const contactIds = [
    ...new Set(
      payments
        .map((row) => row.contact_id as string | null)
        .filter((id): id is string => Boolean(id) && id !== groupContactId)
    ),
  ]

  const contactNames = new Map<string, string>()
  if (contactIds.length > 0) {
    const { data: contacts } = await access.supabase
      .from("contacts")
      .select("id, full_name")
      .eq("organization_id", access.organizationId)
      .in("id", contactIds)

    for (const contact of contacts || []) {
      contactNames.set(
        contact.id as string,
        (contact.full_name as string | null)?.trim() || "Member"
      )
    }
  }

  const campaignIds = [
    ...new Set(
      payments
        .map((row) => (hasCampaignColumn ? (row.campaign_id as string | null) : null))
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const campaignNames = new Map<string, string>()
  if (campaignIds.length > 0) {
    const { data: campaigns } = await access.supabase
      .from("campaigns")
      .select("id, name")
      .eq("organization_id", access.organizationId)
      .in("id", campaignIds)

    for (const campaign of campaigns || []) {
      campaignNames.set(
        campaign.id as string,
        (campaign.name as string | null)?.trim() || "Campaign"
      )
    }
  }

  type AccMember = {
    contactId: string | null
    memberName: string
    amount: number
    giftCount: number
    isPooledGroupGift: boolean
  }

  type AccCampaign = {
    campaignId: string | null
    campaignName: string
    combinedTotal: number
    groupDirectTotal: number
    memberGiftsTotal: number
    giftCount: number
    lastGiftDate: string | null
    members: Map<string, AccMember>
  }

  const byCampaign = new Map<string, AccCampaign>()

  for (const payment of payments) {
    if (
      !countsTowardGivingTotals({
        amount: payment.amount as number | null,
        refunded_amount: payment.refunded_amount as number | null,
        status: payment.status as string | null,
      })
    ) {
      continue
    }
    const net = paymentNetAmount(payment.amount, payment.refunded_amount)
    if (net <= 0) continue

    const campaignId = hasCampaignColumn
      ? ((payment.campaign_id as string | null) ?? null)
      : null
    const campaignKey = campaignId || "__none__"
    const campaignName = campaignId
      ? campaignNames.get(campaignId) || "Campaign"
      : "General giving"

    let bucket = byCampaign.get(campaignKey)
    if (!bucket) {
      bucket = {
        campaignId,
        campaignName,
        combinedTotal: 0,
        groupDirectTotal: 0,
        memberGiftsTotal: 0,
        giftCount: 0,
        lastGiftDate: null,
        members: new Map(),
      }
      byCampaign.set(campaignKey, bucket)
    }

    const attributedGroupId =
      (payment.attributed_group_contact_id as string | null) ?? null
    const isMemberGift = Boolean(attributedGroupId)
    const contactId = (payment.contact_id as string | null) ?? null

    bucket.combinedTotal += net
    bucket.giftCount += 1
    if (isMemberGift) {
      bucket.memberGiftsTotal += net
    } else {
      bucket.groupDirectTotal += net
    }

    const paymentDate = (payment.payment_date as string | null) ?? null
    if (
      paymentDate &&
      (!bucket.lastGiftDate || paymentDate > bucket.lastGiftDate)
    ) {
      bucket.lastGiftDate = paymentDate
    }

    const memberKey = isMemberGift
      ? `member:${contactId || "unknown"}`
      : "pooled"
    const existingMember = bucket.members.get(memberKey)
    if (existingMember) {
      existingMember.amount += net
      existingMember.giftCount += 1
    } else {
      bucket.members.set(memberKey, {
        contactId: isMemberGift ? contactId : null,
        memberName: isMemberGift
          ? (contactId ? contactNames.get(contactId) : null) || "Member"
          : `${groupName} (pooled)`,
        amount: net,
        giftCount: 1,
        isPooledGroupGift: !isMemberGift,
      })
    }
  }

  const campaigns: GroupCampaignGiftRow[] = [...byCampaign.values()]
    .map((bucket) => ({
      campaignId: bucket.campaignId,
      campaignName: bucket.campaignName,
      combinedTotal: bucket.combinedTotal,
      groupDirectTotal: bucket.groupDirectTotal,
      memberGiftsTotal: bucket.memberGiftsTotal,
      giftCount: bucket.giftCount,
      lastGiftDate: bucket.lastGiftDate,
      members: [...bucket.members.values()].sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.combinedTotal - a.combinedTotal)

  const summary: GroupCampaignGivingSummary = {
    combinedTotal: campaigns.reduce((sum, row) => sum + row.combinedTotal, 0),
    groupDirectTotal: campaigns.reduce((sum, row) => sum + row.groupDirectTotal, 0),
    memberGiftsTotal: campaigns.reduce((sum, row) => sum + row.memberGiftsTotal, 0),
    giftCount: campaigns.reduce((sum, row) => sum + row.giftCount, 0),
    campaignCount: campaigns.length,
    campaigns,
  }

  return { success: true, summary }
}
