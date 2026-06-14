import type { SupabaseClient } from "@supabase/supabase-js"

export type CheckoutSessionRow = {
  id: string
  organization_id: string
  donor_id: string | null
  contact_id: string | null
  campaign_id: string | null
  category_id: string | null
  subcategory_id: string | null
  payment_id: string | null
  status: string
}

export async function loadCheckoutSession(
  supabase: SupabaseClient,
  input: {
    manarateeCheckoutId?: string | null
    stripeCheckoutSessionId?: string | null
  }
): Promise<CheckoutSessionRow | null> {
  if (input.manarateeCheckoutId) {
    const { data } = await supabase
      .from("donation_checkout_sessions")
      .select(
        "id, organization_id, donor_id, contact_id, campaign_id, category_id, subcategory_id, payment_id, status"
      )
      .eq("id", input.manarateeCheckoutId)
      .maybeSingle()
    if (data) return data as CheckoutSessionRow
  }

  if (input.stripeCheckoutSessionId) {
    const { data } = await supabase
      .from("donation_checkout_sessions")
      .select(
        "id, organization_id, donor_id, contact_id, campaign_id, category_id, subcategory_id, payment_id, status"
      )
      .eq("stripe_checkout_session_id", input.stripeCheckoutSessionId)
      .maybeSingle()
    if (data) return data as CheckoutSessionRow
  }

  return null
}

export async function markCheckoutSessionStatus(
  supabase: SupabaseClient,
  input: {
    manarateeCheckoutId?: string | null
    stripeCheckoutSessionId?: string | null
    status: "expired" | "failed" | "open" | "complete"
  }
) {
  const checkoutSession = await loadCheckoutSession(supabase, input)
  if (!checkoutSession?.id) return null

  await supabase
    .from("donation_checkout_sessions")
    .update({ status: input.status })
    .eq("id", checkoutSession.id)

  return checkoutSession.id
}
