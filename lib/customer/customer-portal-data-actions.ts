"use server"

import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { loadCustomerFamilyMembers } from "@/lib/customer/customer-family-actions"

export async function loadCustomerProfilePortalData() {
  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    return { ok: false as const, error: "No active organization" }
  }

  const organizationId = activeOrganization.organization_id

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
      .select("id, name, category_id")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true }),
    supabase
      .from("payment_methods")
      .select("id, name, fee")
      .eq("organization_id", organizationId)
      .eq("enabled", true)
      .order("name", { ascending: true }),
    donorIds.length > 0
      ? supabase
          .from("pledge_status_view")
          .select(
            "id, donor_id, donor_name, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, frequency, pledge_date"
          )
          .eq("organization_id", organizationId)
          .in("donor_id", donorIds)
          .order("pledge_date", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("payments")
      .select(
        "id, amount, payment_date, source, status, memo, pledge_id, campaign_id, category_id, subcategory_id"
      )
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .order("payment_date", { ascending: false }),
    supabase
      .from("campaigns")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true }),
  ])

  const categories = (categoriesResult.data || []).map((category) => ({
    id: category.id as string,
    name: category.name as string,
    funds: (subcategoriesResult.data || [])
      .filter((fund) => fund.category_id === category.id)
      .map((fund) => ({
        id: fund.id as string,
        name: fund.name as string,
        category_id: fund.category_id as string,
      })),
  }))

  return {
    ok: true as const,
    isSupportSession: session.isSupportSession,
    contact,
    categories,
    paymentMethods: paymentMethodsResult.data || [],
    pledges: pledgesResult.data || [],
    payments: paymentsResult.data || [],
    campaigns: campaignsResult.data || [],
  }
}
