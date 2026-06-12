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

  const [
    categoriesResult,
    subcategoriesResult,
    paymentMethodsResult,
    pledgesResult,
    paymentsResult,
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
    supabase
      .from("donation_pledges")
      .select("*")
      .eq("contact_id", contactId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("donation_payments")
      .select("*")
      .eq("contact_id", contactId)
      .eq("organization_id", organizationId)
      .order("payment_date", { ascending: false }),
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
  }
}
