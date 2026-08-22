import type { SupabaseClient } from "@supabase/supabase-js"

import { PERMISSIONS } from "@/lib/permissions/permission-keys"

export const ORGANIZATION_SUPER_ADMIN_ROLE_NAME = "Super Admin"
export const ORGANIZATION_ADMIN_ROLE_NAME = "Admin"

export const ORGANIZATION_SYSTEM_ROLE_DEFS = [
  {
    name: ORGANIZATION_SUPER_ADMIN_ROLE_NAME,
    description:
      "First organization role. Manages users, roles, billing, and all enabled modules. Invites Admins.",
  },
  {
    name: ORGANIZATION_ADMIN_ROLE_NAME,
    description:
      "Organization staff administrator. Invited by a Super Admin to help run the organization.",
  },
] as const

export type OrganizationSystemRoleIds = {
  superAdminRoleId: string
  adminRoleId: string
}

const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS)

function isSuperAdminRoleName(name: string | null | undefined) {
  return name?.trim().toLowerCase() === ORGANIZATION_SUPER_ADMIN_ROLE_NAME.toLowerCase()
}

function isAdminRoleName(name: string | null | undefined) {
  return name?.trim().toLowerCase() === ORGANIZATION_ADMIN_ROLE_NAME.toLowerCase()
}

export function isOrganizationSystemRoleName(name: string | null | undefined) {
  return isSuperAdminRoleName(name) || isAdminRoleName(name)
}

async function upsertNamedSystemRole(
  admin: SupabaseClient,
  organizationId: string,
  name: string,
  description: string
) {
  const { data: existing, error: existingError } = await admin
    .from("organization_roles")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("name", name)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing?.id) {
    return existing.id as string
  }

  const { data: created, error: createError } = await admin
    .from("organization_roles")
    .insert({
      organization_id: organizationId,
      name,
      description,
      is_system_role: true,
    })
    .select("id")
    .single()

  if (createError || !created?.id) {
    throw new Error(createError?.message || `Failed to create ${name} role.`)
  }

  return created.id as string
}

export async function seedMissingRolePermissions(
  admin: SupabaseClient,
  organizationId: string
) {
  const { data: roles, error } = await admin
    .from("organization_roles")
    .select("id, name")
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message)
  }

  const { data: existing, error: existingError } = await admin
    .from("role_permissions")
    .select("role_id, permission_key")
    .eq("organization_id", organizationId)

  if (existingError) {
    throw new Error(existingError.message)
  }

  const existingKeys = new Set(
    (existing ?? []).map(
      (row) => `${row.role_id as string}:${row.permission_key as string}`
    )
  )

  const rows: Array<{
    organization_id: string
    role_id: string
    permission_key: string
    enabled: boolean
  }> = []

  for (const role of roles ?? []) {
    const enabled = isOrganizationSystemRoleName(role.name as string)
    for (const permissionKey of ALL_PERMISSION_KEYS) {
      const key = `${role.id as string}:${permissionKey}`
      if (existingKeys.has(key)) continue
      rows.push({
        organization_id: organizationId,
        role_id: role.id as string,
        permission_key: permissionKey,
        enabled,
      })
    }
  }

  if (rows.length === 0) {
    return
  }

  const { error: insertError } = await admin.from("role_permissions").insert(rows)
  if (insertError) {
    throw new Error(insertError.message)
  }
}

async function linkMembersMissingRoleId(
  admin: SupabaseClient,
  organizationId: string,
  ids: OrganizationSystemRoleIds
) {
  const { data: members, error } = await admin
    .from("organization_members")
    .select("id, role, role_id")
    .eq("organization_id", organizationId)
    .is("role_id", null)

  if (error) {
    throw new Error(error.message)
  }

  for (const member of members ?? []) {
    const systemRole = String(member.role || "").trim().toLowerCase()
    const roleId =
      systemRole === "super_admin" || systemRole === "owner"
        ? ids.superAdminRoleId
        : systemRole === "admin"
          ? ids.adminRoleId
          : null
    if (!roleId) continue

    const { error: updateError } = await admin
      .from("organization_members")
      .update({ role_id: roleId })
      .eq("id", member.id)
      .eq("organization_id", organizationId)

    if (updateError) {
      throw new Error(updateError.message)
    }
  }
}

/** Creates Super Admin and Admin for an org, seeds permissions, and links existing members. */
export async function ensureOrganizationSystemRoles(
  admin: SupabaseClient,
  organizationId: string
): Promise<OrganizationSystemRoleIds> {
  const superAdminRoleId = await upsertNamedSystemRole(
    admin,
    organizationId,
    ORGANIZATION_SUPER_ADMIN_ROLE_NAME,
    ORGANIZATION_SYSTEM_ROLE_DEFS[0].description
  )
  const adminRoleId = await upsertNamedSystemRole(
    admin,
    organizationId,
    ORGANIZATION_ADMIN_ROLE_NAME,
    ORGANIZATION_SYSTEM_ROLE_DEFS[1].description
  )

  const ids = { superAdminRoleId, adminRoleId }
  await seedMissingRolePermissions(admin, organizationId)
  await linkMembersMissingRoleId(admin, organizationId, ids)
  return ids
}
