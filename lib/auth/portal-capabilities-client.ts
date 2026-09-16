import type { SupabaseClient } from "@supabase/supabase-js"

import type { UserPortalCapabilities } from "@/lib/auth/portal-capabilities-types"
import { resolvePortalPermissions } from "@/lib/auth/resolve-portal-permissions"
import { resolveStaffToolsPortalAccess } from "@/lib/auth/staff-tools-eligibility"
import { resolveStaffIdentityForUser } from "@/lib/organizations/work-email-lookups"

export async function fetchUserPortalCapabilities(
  supabase: SupabaseClient,
  userId: string,
  organizationId?: string | null
): Promise<UserPortalCapabilities> {
  if (!organizationId) {
    return {
      hasPersonalPortal: false,
      hasTeachingPortal: false,
      hasStaffToolsPortal: false,
      canManageEventRequests: false,
      hasAdminPortal: false,
    }
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, role_id, assigned_contact_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  const identity = await resolveStaffIdentityForUser(
    supabase,
    organizationId,
    userId
  )

  const teachingContactId = identity.staffContactId || identity.personalContactId
  let hasTeachingPortal = false

  if (teachingContactId) {
    const { count } = await supabase
      .from("program_staff_assignments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("contact_id", teachingContactId)
      .eq("is_active", true)

    hasTeachingPortal = (count ?? 0) > 0
  }

  const hasPersonalPortal = identity.isWorkLogin
    ? false
    : Boolean(identity.personalContactId) || membership?.role === "viewer"

  const portalPermissions = await resolvePortalPermissions(
    supabase,
    organizationId,
    membership
  )

  const hasStaffToolsPortal = await resolveStaffToolsPortalAccess(
    supabase,
    organizationId,
    userId,
    membership,
    identity.staffContactId
  )

  return {
    hasPersonalPortal,
    hasTeachingPortal,
    hasStaffToolsPortal,
    canManageEventRequests: portalPermissions.canManageEventRequests,
    hasAdminPortal: portalPermissions.hasAdminPortal,
  }
}
