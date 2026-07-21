import type { SupabaseClient } from "@supabase/supabase-js"

import {
  canViewOrganizationBilling,
  isOrganizationSuperAdminRoleName,
  isOrganizationSystemAdmin,
} from "@/lib/organizations/organization-system-admin"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"

export type SidebarPermissionContextPayload = {
  isOwner: boolean
  isSuperAdmin: boolean
  enabledPermissions: string[]
}

export async function buildSidebarPermissionContext(input: {
  supabase: SupabaseClient
  organizationId: string
  userId: string
  membershipRole: string | null
  membershipRoleId: string | null
  platformSupportMode: boolean
}): Promise<SidebarPermissionContextPayload> {
  const { supabase, organizationId, membershipRole, membershipRoleId, platformSupportMode } =
    input

  if (platformSupportMode) {
    return {
      isOwner: true,
      isSuperAdmin: true,
      enabledPermissions: Object.values(PERMISSIONS),
    }
  }

  let organizationRoleName: string | null = null
  if (membershipRoleId) {
    const { data: organizationRole } = await supabase
      .from("organization_roles")
      .select("name")
      .eq("organization_id", organizationId)
      .eq("id", membershipRoleId)
      .maybeSingle()
    organizationRoleName = (organizationRole?.name as string | null) ?? null
  }

  const isOwner = isOrganizationSystemAdmin(membershipRole)
  const isSuperAdmin = canViewOrganizationBilling({
    systemRole: membershipRole,
    organizationRoleName,
    platformSupport: false,
  })

  // System admins and org Super Admin should see every enabled module in the sidebar,
  // even when role_permissions were seeded before a newly enabled module existed.
  if (isOwner || isOrganizationSuperAdminRoleName(organizationRoleName)) {
    return {
      isOwner: true,
      isSuperAdmin: true,
      enabledPermissions: Object.values(PERMISSIONS),
    }
  }

  if (!membershipRoleId) {
    return {
      isOwner: false,
      isSuperAdmin,
      enabledPermissions: [],
    }
  }

  const { data: permissionRows, error } = await supabase
    .from("role_permissions")
    .select("permission_key, enabled")
    .eq("organization_id", organizationId)
    .eq("role_id", membershipRoleId)
    .eq("enabled", true)

  if (error) {
    console.error("Error loading sidebar permissions:", error)
    return {
      isOwner: false,
      isSuperAdmin,
      enabledPermissions: [],
    }
  }

  return {
    isOwner: false,
    isSuperAdmin,
    enabledPermissions: (permissionRows || []).map((row) => row.permission_key as string),
  }
}
