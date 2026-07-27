import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveDepartmentHeadship } from "@/lib/departments/department-headship"
import { resolvePortalPermissions } from "@/lib/auth/resolve-portal-permissions"

/** Contact roles that can use Staff Tools in the member portal. */
export const STAFF_TOOLS_CONTACT_ROLES = ["employee"] as const

export async function contactHasStaffToolsContactRole(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("contact_roles")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .in("role", [...STAFF_TOOLS_CONTACT_ROLES])

  if (error) {
    console.error(error)
    return false
  }

  return (data?.length ?? 0) > 0
}

export async function resolveStaffToolsPortalAccess(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  membership: {
    role: string | null
    role_id: string | null
  } | null,
  contactId?: string | null
): Promise<boolean> {
  const portalPermissions = await resolvePortalPermissions(
    supabase,
    organizationId,
    membership
  )

  if (portalPermissions.hasStaffToolsPortal) {
    return true
  }

  // Department Heads get Staff Tools so they can open My department.
  const headship = await resolveDepartmentHeadship(
    supabase,
    organizationId,
    userId
  )
  if (headship) {
    return true
  }

  let resolvedContactId = contactId

  if (!resolvedContactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("auth_user_id", userId)
      .maybeSingle()

    resolvedContactId = contact?.id
  }

  if (!resolvedContactId) {
    return false
  }

  return contactHasStaffToolsContactRole(
    supabase,
    organizationId,
    resolvedContactId
  )
}

export async function userCanSubmitInternalEventRequest(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<boolean> {
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, role_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  return resolveStaffToolsPortalAccess(
    supabase,
    organizationId,
    userId,
    membership
  )
}
