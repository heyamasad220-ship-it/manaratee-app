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

export type PublicCampaignGroupDonateInfo = {
  token: string
  groupId: string
  groupName: string
  description: string | null
  goalAmount: number | null
  publicProgressEnabled: boolean
  campaignId: string
  campaignName: string
  organizationId: string
  organizationName: string
  collected: number | null
  progressPercent: number | null
  onlineDonationsReady: boolean
}

async function loadActiveGroupByToken(token: string) {
  const supabase = createServiceRoleClient()
  const trimmed = token.trim()
  if (!trimmed) return { ok: false as const, error: "Invalid donation link" }

  const { data: group, error } = await supabase
    .from("campaign_groups")
    .select(
      "id, name, description, goal_amount, status, link_active, public_progress_enabled, campaign_id, organization_id, organizational_group_id, public_token"
    )
    .eq("public_token", trimmed)
    .maybeSingle()

  if (error) {
    if (error.code === "42P01" || /campaign_groups/i.test(error.message || "")) {
      return {
        ok: false as const,
        error:
          "Campaign groups are not available yet. Run scripts/263_campaign_groups.sql in Supabase.",
      }
    }
    return { ok: false as const, error: error.message }
  }

  if (!group) return { ok: false as const, error: "Donation link not found" }
  if (!group.link_active || String(group.status).toLowerCase() !== "active") {
    return { ok: false as const, error: "This donation link is inactive" }
  }

  return { ok: true as const, supabase, group }
}

async function computeGroupCollected(
  supabase: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
  campaignGroupId: string
) {
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, refunded_amount, status")
    .eq("organization_id", organizationId)
    .eq("campaign_group_id", campaignGroupId)

  return (payments || []).reduce(
    (sum, payment) =>
      sum +
      campaignPaymentNetAmount({
        id: "tmp",
        amount: payment.amount,
        refunded_amount: payment.refunded_amount,
        status: payment.status,
      }),
    0
  )
}

export async function getPublicCampaignGroupDonateInfoAction(
  token: string
): Promise<{ success: true; info: PublicCampaignGroupDonateInfo } | { success: false; error: string }> {
  const loaded = await loadActiveGroupByToken(token)
  if (!loaded.ok) return { success: false, error: loaded.error }

  const { supabase, group } = loaded

  const [{ data: campaign }, { data: organization }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, description, status")
      .eq("id", group.campaign_id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("id, name")
      .eq("id", group.organization_id)
      .maybeSingle(),
  ])

  let collected: number | null = null
  let progressPercent: number | null = null
  if (group.public_progress_enabled) {
    collected = await computeGroupCollected(supabase, group.organization_id, group.id)
    const goal = group.goal_amount == null ? null : Number(group.goal_amount)
    if (goal != null && goal > 0) {
      progressPercent = Math.min((collected / goal) * 100, 100)
    }
  }

  let onlineDonationsReady = false
  if (isStripeConfigured()) {
    const connectStatus = await loadOrganizationStripeConnect(supabase, group.organization_id)
    onlineDonationsReady = isOrganizationStripeConnectReady(connectStatus)
  }

  return {
    success: true,
    info: {
      token: group.public_token,
      groupId: group.id,
      groupName: group.name,
      description: group.description || campaign?.description || null,
      goalAmount: group.goal_amount == null ? null : Number(group.goal_amount),
      publicProgressEnabled: Boolean(group.public_progress_enabled),
      campaignId: group.campaign_id,
      campaignName: campaign?.name || "Campaign",
      organizationId: group.organization_id,
      organizationName: organization?.name || "Organization",
      collected,
      progressPercent,
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
  const loaded = await loadActiveGroupByToken(input.token)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const { supabase, group } = loaded
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

    const connectStatus = await loadOrganizationStripeConnect(supabase, group.organization_id)
    if (!isOrganizationStripeConnectReady(connectStatus)) {
      return {
        success: false as const,
        error: "Online donations are not enabled for this organization yet.",
      }
    }
  }

  try {
    const donor = await ensurePublicDonorContact({
      organizationId: group.organization_id,
      fullName: input.donorName,
      email: input.donorEmail,
    })

    const attributedGroupContactId = group.organizational_group_id || null
    if (attributedGroupContactId) {
      await ensureOrgGroupMembership({
        organizationId: group.organization_id,
        groupContactId: attributedGroupContactId,
        memberContactId: donor.contactId,
      })
    }

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("name")
      .eq("id", group.campaign_id)
      .maybeSingle()

    const { data: organization } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", group.organization_id)
      .maybeSingle()

    const campaignName = campaign?.name || "Campaign"
    const organizationName = organization?.name || "Organization"
    const baseUrl = getAppBaseUrl()
    const path = buildCampaignGroupDonationPath(group.public_token)

    let pledgeId: string | null = null
    if (mode === "pledge_pay" || mode === "pledge_only") {
      const pledgeDate = new Date().toISOString().slice(0, 10)
      const { data: pledge, error: pledgeError } = await supabase
        .from("pledges")
        .insert({
          organization_id: group.organization_id,
          donor_id: donor.donorId,
          campaign_id: group.campaign_id,
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
          organizationId: group.organization_id,
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
        organizationId: group.organization_id,
        donorId: donor.donorId,
        contactId: donor.contactId,
        amount,
        frequency,
        campaignId: group.campaign_id,
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
      organizationId: group.organization_id,
      donorId: donor.donorId,
      contactId: donor.contactId,
      amount,
      campaignId: group.campaign_id,
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
  const loaded = await loadActiveGroupByToken(input.token)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const sessionId = input.stripeCheckoutSessionId.trim()
  if (!sessionId) return { success: false as const, error: "Missing checkout session" }

  const { data, error } = await loaded.supabase
    .from("donation_checkout_sessions")
    .select("id, status, payment_id, campaign_group_id, amount")
    .eq("organization_id", loaded.group.organization_id)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle()

  if (error) return { success: false as const, error: error.message }
  if (!data) return { success: false as const, error: "Checkout session not found" }
  if (data.campaign_group_id && data.campaign_group_id !== loaded.group.id) {
    return { success: false as const, error: "Checkout session does not match this group" }
  }

  return {
    success: true as const,
    status: data.status as string,
    paymentId: (data.payment_id as string | null) ?? null,
    amount: data.amount == null ? null : Number(data.amount),
  }
}
