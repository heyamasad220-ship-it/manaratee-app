"use server"

import { properCasePersonNameIfNeeded } from "@/lib/contacts/contact-constants"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import { createOneTimeDonationCheckout } from "@/lib/donations/stripe/checkout"
import { isStripeConfigured, getAppBaseUrl } from "@/lib/stripe/stripe-server"
import { loadOrganizationStripeConnect } from "@/lib/stripe/stripe-connect-queries"
import { isOrganizationStripeConnectReady } from "@/lib/stripe/stripe-connect-types"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { CAMPAIGN_WISHLIST_SELECT, buildWishlistDonationPath } from "@/lib/donations/campaign-wishlist-types"
import {
  attachWishlistFundingMetrics,
  mapCampaignWishlistItemRow,
  asWishlistRecord,
} from "@/lib/donations/campaign-wishlist-helpers"

export type PublicWishlistDonateInfo = {
  token: string
  itemId: string
  itemName: string
  description: string | null
  imageUrl: string | null
  targetAmount: number
  collected: number
  remaining: number
  fundingStatus: string
  projectStatus: string
  campaignId: string
  campaignName: string
  organizationId: string
  organizationName: string
  completed: boolean
  onlineDonationsReady: boolean
}

async function loadPublicItemByToken(token: string) {
  const supabase = createServiceRoleClient()
  const trimmed = token.trim()
  if (!trimmed) return { ok: false as const, error: "Invalid donation link" }

  const { data, error } = await supabase
    .from("campaign_wishlist_items")
    .select(CAMPAIGN_WISHLIST_SELECT)
    .eq("public_token", trimmed)
    .maybeSingle()

  if (error) {
    if (error.code === "42P01" || /campaign_wishlist_items/i.test(error.message || "")) {
      return {
        ok: false as const,
        error: "Campaign wishlist is not available yet. Run scripts/267_campaign_wishlist.sql in Supabase.",
      }
    }
    return { ok: false as const, error: error.message }
  }
  if (!data) return { ok: false as const, error: "Donation link not found" }

  const item = mapCampaignWishlistItemRow(asWishlistRecord(data))
  if (!item.public_visible || !item.link_active || item.archived_at) {
    return { ok: false as const, error: "This donation link is inactive" }
  }

  return { ok: true as const, supabase, item }
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
  if (error || !contactId) throw new Error(error?.message || "Could not create donor contact")

  const donorId = await ensureDonorExtensionForContact(
    input.organizationId,
    contactId as string,
    supabase
  )
  if (!donorId) throw new Error("Could not resolve donor profile")
  return { contactId: contactId as string, donorId, fullName: cleanName, email: cleanEmail }
}

export async function getPublicWishlistDonateInfoAction(token: string) {
  const loaded = await loadPublicItemByToken(token)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const { supabase, item } = loaded
  const [metrics, campaignResult, orgResult] = await Promise.all([
    attachWishlistFundingMetrics(supabase, item.organization_id, [item]),
    supabase.from("campaigns").select("id, name, status").eq("id", item.campaign_id).maybeSingle(),
    supabase.from("organizations").select("id, name").eq("id", item.organization_id).maybeSingle(),
  ])

  const metric = metrics[0]
  let onlineDonationsReady = false
  if (isStripeConfigured()) {
    const connectStatus = await loadOrganizationStripeConnect(supabase, item.organization_id)
    onlineDonationsReady = isOrganizationStripeConnectReady(connectStatus)
  }

  return {
    success: true as const,
    info: {
      token: item.public_token,
      itemId: item.id,
      itemName: item.name,
      description: item.description,
      imageUrl: item.image_url,
      targetAmount: item.target_amount,
      collected: metric?.lifetimeCollected ?? 0,
      remaining: metric?.remaining ?? item.target_amount,
      fundingStatus: metric?.fundingStatus ?? "not_funded",
      projectStatus: item.project_status,
      campaignId: item.campaign_id,
      campaignName: campaignResult.data?.name || "Campaign",
      organizationId: item.organization_id,
      organizationName: orgResult.data?.name || "Organization",
      completed: item.project_status === "completed",
      onlineDonationsReady,
    } satisfies PublicWishlistDonateInfo,
  }
}

export async function createPublicWishlistDonationCheckoutAction(input: {
  token: string
  amount: number
  donorName: string
  donorEmail: string
}) {
  const loaded = await loadPublicItemByToken(input.token)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false as const, error: "Enter a valid amount." }
  }

  const { supabase, item } = loaded
  if (!isStripeConfigured()) {
    return { success: false as const, error: "Online donations are not configured." }
  }
  const connectStatus = await loadOrganizationStripeConnect(supabase, item.organization_id)
  if (!isOrganizationStripeConnectReady(connectStatus)) {
    return { success: false as const, error: "Online donations are not enabled for this organization yet." }
  }

  try {
    const donor = await ensurePublicDonorContact({
      organizationId: item.organization_id,
      fullName: input.donorName,
      email: input.donorEmail,
    })
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("name")
      .eq("id", item.campaign_id)
      .maybeSingle()
    const campaignName = campaign?.name || "Campaign"
    const baseUrl = getAppBaseUrl()
    const path = buildWishlistDonationPath(item.public_token)

    const checkout = await createOneTimeDonationCheckout(supabase, {
      organizationId: item.organization_id,
      donorId: donor.donorId,
      contactId: donor.contactId,
      amount,
      campaignId: item.campaign_id,
      wishlistItemId: item.id,
      donorEmail: donor.email,
      donorName: donor.fullName,
      productName: `Donation — ${item.name}`,
      productDescription: `${campaignName} · supporting ${item.name}`,
      successUrl: `${baseUrl}${path}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}${path}?checkout=cancelled`,
    })

    return { success: true as const, checkoutUrl: checkout.checkoutUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start checkout"
    if (/wishlist_item_id/i.test(message)) {
      return {
        success: false as const,
        error: "Wishlist checkout is not available yet. Run scripts/267_campaign_wishlist.sql in Supabase.",
      }
    }
    return { success: false as const, error: message }
  }
}

export async function getPublicWishlistCheckoutStatusAction(input: {
  token: string
  stripeCheckoutSessionId: string
}) {
  const loaded = await loadPublicItemByToken(input.token)
  if (!loaded.ok) return { success: false as const, error: loaded.error }

  const sessionId = input.stripeCheckoutSessionId.trim()
  if (!sessionId) return { success: false as const, error: "Missing checkout session" }

  const { data, error } = await loaded.supabase
    .from("donation_checkout_sessions")
    .select("id, status, payment_id, wishlist_item_id, amount")
    .eq("organization_id", loaded.item.organization_id)
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle()

  if (error) return { success: false as const, error: error.message }
  if (!data) return { success: false as const, error: "Checkout session not found" }
  if (data.wishlist_item_id && data.wishlist_item_id !== loaded.item.id) {
    return { success: false as const, error: "Checkout session does not match this wishlist item" }
  }

  return {
    success: true as const,
    status: data.status as string,
    paymentId: (data.payment_id as string | null) ?? null,
    amount: data.amount == null ? null : Number(data.amount),
  }
}
