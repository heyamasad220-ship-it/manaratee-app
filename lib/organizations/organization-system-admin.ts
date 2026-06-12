const SYSTEM_ADMIN_ROLES = new Set(["owner", "admin", "super_admin", "coordinator"])

export function isOrganizationSystemAdmin(role: string | null | undefined) {
  if (!role) return false
  return SYSTEM_ADMIN_ROLES.has(role)
}
