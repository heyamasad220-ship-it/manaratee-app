const SYSTEM_ADMIN_ROLES = new Set(["owner", "admin", "super_admin", "coordinator"])

export function isOrganizationSystemAdmin(role: string | null | undefined) {
  if (!role) return false
  return SYSTEM_ADMIN_ROLES.has(role)
}

export function isOrganizationSuperAdminSystemRole(role: string | null | undefined) {
  return role === "super_admin" || role === "owner"
}

/** Matches organization_roles.name values like "Super Admin". */
export function isOrganizationSuperAdminRoleName(roleName: string | null | undefined) {
  return roleName?.trim().toLowerCase() === "super admin"
}

export function canViewOrganizationBilling(input: {
  systemRole: string | null | undefined
  organizationRoleName?: string | null | undefined
  platformSupport?: boolean
}) {
  if (input.platformSupport) return true
  if (isOrganizationSuperAdminSystemRole(input.systemRole)) return true
  if (isOrganizationSuperAdminRoleName(input.organizationRoleName)) return true
  return false
}

/** @deprecated Use canViewOrganizationBilling — kept for imports that only check system role. */
export function isOrganizationSuperAdmin(role: string | null | undefined) {
  return isOrganizationSuperAdminSystemRole(role)
}
