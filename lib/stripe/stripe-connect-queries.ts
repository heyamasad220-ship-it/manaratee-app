import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isOrganizationStripeConnectReady,
  mapOrganizationStripeConnectRow,
  type OrganizationStripeConnectStatus,
} from "@/lib/stripe/stripe-connect-types"

const STRIPE_CONNECT_COLUMNS =
  "stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details_submitted, stripe_connect_onboarded_at"

export async function loadOrganizationStripeConnect(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrganizationStripeConnectStatus> {
  const { data, error } = await supabase
    .from("organizations")
    .select(STRIPE_CONNECT_COLUMNS)
    .eq("id", organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return mapOrganizationStripeConnectRow(data)
}

export async function requireOrganizationStripeConnectAccountId(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string> {
  const status = await loadOrganizationStripeConnect(supabase, organizationId)

  if (!isOrganizationStripeConnectReady(status) || !status.stripeConnectAccountId) {
    throw new Error(
      "Online donations are not enabled. Connect Stripe in Donations Settings → Online Payments."
    )
  }

  return status.stripeConnectAccountId
}

export function stripeConnectRequestOptions(connectedAccountId: string) {
  return { stripeAccount: connectedAccountId }
}
