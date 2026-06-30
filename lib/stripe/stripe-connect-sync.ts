import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import { mapOrganizationStripeConnectRow } from "@/lib/stripe/stripe-connect-types"

export async function persistOrganizationStripeConnectStatus(
  supabase: SupabaseClient,
  input: {
    organizationId?: string | null
    stripeConnectAccountId: string
    chargesEnabled: boolean
    payoutsEnabled: boolean
    detailsSubmitted: boolean
  }
) {
  const nowIso = new Date().toISOString()

  let existingOnboardedAt: string | null = null
  if (input.organizationId) {
    const { data } = await supabase
      .from("organizations")
      .select("stripe_connect_onboarded_at")
      .eq("id", input.organizationId)
      .maybeSingle()
    existingOnboardedAt = (data?.stripe_connect_onboarded_at as string | null) ?? null
  } else {
    const { data } = await supabase
      .from("organizations")
      .select("id, stripe_connect_onboarded_at")
      .eq("stripe_connect_account_id", input.stripeConnectAccountId)
      .maybeSingle()
    input.organizationId = (data?.id as string | undefined) ?? input.organizationId
    existingOnboardedAt = (data?.stripe_connect_onboarded_at as string | null) ?? null
  }

  const shouldSetOnboardedAt =
    input.chargesEnabled &&
    input.detailsSubmitted &&
    !existingOnboardedAt

  const patch = {
    stripe_connect_account_id: input.stripeConnectAccountId,
    stripe_connect_charges_enabled: input.chargesEnabled,
    stripe_connect_payouts_enabled: input.payoutsEnabled,
    stripe_connect_details_submitted: input.detailsSubmitted,
    ...(shouldSetOnboardedAt ? { stripe_connect_onboarded_at: nowIso } : {}),
  }

  let query = supabase.from("organizations").update(patch)

  if (input.organizationId) {
    query = query.eq("id", input.organizationId)
  } else {
    query = query.eq("stripe_connect_account_id", input.stripeConnectAccountId)
  }

  const { data, error } = await query.select(STRIPE_CONNECT_SELECT).maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return mapOrganizationStripeConnectRow(data)
}

const STRIPE_CONNECT_SELECT =
  "stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details_submitted, stripe_connect_onboarded_at"

export async function syncOrganizationStripeConnectFromAccount(
  supabase: SupabaseClient,
  account: Stripe.Account
) {
  const organizationId = account.metadata?.organization_id?.trim() || null

  return persistOrganizationStripeConnectStatus(supabase, {
    organizationId,
    stripeConnectAccountId: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
  })
}
