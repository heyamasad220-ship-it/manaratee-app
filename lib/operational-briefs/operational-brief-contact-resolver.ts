import type { SupabaseClient } from "@supabase/supabase-js"

export type ResolvedOperationalContact = {
  contactId: string | null
  fullName: string | null
  phone: string | null
  email: string | null
}

export async function resolveContactById(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string | null | undefined
): Promise<ResolvedOperationalContact | null> {
  if (!contactId) return null

  const withPrimarySelect = "id, full_name, phone, email, primary_contact_name, contact_type"
  const baseSelect = "id, full_name, phone, email, contact_type"

  let { data: contact, error } = await supabase
    .from("contacts")
    .select(withPrimarySelect)
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (error?.message?.includes("primary_contact_name")) {
    const fallback = await supabase
      .from("contacts")
      .select(baseSelect)
      .eq("organization_id", organizationId)
      .eq("id", contactId)
      .maybeSingle()
    contact = fallback.data
    error = fallback.error
  }

  if (error || !contact) return null

  const isOrganization = contact.contact_type === "organization"
  const primaryContactName =
    "primary_contact_name" in contact
      ? (contact.primary_contact_name as string | null)
      : null

  return {
    contactId: contact.id as string,
    fullName: isOrganization
      ? primaryContactName || (contact.full_name as string | null)
      : (contact.full_name as string | null),
    phone: contact.phone as string | null,
    email: contact.email as string | null,
  }
}

export async function resolveContactForAuthUser(
  supabase: SupabaseClient,
  organizationId: string,
  authUserId: string | null | undefined
): Promise<ResolvedOperationalContact | null> {
  if (!authUserId) return null

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, phone, email")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  if (contact) {
    return {
      contactId: contact.id as string,
      fullName: contact.full_name as string | null,
      phone: contact.phone as string | null,
      email: contact.email as string | null,
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", authUserId)
    .maybeSingle()

  if (!profile) return null

  return {
    contactId: null,
    fullName: profile.full_name as string | null,
    phone: null,
    email: profile.email as string | null,
  }
}

export async function resolveInternalCoordinatorContact(
  supabase: SupabaseClient,
  organizationId: string,
  authUserId: string | null | undefined
): Promise<ResolvedOperationalContact | null> {
  return resolveContactForAuthUser(supabase, organizationId, authUserId)
}
