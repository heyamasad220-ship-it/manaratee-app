"use server"

import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import { createOneTimeDonationCheckout } from "@/lib/donations/stripe/checkout"
import { createRecurringDonationCheckout } from "@/lib/donations/stripe/recurring-checkout"
import type { RecurringStripeFrequency } from "@/lib/donations/stripe/types"
import { isStripeConfigured } from "@/lib/stripe/stripe-server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function createOneTimeDonationCheckoutAction(input: {
  amount: number
  campaignId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
}) {
  if (!isStripeConfigured()) {
    return { success: false as const, error: "Online payments are not configured" }
  }

  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    return { success: false as const, error: "No active organization" }
  }

  const organizationId = activeOrganization.organization_id

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name, email, organization_id")
    .eq("auth_user_id", session.effectiveUserId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (contactError || !contact) {
    return { success: false as const, error: "Contact not found" }
  }

  const donorId = await ensureDonorExtensionForContact(organizationId, contact.id)
  if (!donorId) {
    return { success: false as const, error: "Could not resolve donor profile" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()
    const checkout = await createOneTimeDonationCheckout(serviceSupabase, {
      organizationId,
      donorId,
      contactId: contact.id,
      amount: input.amount,
      campaignId: input.campaignId ?? null,
      categoryId: input.categoryId ?? null,
      subcategoryId: input.subcategoryId ?? null,
      donorEmail: contact.email,
      donorName: contact.full_name,
    })

    return { success: true as const, checkoutUrl: checkout.checkoutUrl }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not start checkout",
    }
  }
}

export async function createRecurringDonationCheckoutAction(input: {
  amount: number
  frequency: RecurringStripeFrequency
  campaignId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
}) {
  if (!isStripeConfigured()) {
    return { success: false as const, error: "Online payments are not configured" }
  }

  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    return { success: false as const, error: "No active organization" }
  }

  const organizationId = activeOrganization.organization_id

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name, email, organization_id")
    .eq("auth_user_id", session.effectiveUserId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (contactError || !contact) {
    return { success: false as const, error: "Contact not found" }
  }

  const donorId = await ensureDonorExtensionForContact(organizationId, contact.id)
  if (!donorId) {
    return { success: false as const, error: "Could not resolve donor profile" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()
    const checkout = await createRecurringDonationCheckout(serviceSupabase, {
      organizationId,
      donorId,
      contactId: contact.id,
      amount: input.amount,
      frequency: input.frequency,
      campaignId: input.campaignId ?? null,
      categoryId: input.categoryId ?? null,
      subcategoryId: input.subcategoryId ?? null,
      donorEmail: contact.email,
      donorName: contact.full_name,
    })

    return {
      success: true as const,
      checkoutUrl: checkout.checkoutUrl,
      recurringDonationPlanId: checkout.recurringDonationPlanId,
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not start recurring checkout",
    }
  }
}

export async function getDonationCheckoutStatusAction(stripeCheckoutSessionId: string) {
  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    return { success: false as const, error: "No active organization" }
  }

  const organizationId = activeOrganization.organization_id

  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("auth_user_id", session.effectiveUserId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!contact?.id) {
    return { success: false as const, error: "Contact not found" }
  }

  const { data: checkoutSession, error } = await supabase
    .from("donation_checkout_sessions")
    .select(
      "id, status, amount, payment_id, stripe_checkout_session_id, campaign_id, category_id, subcategory_id, checkout_type, recurring_donation_plan_id"
    )
    .eq("organization_id", organizationId)
    .eq("contact_id", contact.id)
    .eq("stripe_checkout_session_id", stripeCheckoutSessionId)
    .maybeSingle()

  if (error || !checkoutSession) {
    return { success: false as const, error: "Checkout session not found" }
  }

  let payment: {
    id: string
    amount: number
    payment_date: string | null
    source: string | null
    status: string | null
    campaign_id: string | null
    category_id: string | null
    subcategory_id: string | null
  } | null = null

  if (checkoutSession.payment_id) {
    const { data: paymentRow } = await supabase
      .from("payments")
      .select(
        "id, amount, payment_date, source, status, campaign_id, category_id, subcategory_id"
      )
      .eq("id", checkoutSession.payment_id)
      .maybeSingle()

    payment = paymentRow ?? null
  }

  let recurringPlan: {
    id: string
    status: string
    frequency: string
    amount: number
    external_processor: string | null
    external_processor_id: string | null
    next_payment_date: string
  } | null = null

  if (checkoutSession.recurring_donation_plan_id) {
    const { data: planRow } = await supabase
      .from("recurring_donation_plans")
      .select(
        "id, status, frequency, amount, external_processor, external_processor_id, next_payment_date"
      )
      .eq("id", checkoutSession.recurring_donation_plan_id)
      .maybeSingle()

    recurringPlan = planRow ?? null
  }

  return {
    success: true as const,
    status: checkoutSession.status as string,
    checkoutType: checkoutSession.checkout_type as string,
    amount: Number(checkoutSession.amount || payment?.amount || 0),
    payment,
    recurringPlan,
  }
}
