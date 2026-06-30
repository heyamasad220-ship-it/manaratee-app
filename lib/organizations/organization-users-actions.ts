"use server"

import { revalidatePath } from "next/cache"

import {
  ORGANIZATION_AUDIT_ACTIONS,
  writeOrganizationAuditLog,
} from "@/lib/audit/organization-audit-log"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { listOrganizationMembers } from "@/lib/organizations/invite-organization-member"
import { loadOrganizationEnabledModuleSlugs } from "@/lib/modules/dashboard-module-access-server"
import { filterOrganizationRolesForOrganization } from "@/lib/permissions/facilities-access"
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"

export type OrganizationSettingsUser = {
  membershipId: string
  userId: string
  name: string
  email: string
  systemRole: string
  roleId: string | null
  roleName: string
  status: string
  lastLogin: string | null
  createdAt: string | null
}

export type OrganizationSettingsRole = {
  id: string
  name: string
  description: string | null
}

async function assertOrganizationUsersPermission(permissionKey: PermissionKey) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const allowed = await hasPermission(permissionKey)
  if (!allowed) {
    throw new Error("Not authorized to manage organization users")
  }

  return organizationId
}

/** Load all org members for Settings → Users (bypasses client RLS limits). */
export async function fetchOrganizationUsersForSettings(): Promise<{
  users: OrganizationSettingsUser[]
  roles: OrganizationSettingsRole[]
}> {
  const organizationId = await assertOrganizationUsersPermission(
    PERMISSIONS.SETTINGS_USERS_VIEW
  )

  const admin = createServiceRoleClient()
  const payload = await listOrganizationMembers(admin, organizationId)
  const enabledModuleSlugs = await loadOrganizationEnabledModuleSlugs(organizationId)
  const visibleRoles = filterOrganizationRolesForOrganization(
    payload.roles,
    enabledModuleSlugs
  )

  return {
    users: payload.members,
    roles: visibleRoles.map((role) => ({
      id: role.id as string,
      name: role.name as string,
      description: (role.description as string | null) ?? null,
    })),
  }
}

export async function updateOrganizationMemberRole(input: {
  membershipId: string
  roleId: string
}) {
  const organizationId = await assertOrganizationUsersPermission(
    PERMISSIONS.SETTINGS_USERS_VIEW
  )

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const admin = createServiceRoleClient()

  const { data: currentMembership, error: currentMembershipError } = await admin
    .from("organization_members")
    .select("id, role, role_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (currentMembershipError || !currentMembership) {
    throw new Error("You are not a member of this organization")
  }

  const isSystemAdmin = ["owner", "admin", "super_admin", "coordinator"].includes(
    currentMembership.role as string
  )

  let canManage = isSystemAdmin

  if (!canManage && currentMembership.role_id) {
    const { data: managePermission, error: managePermissionError } = await admin
      .from("role_permissions")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("role_id", currentMembership.role_id)
      .eq("permission_key", PERMISSIONS.SETTINGS_USERS_MANAGE)
      .eq("enabled", true)
      .maybeSingle()

    if (managePermissionError) {
      throw new Error(managePermissionError.message)
    }

    canManage = Boolean(managePermission)
  }

  if (!canManage) {
    throw new Error("Not authorized to change user roles")
  }

  const membershipId = input.membershipId.trim()
  const roleId = input.roleId.trim()

  if (!membershipId || !roleId) {
    throw new Error("Membership and role are required")
  }

  const { data: targetMembership, error: targetMembershipError } = await admin
    .from("organization_members")
    .select("id, user_id, role_id")
    .eq("id", membershipId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (targetMembershipError || !targetMembership) {
    throw new Error("Membership not found")
  }

  if (targetMembership.role_id === roleId) {
    return
  }

  const roleIds = [roleId, targetMembership.role_id].filter(Boolean) as string[]
  const { data: roleRows } = await admin
    .from("organization_roles")
    .select("id, name")
    .eq("organization_id", organizationId)
    .in("id", roleIds)

  const roleNameById = new Map(
    (roleRows ?? []).map((role) => [role.id as string, role.name as string])
  )
  const previousRoleName = targetMembership.role_id
    ? roleNameById.get(targetMembership.role_id) ?? "Unknown role"
    : "No role"
  const newRoleName = roleNameById.get(roleId) ?? "Unknown role"

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", targetMembership.user_id as string)
    .maybeSingle()

  const memberLabel =
    `${targetProfile?.first_name ?? ""} ${targetProfile?.last_name ?? ""}`.trim() ||
    (targetProfile?.email as string | undefined) ||
    (targetMembership.user_id as string)

  const { error } = await admin
    .from("organization_members")
    .update({ role_id: roleId })
    .eq("id", membershipId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Could not update user role")
  }

  await writeOrganizationAuditLog({
    organizationId,
    category: "permission",
    action: ORGANIZATION_AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    targetType: "member",
    targetId: targetMembership.user_id as string,
    targetLabel: memberLabel,
    summary: `Changed role for ${memberLabel} from ${previousRoleName} to ${newRoleName}`,
    metadata: {
      membership_id: membershipId,
      previous_role_id: targetMembership.role_id,
      previous_role_name: previousRoleName,
      new_role_id: roleId,
      new_role_name: newRoleName,
    },
  })

  revalidatePath("/settings/users")
  revalidatePath("/settings/audit-log")
}
