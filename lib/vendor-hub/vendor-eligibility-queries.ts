import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"

export type ApprovedVendorOrg = {
  organizationId: string
  organizationName: string
  contactId: string
}

export async function getContactIdsForAuthUser(
  supabase: SupabaseClient,
  authUserId: string
): Promise<{ id: string; organization_id: string }[]> {
  const { data } = await supabase
    .from("contacts")
    .select("id, organization_id")
    .eq("auth_user_id", authUserId)

  return (data ?? []) as { id: string; organization_id: string }[]
}

export async function isApprovedOrgVendor(input: {
  supabase: SupabaseClient
  organizationId: string
  contactId: string
}): Promise<boolean> {
  const { supabase, organizationId, contactId } = input

  if (
    await hasApprovedOrgVendorApplication({
      supabase,
      organizationId,
      contactId,
    })
  ) {
    return true
  }

  const { count: roleCount } = await supabase
    .from("contact_roles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("role", "vendor")

  return (roleCount ?? 0) > 0
}

/** True only when an approved org vendor application exists (ignores contact_roles). */
export async function hasApprovedOrgVendorApplication(input: {
  supabase: SupabaseClient
  organizationId: string
  contactId: string
}): Promise<boolean> {
  const { count } = await input.supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("contact_id", input.contactId)
    .eq("module_owner", VENDOR_ORG_APPLICATION_MODULE)
    .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
    .eq("status", "approved")

  return (count ?? 0) > 0
}

export async function getApprovedVendorOrganizationsForAuthUser(
  authUserId: string
): Promise<ApprovedVendorOrg[]> {
  const supabase = await createClient()
  const contacts = await getContactIdsForAuthUser(supabase, authUserId)

  if (contacts.length === 0) {
    return []
  }

  const orgIds = [...new Set(contacts.map((row) => row.organization_id))]
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", orgIds)

  const orgNameById = new Map(
    (organizations ?? []).map((row) => [row.id as string, row.name as string])
  )

  const approved: ApprovedVendorOrg[] = []

  for (const contact of contacts) {
    const ok = await isApprovedOrgVendor({
      supabase,
      organizationId: contact.organization_id,
      contactId: contact.id,
    })
    if (ok) {
      approved.push({
        organizationId: contact.organization_id,
        organizationName:
          orgNameById.get(contact.organization_id) ?? "Community organization",
        contactId: contact.id,
      })
    }
  }

  return approved
}

export async function isAuthUserApprovedVendorForOrganization(
  authUserId: string,
  organizationId: string
): Promise<boolean> {
  const supabase = await createClient()
  const contacts = await getContactIdsForAuthUser(supabase, authUserId)
  const contact = contacts.find((row) => row.organization_id === organizationId)
  if (!contact) {
    return false
  }

  return isApprovedOrgVendor({
    supabase,
    organizationId,
    contactId: contact.id,
  })
}

export async function hasPendingOrgVendorApplication(input: {
  supabase: SupabaseClient
  organizationId: string
  contactId: string
}): Promise<boolean> {
  const { count } = await input.supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("contact_id", input.contactId)
    .eq("module_owner", VENDOR_ORG_APPLICATION_MODULE)
    .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
    .in("status", ["submitted", "pending_review", "draft"])

  return (count ?? 0) > 0
}
