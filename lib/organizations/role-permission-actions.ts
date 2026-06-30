"use server"

import { revalidatePath } from "next/cache"

import {
  ORGANIZATION_AUDIT_ACTIONS,
  writeOrganizationAuditLog,
} from "@/lib/audit/organization-audit-log"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function setOrganizationRolePermissionAction(input: {
  roleId: string
  permissionKey: string
  enabled: boolean
}) {
  const canManage = await hasPermission(PERMISSIONS.SETTINGS_ROLES_MANAGE)
  if (!canManage) {
    return { success: false as const, error: "Not authorized to manage role permissions." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false as const, error: "Not authenticated." }
  }

  const roleId = input.roleId.trim()
  const permissionKey = input.permissionKey.trim()
  if (!roleId || !permissionKey) {
    return { success: false as const, error: "Role and permission are required." }
  }

  const admin = createServiceRoleClient()

  const { data: role, error: roleError } = await admin
    .from("organization_roles")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("id", roleId)
    .maybeSingle()

  if (roleError || !role) {
    return { success: false as const, error: "Role not found." }
  }

  const { data: existing, error: existingError } = await admin
    .from("role_permissions")
    .select("id, enabled")
    .eq("organization_id", organizationId)
    .eq("role_id", roleId)
    .eq("permission_key", permissionKey)
    .maybeSingle()

  if (existingError) {
    return { success: false as const, error: existingError.message }
  }

  const previousEnabled = existing?.enabled ?? false

  if (existing?.id) {
    const { error } = await admin
      .from("role_permissions")
      .update({ enabled: input.enabled })
      .eq("id", existing.id)
      .eq("organization_id", organizationId)

    if (error) {
      return { success: false as const, error: error.message }
    }
  } else {
    const { error } = await admin.from("role_permissions").insert({
      organization_id: organizationId,
      role_id: roleId,
      permission_key: permissionKey,
      enabled: input.enabled,
    })

    if (error) {
      return { success: false as const, error: error.message }
    }
  }

  if (previousEnabled !== input.enabled) {
    await writeOrganizationAuditLog({
      organizationId,
      category: "permission",
      action: ORGANIZATION_AUDIT_ACTIONS.ROLE_PERMISSION_CHANGED,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      targetType: "role",
      targetId: roleId,
      targetLabel: role.name as string,
      summary: `${input.enabled ? "Enabled" : "Disabled"} ${permissionKey} for role ${role.name}`,
      metadata: {
        permission_key: permissionKey,
        previous_enabled: previousEnabled,
        enabled: input.enabled,
      },
    })
  }

  revalidatePath("/settings/roles-permissions")
  revalidatePath("/settings/audit-log")

  return { success: true as const }
}
