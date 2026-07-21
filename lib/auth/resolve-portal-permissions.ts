import type { SupabaseClient } from "@supabase/supabase-js"

import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permission-keys"
import {
  ORG_ADMIN_DASHBOARD_ROLES,
} from "@/lib/organizations/organization-member-constants"

const STAFF_TOOLS_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.EVENTS_VIEW,
  PERMISSIONS.EVENTS_MANAGE,
  PERMISSIONS.PROGRAMS_VIEW,
  PERMISSIONS.PROGRAMS_MANAGE,
]

const EVENT_MANAGE_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.EVENTS_MANAGE,
  PERMISSIONS.PROGRAMS_MANAGE,
]

const ADMIN_PANEL_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.PROGRAMS_MANAGE,
  PERMISSIONS.PROGRAMS_VIEW,
]

function isOrgAdminDashboardRole(role: string | null | undefined) {
  return ORG_ADMIN_DASHBOARD_ROLES.includes(
    role as (typeof ORG_ADMIN_DASHBOARD_ROLES)[number]
  )
}

async function roleHasAnyPermission(
  supabase: SupabaseClient,
  organizationId: string,
  role: string | null | undefined,
  roleId: string | null | undefined,
  permissionKeys: PermissionKey[]
): Promise<boolean> {
  if (role === "owner") {
    return true
  }

  if (!roleId) {
    return false
  }

  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("organization_id", organizationId)
    .eq("role_id", roleId)
    .eq("enabled", true)
    .in("permission_key", permissionKeys)

  if (error) {
    console.error(error)
    return false
  }

  return (data?.length ?? 0) > 0
}

export type ResolvedPortalPermissions = {
  hasStaffToolsPortal: boolean
  canManageEventRequests: boolean
  hasAdminPortal: boolean
}

export async function resolvePortalPermissions(
  supabase: SupabaseClient,
  organizationId: string,
  membership: {
    role: string | null
    role_id: string | null
  } | null
): Promise<ResolvedPortalPermissions> {
  if (!membership) {
    return {
      hasStaffToolsPortal: false,
      canManageEventRequests: false,
      hasAdminPortal: false,
    }
  }

  const [hasStaffToolsPortal, canManageEventRequests, hasProgramsAccess] =
    await Promise.all([
      roleHasAnyPermission(
        supabase,
        organizationId,
        membership.role,
        membership.role_id,
        STAFF_TOOLS_PERMISSIONS
      ),
      roleHasAnyPermission(
        supabase,
        organizationId,
        membership.role,
        membership.role_id,
        EVENT_MANAGE_PERMISSIONS
      ),
      roleHasAnyPermission(
        supabase,
        organizationId,
        membership.role,
        membership.role_id,
        ADMIN_PANEL_PERMISSIONS
      ),
    ])

  const hasAdminPortal =
    hasProgramsAccess || isOrgAdminDashboardRole(membership.role)

  return {
    hasStaffToolsPortal,
    canManageEventRequests,
    hasAdminPortal,
  }
}

export function countAvailablePortals(input: {
  hasPersonalPortal: boolean
  hasStaffToolsPortal: boolean
  hasTeachingPortal: boolean
  hasAdminPortal: boolean
}): number {
  return [
    input.hasPersonalPortal,
    input.hasStaffToolsPortal,
    input.hasTeachingPortal,
    input.hasAdminPortal,
  ].filter(Boolean).length
}

/**
 * Portal switcher is only for users who have a personal (customer) account
 * and at least one staff-side portal (admin dashboard, staff tools, or teaching).
 * Staff-only users (e.g. admin@org with no customer login) should not see it.
 */
export function shouldShowPortalSwitcher(input: {
  hasPersonalPortal: boolean
  hasStaffToolsPortal: boolean
  hasTeachingPortal: boolean
  hasAdminPortal: boolean
}): boolean {
  if (!input.hasPersonalPortal) {
    return false
  }

  return (
    input.hasStaffToolsPortal ||
    input.hasTeachingPortal ||
    input.hasAdminPortal
  )
}
