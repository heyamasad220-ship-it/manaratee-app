import type { SupabaseClient } from "@supabase/supabase-js"

import type { UserPortalCapabilities } from "@/lib/auth/portal-capabilities-types"
import { resolvePortalPermissions } from "@/lib/auth/resolve-portal-permissions"
import { resolveStaffToolsPortalAccess } from "@/lib/auth/staff-tools-eligibility"

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
    .select("role, role_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", userId)
    .maybeSingle()

  let hasTeachingPortal = false

  if (contact?.id) {
    const { count } = await supabase
      .from("program_staff_assignments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("contact_id", contact.id)
      .eq("is_active", true)

    hasTeachingPortal = (count ?? 0) > 0
  }

  const hasPersonalPortal = Boolean(contact?.id) || membership?.role === "viewer"

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
    contact?.id
  )

  return {
    hasPersonalPortal,
    hasTeachingPortal,
    hasStaffToolsPortal,
    canManageEventRequests: portalPermissions.canManageEventRequests,
    hasAdminPortal: portalPermissions.hasAdminPortal,
  }
}
