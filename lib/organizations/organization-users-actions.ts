"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  ORGANIZATION_AUDIT_ACTIONS,
  writeOrganizationAuditLog,
} from "@/lib/audit/organization-audit-log"
import { passwordResetRedirectUrl } from "@/lib/auth/auth-redirect"
import { getAppBaseUrl } from "@/lib/app/get-app-base-url"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { listOrganizationMembers } from "@/lib/organizations/invite-organization-member"
import { loadOrganizationEnabledModuleSlugs } from "@/lib/modules/dashboard-module-access-server"
import { filterOrganizationRolesForOrganization } from "@/lib/permissions/facilities-access"
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { isOrganizationSuperAdminSystemRole } from "@/lib/organizations/organization-system-admin"

type OrganizationUsersManageContext = {
  organizationId: string
  actorUserId: string
  actorEmail: string | null
  admin: SupabaseClient
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function getOrganizationUsersManageContext(): Promise<OrganizationUsersManageContext> {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

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
    const allowedByPermission = await hasPermission(PERMISSIONS.SETTINGS_USERS_MANAGE)
    canManage = allowedByPermission
  }

  if (!canManage) {
    throw new Error("Not authorized to manage organization users")
  }

  return {
    organizationId,
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    admin,
  }
}

async function loadTargetMembership(
  admin: SupabaseClient,
  organizationId: string,
  membershipId: string
) {
  const { data: targetMembership, error: targetMembershipError } = await admin
    .from("organization_members")
    .select("id, user_id, role, role_id, status")
    .eq("id", membershipId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (targetMembershipError || !targetMembership) {
    throw new Error("Membership not found")
  }

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", targetMembership.user_id as string)
    .maybeSingle()

  const memberLabel =
    `${targetProfile?.first_name ?? ""} ${targetProfile?.last_name ?? ""}`.trim() ||
    (targetProfile?.email as string | undefined) ||
    (targetMembership.user_id as string)

  return { targetMembership, targetProfile, memberLabel }
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  let page = 1
  const perPage = 200

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === email
    )
    if (match) return match

    if (data.users.length < perPage) return null
    page += 1
  }

  return null
}

export type OrganizationSettingsUser = {
  membershipId: string
  userId: string
  name: string
  firstName: string
  lastName: string
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
  const { organizationId, actorUserId, actorEmail, admin } =
    await getOrganizationUsersManageContext()

  const membershipId = input.membershipId.trim()
  const roleId = input.roleId.trim()

  if (!membershipId || !roleId) {
    throw new Error("Membership and role are required")
  }

  const { targetMembership, memberLabel } = await loadTargetMembership(
    admin,
    organizationId,
    membershipId
  )

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
    actorUserId,
    actorEmail,
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

export async function updateOrganizationMemberProfile(input: {
  membershipId: string
  firstName: string
  lastName: string
  email: string
}) {
  const { organizationId, actorUserId, actorEmail, admin } =
    await getOrganizationUsersManageContext()

  const membershipId = input.membershipId.trim()
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const email = normalizeEmail(input.email)

  if (!membershipId) {
    throw new Error("Membership is required")
  }

  if (!email || !isValidEmail(email)) {
    throw new Error("Enter a valid email address")
  }

  const { targetMembership, targetProfile, memberLabel } = await loadTargetMembership(
    admin,
    organizationId,
    membershipId
  )

  const userId = targetMembership.user_id as string
  const previousEmail = normalizeEmail(String(targetProfile?.email || ""))

  if (email !== previousEmail) {
    const existingUser = await findAuthUserByEmail(admin, email)
    if (existingUser && existingUser.id !== userId) {
      throw new Error("Another account already uses this email address")
    }

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    })

    if (authUpdateError) {
      throw new Error(authUpdateError.message || "Could not update login email")
    }
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      first_name: firstName || null,
      last_name: lastName || null,
      email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (profileError) {
    throw new Error(profileError.message || "Could not update profile")
  }

  await writeOrganizationAuditLog({
    organizationId,
    category: "permission",
    action: ORGANIZATION_AUDIT_ACTIONS.MEMBER_PROFILE_UPDATED,
    actorUserId,
    actorEmail,
    targetType: "member",
    targetId: userId,
    targetLabel: memberLabel,
    summary: `Updated profile for ${memberLabel}`,
    metadata: {
      membership_id: membershipId,
      previous_email: previousEmail || null,
      new_email: email,
      first_name: firstName || null,
      last_name: lastName || null,
    },
  })

  revalidatePath("/settings/users")
  revalidatePath("/settings/audit-log")
}

export async function sendOrganizationMemberPasswordReset(membershipId: string) {
  const { organizationId, actorUserId, actorEmail, admin } =
    await getOrganizationUsersManageContext()

  const trimmedMembershipId = membershipId.trim()
  if (!trimmedMembershipId) {
    throw new Error("Membership is required")
  }

  const { targetMembership, targetProfile, memberLabel } = await loadTargetMembership(
    admin,
    organizationId,
    trimmedMembershipId
  )

  const email = normalizeEmail(String(targetProfile?.email || ""))
  if (!email || !isValidEmail(email)) {
    throw new Error("This user does not have a valid email address on file")
  }

  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: passwordResetRedirectUrl(getAppBaseUrl()),
  })

  if (error) {
    throw new Error(error.message || "Could not send password reset email")
  }

  await writeOrganizationAuditLog({
    organizationId,
    category: "permission",
    action: ORGANIZATION_AUDIT_ACTIONS.MEMBER_PASSWORD_RESET_SENT,
    actorUserId,
    actorEmail,
    targetType: "member",
    targetId: targetMembership.user_id as string,
    targetLabel: memberLabel,
    summary: `Sent password reset email to ${memberLabel}`,
    metadata: {
      membership_id: trimmedMembershipId,
      email,
    },
  })

  revalidatePath("/settings/audit-log")
}

export async function removeOrganizationMember(membershipId: string) {
  const { organizationId, actorUserId, actorEmail, admin } =
    await getOrganizationUsersManageContext()

  const trimmedMembershipId = membershipId.trim()
  if (!trimmedMembershipId) {
    throw new Error("Membership is required")
  }

  const { targetMembership, memberLabel } = await loadTargetMembership(
    admin,
    organizationId,
    trimmedMembershipId
  )

  const targetUserId = targetMembership.user_id as string

  if (targetUserId === actorUserId) {
    throw new Error("You cannot remove your own account from this organization")
  }

  if (isOrganizationSuperAdminSystemRole(targetMembership.role as string)) {
    const { count, error: adminCountError } = await admin
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("role", ["owner", "super_admin"])
      .neq("id", trimmedMembershipId)

    if (adminCountError) {
      throw new Error(adminCountError.message)
    }

    if ((count ?? 0) === 0) {
      throw new Error("Cannot remove the last Super Admin from this organization")
    }
  }

  const { error } = await admin
    .from("organization_members")
    .delete()
    .eq("id", trimmedMembershipId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Could not remove user from organization")
  }

  await writeOrganizationAuditLog({
    organizationId,
    category: "permission",
    action: ORGANIZATION_AUDIT_ACTIONS.MEMBER_REMOVED,
    actorUserId,
    actorEmail,
    targetType: "member",
    targetId: targetUserId,
    targetLabel: memberLabel,
    summary: `Removed ${memberLabel} from the organization`,
    metadata: {
      membership_id: trimmedMembershipId,
      system_role: targetMembership.role,
      role_id: targetMembership.role_id,
    },
  })

  revalidatePath("/settings/users")
  revalidatePath("/settings/audit-log")
}
