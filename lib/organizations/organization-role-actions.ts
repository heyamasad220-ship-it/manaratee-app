"use server"

import { revalidatePath } from "next/cache"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  ensureOrganizationSystemRoles,
  seedMissingRolePermissions,
} from "@/lib/organizations/organization-system-roles"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

async function requireRolesManage() {
  const canManage = await hasPermission(PERMISSIONS.SETTINGS_ROLES_MANAGE)
  if (!canManage) {
    return { error: "Not authorized to manage roles." as const }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { error: "No organization selected." as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Not authenticated." as const }
  }

  return { organizationId, admin: createServiceRoleClient() }
}

export async function loadOrganizationRolesWorkspaceAction() {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  const canView = await hasPermission(PERMISSIONS.SETTINGS_ROLES_VIEW)
  if (!canView) {
    return { success: false as const, error: "Not authorized to view roles." }
  }

  try {
    const admin = createServiceRoleClient()
    await ensureOrganizationSystemRoles(admin, organizationId)

    const [rolesResult, membersResult, permissionsResult] = await Promise.all([
      admin
        .from("organization_roles")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
      admin
        .from("organization_members")
        .select("id, role_id")
        .eq("organization_id", organizationId),
      admin
        .from("role_permissions")
        .select("*")
        .eq("organization_id", organizationId),
    ])

    if (rolesResult.error) {
      return { success: false as const, error: rolesResult.error.message }
    }
    if (membersResult.error) {
      return { success: false as const, error: membersResult.error.message }
    }
    if (permissionsResult.error) {
      return { success: false as const, error: permissionsResult.error.message }
    }

    return {
      success: true as const,
      roles: rolesResult.data ?? [],
      members: membersResult.data ?? [],
      permissions: permissionsResult.data ?? [],
    }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load roles and permissions.",
    }
  }
}

export async function ensureOrganizationSystemRolesAction() {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  const canView = await hasPermission(PERMISSIONS.SETTINGS_ROLES_VIEW)
  if (!canView) {
    return { success: false as const, error: "Not authorized to view roles." }
  }

  try {
    const ids = await ensureOrganizationSystemRoles(
      createServiceRoleClient(),
      organizationId
    )
    return { success: true as const, ...ids }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create Super Admin and Admin roles.",
    }
  }
}

export async function createOrganizationRoleAction(input: {
  name: string
  description?: string | null
}) {
  const ctx = await requireRolesManage()
  if ("error" in ctx) {
    return { success: false as const, error: ctx.error }
  }

  const name = input.name.trim()
  if (!name) {
    return { success: false as const, error: "Role name is required." }
  }

  try {
    await ensureOrganizationSystemRoles(ctx.admin, ctx.organizationId)

    const { data: created, error } = await ctx.admin
      .from("organization_roles")
      .insert({
        organization_id: ctx.organizationId,
        name,
        description: input.description?.trim() || null,
        is_system_role: false,
      })
      .select("id")
      .single()

    if (error || !created?.id) {
      return { success: false as const, error: error?.message || "Failed to create role." }
    }

    await seedMissingRolePermissions(ctx.admin, ctx.organizationId)

    revalidatePath("/settings/roles-permissions")
    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to create role.",
    }
  }
}

export async function updateOrganizationRoleAction(input: {
  roleId: string
  name: string
  description?: string | null
}) {
  const ctx = await requireRolesManage()
  if ("error" in ctx) {
    return { success: false as const, error: ctx.error }
  }

  const roleId = input.roleId.trim()
  const name = input.name.trim()
  if (!roleId || !name) {
    return { success: false as const, error: "Role and name are required." }
  }

  const { error } = await ctx.admin
    .from("organization_roles")
    .update({
      name,
      description: input.description?.trim() || null,
    })
    .eq("id", roleId)
    .eq("organization_id", ctx.organizationId)

  if (error) {
    return { success: false as const, error: error.message }
  }

  revalidatePath("/settings/roles-permissions")
  return { success: true as const }
}

export async function deleteOrganizationRoleAction(input: { roleId: string }) {
  const ctx = await requireRolesManage()
  if ("error" in ctx) {
    return { success: false as const, error: ctx.error }
  }

  const roleId = input.roleId.trim()
  if (!roleId) {
    return { success: false as const, error: "Role is required." }
  }

  const { data: role, error: roleError } = await ctx.admin
    .from("organization_roles")
    .select("id, name, is_system_role")
    .eq("id", roleId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle()

  if (roleError || !role) {
    return { success: false as const, error: "Role not found." }
  }

  if (role.is_system_role) {
    return { success: false as const, error: "System roles cannot be deleted." }
  }

  const { count, error: countError } = await ctx.admin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .eq("role_id", roleId)

  if (countError) {
    return { success: false as const, error: countError.message }
  }

  if ((count ?? 0) > 0) {
    return {
      success: false as const,
      error:
        "You cannot delete a role that is assigned to users. Move those users to another role first.",
    }
  }

  const { error } = await ctx.admin
    .from("organization_roles")
    .delete()
    .eq("id", roleId)
    .eq("organization_id", ctx.organizationId)

  if (error) {
    return { success: false as const, error: error.message }
  }

  revalidatePath("/settings/roles-permissions")
  return { success: true as const }
}
