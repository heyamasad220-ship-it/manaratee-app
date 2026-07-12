"use server"

import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { buildCustomerOpenDonationCategories } from "@/lib/customer/customer-open-donation-categories"
import { loadCustomerPortalEnabledModuleSlugs } from "@/lib/customer/customer-portal-modules-server"
import { loadCustomerFamilyMembers } from "@/lib/customer/customer-family-actions"

export async function loadCustomerProfilePortalData() {
  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    return { ok: false as const, error: "No active organization" }
  }

  const organizationId = activeOrganization.organization_id

  const enabledModuleSlugs = Array.from(
    await loadCustomerPortalEnabledModuleSlugs(organizationId)
  )

  const { data: contact, error } = await supabase
    .from("contacts")
    .select(
      "id, organization_id, person_id, full_name, email, phone, address, city, state, zip, country, notes, created_at"
    )
    .eq("auth_user_id", session.effectiveUserId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !contact) {
    return { ok: false as const, error: error?.message || "Contact not found" }
  }

  const contactId = contact.id as string

  const { data: paymentMethodRows } = await supabase
    .from("contact_payment_methods")
    .select(
      "id, card_brand, last4, exp_month, exp_year, cardholder_name, is_default, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  let familyMembers: Awaited<ReturnType<typeof loadCustomerFamilyMembers>> = []

  if (contact.person_id) {
    familyMembers = await loadCustomerFamilyMembers({
      organizationId,
      parentPersonId: contact.person_id as string,
    })
  }

  return {
    ok: true as const,
    isSupportSession: session.isSupportSession,
    contact,
    familyMembers,
    accountEmail: session.authenticatedUser.email ?? null,
    enabledModuleSlugs,
    paymentMethods: (paymentMethodRows || []).map((row) => ({
      id: row.id as string,
      cardBrand: (row.card_brand as string | null) ?? null,
      last4: row.last4 as string,
      expMonth: row.exp_month == null ? null : Number(row.exp_month),
      expYear: row.exp_year == null ? null : Number(row.exp_year),
      cardholderName: (row.cardholder_name as string | null) ?? null,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at as string,
    })),
  }
}

export async function loadCustomerDonationPortalData() {
  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    return { ok: false as const, error: "No active organization" }
  }

  const organizationId = activeOrganization.organization_id

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name, email, organization_id")
    .eq("auth_user_id", session.effectiveUserId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (contactError || !contact) {
    return { ok: false as const, error: "Contact not found" }
  }

  const contactId = contact.id as string

  const { data: donorRows } = await supabase
    .from("donors")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)

  const donorIds = (donorRows || []).map((row) => row.id as string)

  const [
    categoriesResult,
    subcategoriesResult,
    paymentMethodsResult,
    contactPaymentMethodsResult,
    pledgesResult,
    paymentsResult,
    campaignsResult,
  ] = await Promise.all([
    supabase
      .from("donation_categories")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true }),
    supabase
      .from("donation_subcategories")
      .select("id, name, category_id, is_active")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true }),
    supabase
      .from("payment_methods")
      .select("id, name, fee")
      .eq("organization_id", organizationId)
      .eq("enabled", true)
      .order("name", { ascending: true }),
    supabase
      .from("contact_payment_methods")
      .select(
        "id, card_brand, last4, exp_month, exp_year, cardholder_name, is_default, created_at"
      )
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    donorIds.length > 0
      ? supabase
          .from("pledge_status_view")
          .select(
            "id, donor_id, donor_name, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, frequency, pledge_date, installment_amount, total_payments, first_payment_date, next_payment_date"
          )
          .eq("organization_id", organizationId)
          .in("donor_id", donorIds)
          .order("pledge_date", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("payments")
      .select(
        "id, amount, payment_date, source, status, memo, pledge_id, campaign_id, category_id, subcategory_id, recurring_donation_plan_id"
      )
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .order("payment_date", { ascending: false }),
    supabase
      .from("campaigns")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("name", { ascending: true }),
  ])

  const categories = buildCustomerOpenDonationCategories(
    (categoriesResult.data || []) as Array<{ id: string; name: string }>,
    (subcategoriesResult.data || []) as Array<{
      id: string
      name: string
      category_id: string
      is_active?: boolean | null
    }>
  )

  const pledgePaymentRows = (paymentsResult.data || []).filter((row) => row.pledge_id)
  const paymentsMadeByPledgeId = new Map<string, number>()
  for (const row of pledgePaymentRows) {
    const pledgeId = row.pledge_id as string
    paymentsMadeByPledgeId.set(pledgeId, (paymentsMadeByPledgeId.get(pledgeId) || 0) + 1)
  }

  const pledges = (pledgesResult.data || []).map((row) => ({
    ...row,
    payments_made: paymentsMadeByPledgeId.get(row.id as string) || 0,
  }))

  return {
    ok: true as const,
    isSupportSession: session.isSupportSession,
    contact,
    categories,
    paymentMethods: paymentMethodsResult.data || [],
    contactPaymentMethods: (contactPaymentMethodsResult.data || []).map((row) => ({
      id: row.id as string,
      cardBrand: (row.card_brand as string | null) ?? null,
      last4: row.last4 as string,
      expMonth: row.exp_month == null ? null : Number(row.exp_month),
      expYear: row.exp_year == null ? null : Number(row.exp_year),
      cardholderName: (row.cardholder_name as string | null) ?? null,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at as string,
    })),
    pledges,
    payments: paymentsResult.data || [],
    campaigns: campaignsResult.data || [],
  }
}
