"use server"

import { revalidatePath } from "next/cache"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { loadOrganizationStripeConnect } from "@/lib/stripe/stripe-connect-queries"
import { syncOrganizationStripeConnectFromAccount } from "@/lib/stripe/stripe-connect-sync"
import {
  isOrganizationStripeConnectReady,
  type OrganizationStripeConnectStatus,
} from "@/lib/stripe/stripe-connect-types"
import { getAppBaseUrl, getStripeServerClient, isStripeConfigured } from "@/lib/stripe/stripe-server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function connectSettingsPath() {
  return "/donations/settings?tab=online-payments"
}

export async function getOrganizationStripeConnectStatusAction(): Promise<
  | {
      success: true
      platformConfigured: boolean
      status: OrganizationStripeConnectStatus
      ready: boolean
    }
  | { success: false; error: string }
> {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) {
    return { success: false, error: access.error }
  }

  try {
    const serviceSupabase = createServiceRoleClient()
    const status = await loadOrganizationStripeConnect(serviceSupabase, access.orgId)

    return {
      success: true,
      platformConfigured: isStripeConfigured(),
      status,
      ready: isOrganizationStripeConnectReady(status),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not load Stripe Connect status",
    }
  }
}

export async function syncOrganizationStripeConnectStatusAction(): Promise<
  | { success: true; status: OrganizationStripeConnectStatus; ready: boolean }
  | { success: false; error: string }
> {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) {
    return { success: false, error: access.error }
  }

  if (!isStripeConfigured()) {
    return { success: false, error: "Stripe is not configured on this environment." }
  }

  try {
    const serviceSupabase = createServiceRoleClient()
    const current = await loadOrganizationStripeConnect(serviceSupabase, access.orgId)

    if (!current.stripeConnectAccountId) {
      return { success: false, error: "No Stripe Connect account exists for this organization." }
    }

    const stripe = getStripeServerClient()
    const account = await stripe.accounts.retrieve(current.stripeConnectAccountId)
    const status = await syncOrganizationStripeConnectFromAccount(serviceSupabase, account)

    revalidatePath("/donations/settings")

    return {
      success: true,
      status,
      ready: isOrganizationStripeConnectReady(status),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not sync Stripe Connect status",
    }
  }
}

export async function startOrganizationStripeConnectOnboardingAction(): Promise<
  | { success: true; onboardingUrl: string }
  | { success: false; error: string }
> {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) {
    return { success: false, error: access.error }
  }

  if (!isStripeConfigured()) {
    return {
      success: false,
      error: "Stripe is not configured on this environment. Contact Manaratee support.",
    }
  }

  try {
    const serviceSupabase = createServiceRoleClient()
    const stripe = getStripeServerClient()
    const baseUrl = getAppBaseUrl()
    const returnPath = connectSettingsPath()
    const refreshUrl = `${baseUrl}${returnPath}&connect=refresh`
    const returnUrl = `${baseUrl}${returnPath}&connect=return`

    let current = await loadOrganizationStripeConnect(serviceSupabase, access.orgId)
    let accountId = current.stripeConnectAccountId

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          organization_id: access.orgId,
          manaratee_connect: "donations",
        },
      })

      accountId = account.id

      const { error: updateError } = await serviceSupabase
        .from("organizations")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", access.orgId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      current = await loadOrganizationStripeConnect(serviceSupabase, access.orgId)
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    })

    if (!accountLink.url) {
      throw new Error("Stripe did not return an onboarding URL")
    }

    return { success: true, onboardingUrl: accountLink.url }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not start Stripe Connect onboarding",
    }
  }
}

export async function createOrganizationStripeConnectDashboardLinkAction(): Promise<
  | { success: true; dashboardUrl: string }
  | { success: false; error: string }
> {
  const access = await requireDonationStaffAccess("manage")
  if (!access.ok) {
    return { success: false, error: access.error }
  }

  if (!isStripeConfigured()) {
    return { success: false, error: "Stripe is not configured on this environment." }
  }

  try {
    const serviceSupabase = createServiceRoleClient()
    const current = await loadOrganizationStripeConnect(serviceSupabase, access.orgId)

    if (!current.stripeConnectAccountId) {
      return { success: false, error: "Connect Stripe before opening the Express dashboard." }
    }

    const stripe = getStripeServerClient()
    const link = await stripe.accounts.createLoginLink(current.stripeConnectAccountId)

    if (!link.url) {
      throw new Error("Stripe did not return a dashboard URL")
    }

    return { success: true, dashboardUrl: link.url }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not open Stripe dashboard",
    }
  }
}
