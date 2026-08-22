import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import { buildDonationCheckoutMetadata } from "@/lib/donations/stripe/metadata"
import { stripeRecurringInterval } from "@/lib/donations/stripe/recurring-stripe-utils"
import type { CreateRecurringDonationCheckoutInput } from "@/lib/donations/stripe/types"
import { validateCustomerDonationAttribution } from "@/lib/donations/donation-fund-status"
import { initialNextPaymentDate } from "@/lib/donations/recurring-donation-schedule"
import {
  requireOrganizationStripeConnectAccountId,
  stripeConnectRequestOptions,
} from "@/lib/stripe/stripe-connect-queries"
import { getAppBaseUrl, getStripeServerClient } from "@/lib/stripe/stripe-server"

export async function createRecurringDonationCheckout(
  supabase: SupabaseClient,
  input: CreateRecurringDonationCheckoutInput
) {
  if (!input.amount || input.amount <= 0) {
    throw new Error("Amount must be greater than zero")
  }

  const amountCents = Math.round(input.amount * 100)
  if (amountCents < 50) {
    throw new Error("Minimum donation amount is $0.50")
  }

  const attributionCheck = await validateCustomerDonationAttribution(supabase, input.organizationId, {
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
  })

  if (!attributionCheck.ok) {
    throw new Error(attributionCheck.error)
  }

  const startDate = new Date().toISOString().slice(0, 10)
  const nextPaymentDate = initialNextPaymentDate(startDate, input.frequency)

  const { data: planRow, error: planError } = await supabase
    .from("recurring_donation_plans")
    .insert({
      organization_id: input.organizationId,
      donor_id: input.donorId,
      contact_id: input.contactId,
      campaign_id: input.campaignId ?? null,
      campaign_group_id: input.campaignGroupId ?? null,
      attributed_group_contact_id: input.attributedGroupContactId ?? null,
      wishlist_item_id: input.wishlistItemId ?? null,
      category_id: input.categoryId ?? null,
      subcategory_id: input.subcategoryId ?? null,
      amount: input.amount,
      frequency: input.frequency,
      status: "pending_setup",
      start_date: startDate,
      next_payment_date: nextPaymentDate,
      notes: "Stripe recurring setup — awaiting Checkout completion",
    })
    .select("id")
    .single()

  if (planError || !planRow?.id) {
    throw new Error(planError?.message || "Could not create recurring donation plan")
  }

  const baseUrl = getAppBaseUrl()
  const successUrl =
    input.successUrl ??
    `${baseUrl}/customer/donation?checkout=success&type=recurring&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl =
    input.cancelUrl ?? `${baseUrl}/customer/donation?checkout=cancelled&type=recurring`

  const { data: checkoutRow, error: checkoutError } = await supabase
    .from("donation_checkout_sessions")
    .insert({
      organization_id: input.organizationId,
      checkout_type: "recurring_setup",
      donor_id: input.donorId,
      contact_id: input.contactId,
      campaign_id: input.campaignId ?? null,
      campaign_group_id: input.campaignGroupId ?? null,
      attributed_group_contact_id: input.attributedGroupContactId ?? null,
      wishlist_item_id: input.wishlistItemId ?? null,
      category_id: input.categoryId ?? null,
      subcategory_id: input.subcategoryId ?? null,
      recurring_donation_plan_id: planRow.id,
      amount: input.amount,
      currency: "USD",
      status: "open",
      metadata: {
        donor_email: input.donorEmail ?? null,
        donor_name: input.donorName ?? null,
        frequency: input.frequency,
        campaign_group_id: input.campaignGroupId ?? null,
        attributed_group_contact_id: input.attributedGroupContactId ?? null,
        wishlist_item_id: input.wishlistItemId ?? null,
      },
    })
    .select("id")
    .single()

  if (checkoutError || !checkoutRow?.id) {
    await supabase.from("recurring_donation_plans").delete().eq("id", planRow.id)
    throw new Error(checkoutError?.message || "Could not create checkout session row")
  }

  const metadata = buildDonationCheckoutMetadata({
    organizationId: input.organizationId,
    donorId: input.donorId,
    contactId: input.contactId,
    campaignId: input.campaignId,
    campaignGroupId: input.campaignGroupId,
    attributedGroupContactId: input.attributedGroupContactId,
    wishlistItemId: input.wishlistItemId,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    recurringDonationPlanId: planRow.id,
    checkoutType: "recurring_setup",
    manarateeCheckoutId: checkoutRow.id,
  })

  const connectedAccountId = await requireOrganizationStripeConnectAccountId(
    supabase,
    input.organizationId
  )

  const recurring = stripeRecurringInterval(input.frequency)
  const stripe = getStripeServerClient()
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: input.donorEmail?.trim() || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            recurring,
            product_data: {
              name: input.productName?.trim() || "Recurring Donation",
              description:
                input.productDescription?.trim() ||
                `${input.frequency} online donation`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata as unknown as Stripe.MetadataParam,
      subscription_data: {
        metadata: metadata as unknown as Stripe.MetadataParam,
      },
    },
    stripeConnectRequestOptions(connectedAccountId)
  )

  if (!session.url || !session.id) {
    await supabase.from("recurring_donation_plans").delete().eq("id", planRow.id)
    await supabase.from("donation_checkout_sessions").delete().eq("id", checkoutRow.id)
    throw new Error("Stripe did not return a checkout URL")
  }

  const { error: updateError } = await supabase
    .from("donation_checkout_sessions")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", checkoutRow.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    checkoutSessionId: checkoutRow.id,
    stripeCheckoutSessionId: session.id,
    checkoutUrl: session.url,
    recurringDonationPlanId: planRow.id,
  }
}
