"use server"

import { properCasePersonNameIfNeeded } from "@/lib/contacts/contact-constants"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import { sendGroupPledgeConfirmationEmail } from "@/lib/donations/donation-email-delivery"
import { createOneTimeDonationCheckout } from "@/lib/donations/stripe/checkout"
import { createRecurringDonationCheckout } from "@/lib/donations/stripe/recurring-checkout"
import type { RecurringStripeFrequency } from "@/lib/donations/stripe/types"
import { buildCampaignGroupDonationPath } from "@/lib/donations/campaign-group-types"
import { campaignPaymentNetAmount } from "@/lib/donations/campaign-analytics"
import { isStripeConfigured, getAppBaseUrl } from "@/lib/stripe/stripe-server"
import { loadOrganizationStripeConnect } from "@/lib/stripe/stripe-connect-queries"
import { isOrganizationStripeConnectReady } from "@/lib/stripe/stripe-connect-types"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type PublicCampaignGroupChoice = {
  id: string
  name: string
  received: number
}

export type PublicCampaignGroupDonateInfo = {
  token: string
  campaignId: string
  campaignName: string
  organizationId: string
  organizationName: string
  groups: PublicCampaignGroupChoice[]
  onlineDonationsReady: boolean
}

async function loadCampaignByDonateToken(token: string) {
  const supabase = createServiceRoleClient()
  const trimmed = token.trim()
  if (!trimmed) return { ok: false as const, error: "Invalid donation link" }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, name, organization_id, group_donate_token")
    .eq("group_donate_token", trimmed)
    .maybeSingle()

  if (error) {
    if (error.code === "42703" || /group_donate_token/i.test(error.message || "")) {
      return {
        ok: false as const,
        error:
          "The shared group donation link is not available yet. Run scripts/309_campaign_group_donate_token.sql in Supabase.",
      }
    }
    return { ok: false as const, error: error.message }
  }

  if (!campaign?.group_donate_token) {
    return { ok: false as const, error: "Donation link not found" }
  }

  return { ok: true as const, supabase, campaign }
}

async function loadSelectableGroup(
  supabase: ReturnType<typeof createServiceRoleClient>,
  campaign: { id: string; organization_id: string },
  groupId: string
) {
  const { data: group, error } = await supabase
    .from("campaign_groups")
    .select("id, name, status, organizational_group_id")
    .eq("id", groupId)
    .eq("campaign_id", campaign.id)
    .eq("organization_id", campaign.organization_id)
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message }
  if (!group || String(group.status).toLowerCase() !== "active") {
    return { ok: false as const, error: "Choose a group" }
  }
  return { ok: true as const, group }
}

export async function getPublicCampaignGroupDonateInfoAction(
  token: string
): Promise<{ success: true; info: PublicCampaignGroupDonateInfo } | { success: false; error: string }> {
  const loaded = await loadCampaignByDonateToken(token)
  if (!loaded.ok) return { success: false, error: loaded.error }

  const { supabase, campaign } = loaded

  const [{ data: organization }, { data: groups, error: groupsError }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", campaign.organization_id).maybeSingle(),
    supabase
      .from("campaign_groups")
      .select("id, name, status")
      .eq("organization_id", campaign.organization_id)
      .eq("campaign_id", campaign.id)
      .eq("status", "active"),
  ])

  if (groupsError) return { success: false, error: groupsError.message }

  const activeGroups = groups || []
  const receivedByGroup = new Map<string, number>()
  if (activeGroups.length > 0) {
    const { data: payments } = await supabase
      .from("payments")
      .select("campaign_group_id, amount, refunded_amount, status")
      .eq("organization_id", campaign.organization_id)
      .eq("campaign_id", campaign.id)
      .in(
        "campaign_group_id",
        activeGroups.map((group) => group.id as string)
      )

    for (const payment of payments || []) {
      const groupId = payment.campaign_group_id as string | null
      if (!groupId) continue
      const net = campaignPaymentNetAmount({
        id: "tmp",
        amount: payment.amount,
        refunded_amount: payment.refunded_amount,
        status: payment.status,
      })
      receivedByGroup.set(groupId, (receivedByGroup.get(groupId) || 0) + net)
    }
  }

  const choices: PublicCampaignGroupChoice[] = activeGroups
    .map((group) => ({
      id: group.id as string,
      name: (group.name as string) || "Group",
      received: receivedByGroup.get(group.id as string) || 0,
    }))
    .sort((left, right) => {
      if (right.received !== left.received) return right.received - left.received
      return left.name.localeCompare(right.name)
    })

  let onlineDonationsReady = false
  if (isStripeConfigured()) {
    const connectStatus = await loadOrganizationStripeConnect(supabase, campaign.organization_id)
    onlineDonationsReady = isOrganizationStripeConnectReady(connectStatus)
  }

  return {
    success: true,
    info: {
      token: campaign.group_donate_token as string,
      campaignId: campaign.id as string,
      campaignName: (campaign.name as string) || "Campaign",
      organizationId: campaign.organization_id as string,
      organizationName: organization?.name || "Organization",
      groups: choices,
      onlineDonationsReady,
    },
  }
}

async function ensurePublicDonorContact(input: {
  organizationId: string
  fullName: string
  email: string
}) {
  const supabase = createServiceRoleClient()
  const cleanName = properCasePersonNameIfNeeded(input.fullName)
  const cleanEmail = input.email.trim().toLowerCase()

  if (!cleanName) throw new Error("Full name is required")
  if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("A valid email is required")

  const { data: contactId, error } = await supabase.rpc("find_or_create_contact_for_org", {
    p_organization_id: input.organizationId,
    p_full_name: cleanName,
    p_email: cleanEmail,
    p_phone: null,
    p_contact_type: "individual",
  })

  if (error || !contactId) {
    throw new Error(error?.message || "Could not create donor contact")
  }

  const donorId = await ensureDonorExtensionForContact(
    input.organizationId,
    contactId as string,
    supabase
  )
  if (!donorId) throw new Error("Could not resolve donor profile")

  return { contactId: contactId as string, donorId, fullName: cleanName, email: cleanEmail }
}

async function ensureOrgGroupMembership(input: {
  organizationId: string
  groupContactId: string
  memberContactId: string
}) {
  const supabase = createServiceRoleClient()
  const { data: existing } = await supabase
    .from("contact_group_members")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("group_contact_id", input.groupContactId)
    .eq("member_contact_id", input.memberContactId)
    .maybeSingle()

  if (existing?.id) return

  const { error } = await supabase.from("contact_group_members").insert({
    organization_id: input.organizationId,
    group_contact_id: input.groupContactId,
    member_contact_id: input.memberContactId,
  })

  // Ignore missing-table / unique races — campaign_group_id attribution still works.
  if (error && error.code !== "23505" && error.code !== "42P01") {
    console.warn("[campaign-group-donate] membership ensure failed:", error.message)
  }
}

export async function createPublicCampaignGroupDonationCheckoutAction(input: {
  token: string
  groupId: string
  amount: number
  donorName: string
  donorEmail: string
  /**
   * one_time = gift only;
   * recurring = Stripe subscription attributed to the group;
   * pledge_pay = create pledge then pay toward it;
   * pledge_only = pledge without card.
   */
  mode?: "one_time" | "recurring" | "pledge_pay" | "pledge_only"
  frequency?: RecurringStripeFrequency
}) {
  const loaded = await loadCampaignByDonateToken(input.token)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const { supabase, campaign } = loaded
  const selected = await loadSelectableGroup(supabase, campaign, input.groupId)
  if (!selected.ok) return { success: false as const, error: selected.error }
  const group = selected.group
  const mode = input.mode || "one_time"
  const frequency: RecurringStripeFrequency =
    input.frequency === "quarterly" || input.frequency === "annually"
      ? input.frequency
      : "monthly"

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false as const, error: "Enter an amount greater than zero" }
  }

  if (mode !== "pledge_only") {
    if (!isStripeConfigured()) {
      return { success: false as const, error: "Online payments are not configured" }
    }

    const connectStatus = await loadOrganizationStripeConnect(supabase, campaign.organization_id)
    if (!isOrganizationStripeConnectReady(connectStatus)) {
      return {
        success: false as const,
        error: "Online donations are not enabled for this organization yet.",
      }
    }
  }

  try {
    const donor = await ensurePublicDonorContact({
      organizationId: campaign.organization_id,
      fullName: input.donorName,
      email: input.donorEmail,
    })

    const attributedGroupContactId = group.organizational_group_id || null
    if (attributedGroupContactId) {
      await ensureOrgGroupMembership({
        organizationId: campaign.organization_id,
        groupContactId: attributedGroupContactId,
        memberContactId: donor.contactId,
      })
    }

    const { data: organization } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", campaign.organization_id)
      .maybeSingle()

    const campaignName = campaign.name || "Campaign"
    const organizationName = organization?.name || "Organization"
    const baseUrl = getAppBaseUrl()
    const path = buildCampaignGroupDonationPath(campaign.group_donate_token)

    let pledgeId: string | null = null
    if (mode === "pledge_pay" || mode === "pledge_only") {
      const pledgeDate = new Date().toISOString().slice(0, 10)
      const { data: pledge, error: pledgeError } = await supabase
        .from("pledges")
        .insert({
          organization_id: campaign.organization_id,
          donor_id: donor.donorId,
          campaign_id: campaign.id,
          campaign_group_id: group.id,
          category_id: null,
          subcategory_id: null,
          amount_pledged: amount,
          installment_amount: null,
          total_payments: null,
          pledge_date: pledgeDate,
          first_payment_date: null,
          next_payment_date: null,
          pledge_type: "one_time",
          frequency: "one_time",
          status: "open",
          notes: `Public group pledge · ${group.name}`,
        })
        .select("id")
        .single()

      if (pledgeError || !pledge?.id) {
        return {
          success: false as const,
          error: pledgeError?.message || "Could not create pledge",
        }
      }
      pledgeId = pledge.id as string

      try {
        await sendGroupPledgeConfirmationEmail(supabase, {
          organizationId: campaign.organization_id,
          pledgeId,
          donorId: donor.donorId,
          contactId: donor.contactId,
          fallbackEmail: donor.email,
          organizationName,
          donorName: donor.fullName,
          groupName: group.name,
          campaignName,
          amount,
          payLater: mode === "pledge_only",
        })
      } catch (emailError) {
        console.warn(
          "[campaign-group-donate] pledge confirmation email failed:",
          emailError instanceof Error ? emailError.message : emailError
        )
      }
    }

    if (mode === "pledge_only") {
      return {
        success: true as const,
        mode: "pledge_only" as const,
        pledgeId,
        checkoutUrl: null,
      }
    }

    if (mode === "recurring") {
      const checkout = await createRecurringDonationCheckout(supabase, {
        organizationId: campaign.organization_id,
        donorId: donor.donorId,
        contactId: donor.contactId,
        amount,
        frequency,
        campaignId: campaign.id,
        campaignGroupId: group.id,
        attributedGroupContactId,
        donorEmail: donor.email,
        donorName: donor.fullName,
        productName: `Recurring gift — ${group.name}`,
        productDescription: `${campaignName} · supporting ${group.name} (${frequency})`,
        successUrl: `${baseUrl}${path}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}${path}?checkout=cancelled`,
      })

      return {
        success: true as const,
        mode: "recurring" as const,
        pledgeId: null,
        checkoutUrl: checkout.checkoutUrl,
      }
    }

    const isPledgePay = mode === "pledge_pay"
    const checkout = await createOneTimeDonationCheckout(supabase, {
      organizationId: campaign.organization_id,
      donorId: donor.donorId,
      contactId: donor.contactId,
      amount,
      campaignId: campaign.id,
      campaignGroupId: group.id,
      attributedGroupContactId,
      pledgeId,
      donorEmail: donor.email,
      donorName: donor.fullName,
      productName: isPledgePay
        ? `Pledge payment — ${group.name}`
        : `Donation — ${group.name}`,
      productDescription: `${campaignName} · supporting ${group.name}`,
      successUrl: `${baseUrl}${path}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}${path}?checkout=cancelled`,
    })

    return {
      success: true as const,
      mode: mode as "one_time" | "pledge_pay",
      pledgeId,
      checkoutUrl: checkout.checkoutUrl,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start checkout"
    if (/campaign_group_id|attributed_group_contact_id/i.test(message)) {
      return {
        success: false as const,
        error:
          "Campaign group checkout is not available yet. Run scripts/264_campaign_group_checkout.sql and scripts/266_group_recurring_and_fd_emails.sql in Supabase.",
      }
    }
    return { success: false as const, error: message }
  }
}

export async function getPublicCampaignGroupCheckoutStatusAction(input: {
  token: string
  stripeCheckoutSessionId: string
}) {
  const loaded = await loadCampaignByDonateToken(input.token)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const sessionId = input.stripeCheckoutSessionId.trim()
  if (!sessionId) return { success: false as const, error: "Missing checkout session" }

  const { data, error } = await loaded.supabase
    .from("donation_checkout_sessions")
    .select("id, status, payment_id, campaign_id, campaign_group_id, amount")
    .eq("organization_id", loaded.campaign.organization_id)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle()

  if (error) return { success: false as const, error: error.message }
  if (!data) return { success: false as const, error: "Checkout session not found" }
  if (data.campaign_id && data.campaign_id !== loaded.campaign.id) {
    return { success: false as const, error: "Checkout session does not match this campaign" }
  }

  let groupName: string | null = null
  if (data.campaign_group_id) {
    const { data: group } = await loaded.supabase
      .from("campaign_groups")
      .select("id, name")
      .eq("id", data.campaign_group_id)
      .eq("campaign_id", loaded.campaign.id)
      .maybeSingle()
    if (!group) {
      return { success: false as const, error: "Checkout session does not match this campaign" }
    }
    groupName = group.name as string
  }

  return {
    success: true as const,
    status: data.status as string,
    paymentId: (data.payment_id as string | null) ?? null,
    amount: data.amount == null ? null : Number(data.amount),
    groupName,
  }
}
