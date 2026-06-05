import type { SupabaseClient } from "@supabase/supabase-js"

import {
  ORG_ADMIN_DASHBOARD_ROLES,
} from "@/lib/organizations/organization-member-constants"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import type { UserPortalCapabilities } from "@/lib/auth/portal-capabilities-types"

function isOrgAdminDashboardRole(role: string | null | undefined) {
  return ORG_ADMIN_DASHBOARD_ROLES.includes(
    role as (typeof ORG_ADMIN_DASHBOARD_ROLES)[number]
  )
}

export async function fetchUserPortalCapabilities(
  supabase: SupabaseClient,
  userId: string,
  organizationId?: string | null
): Promise<UserPortalCapabilities> {
  if (!organizationId) {
    return {
      hasPersonalPortal: false,
      hasTeachingPortal: false,
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

  let hasAdminPanel = false

  if (membership?.role_id) {
    const { data: permissionRows } = await supabase
      .from("role_permissions")
      .select("permission_key")
      .eq("role_id", membership.role_id)
      .in("permission_key", [
        PERMISSIONS.PROGRAMS_MANAGE,
        PERMISSIONS.PROGRAMS_VIEW,
      ])

    hasAdminPanel = Boolean(permissionRows?.length)
  }

  if (!hasAdminPanel && membership?.role) {
    hasAdminPanel = isOrgAdminDashboardRole(membership.role)
  }

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

  return {
    hasPersonalPortal,
    hasTeachingPortal,
    hasAdminPortal: hasAdminPanel,
  }
}
