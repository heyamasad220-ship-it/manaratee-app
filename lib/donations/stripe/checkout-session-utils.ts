import type { SupabaseClient } from "@supabase/supabase-js"

export type CheckoutSessionRow = {
  id: string
  organization_id: string
  donor_id: string | null
  contact_id: string | null
  campaign_id: string | null
  campaign_group_id: string | null
  attributed_group_contact_id: string | null
  category_id: string | null
  subcategory_id: string | null
  payment_id: string | null
  status: string
}

const CHECKOUT_SESSION_SELECT =
  "id, organization_id, donor_id, contact_id, campaign_id, campaign_group_id, attributed_group_contact_id, category_id, subcategory_id, payment_id, status"

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
      .select(CHECKOUT_SESSION_SELECT)
      .eq("id", input.manarateeCheckoutId)
      .maybeSingle()
    if (data) return normalizeCheckoutSessionRow(data)
  }

  if (input.stripeCheckoutSessionId) {
    const { data } = await supabase
      .from("donation_checkout_sessions")
      .select(CHECKOUT_SESSION_SELECT)
      .eq("stripe_checkout_session_id", input.stripeCheckoutSessionId)
      .maybeSingle()
    if (data) return normalizeCheckoutSessionRow(data)
  }

  return null
}

function normalizeCheckoutSessionRow(data: Record<string, unknown>): CheckoutSessionRow {
  return {
    id: data.id as string,
    organization_id: data.organization_id as string,
    donor_id: (data.donor_id as string | null) ?? null,
    contact_id: (data.contact_id as string | null) ?? null,
    campaign_id: (data.campaign_id as string | null) ?? null,
    campaign_group_id: (data.campaign_group_id as string | null) ?? null,
    attributed_group_contact_id: (data.attributed_group_contact_id as string | null) ?? null,
    category_id: (data.category_id as string | null) ?? null,
    subcategory_id: (data.subcategory_id as string | null) ?? null,
    payment_id: (data.payment_id as string | null) ?? null,
    status: data.status as string,
  }
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
