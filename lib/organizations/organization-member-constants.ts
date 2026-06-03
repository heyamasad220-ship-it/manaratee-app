/** Roles that use the org admin dashboard (not the customer portal). */
export const ORG_ADMIN_DASHBOARD_ROLES = [
  "super_admin",
  "admin",
  "coordinator",
  "owner",
] as const

/** System roles for customer portal users (not platform-managed org staff). */
export const CUSTOMER_PORTAL_SYSTEM_ROLES = [
  "viewer",
  "customer",
  "member",
] as const

/** Customer-facing organization role names (permissions label, not staff). */
export const CUSTOMER_PORTAL_ORG_ROLE_NAMES = [
  "viewer",
  "customer",
  "member",
] as const

/** Allowed values for `organization_members.role` (platform access tier, not org role name). */
export const ORGANIZATION_MEMBER_SYSTEM_ROLES = [
  "super_admin",
  "admin",
  "coordinator",
  "viewer",
  "owner",
] as const

export type OrganizationMemberSystemRole =
  (typeof ORGANIZATION_MEMBER_SYSTEM_ROLES)[number]

/** Default system role for invited staff; permissions come from `role_id`. */
export const DEFAULT_INVITED_MEMBER_SYSTEM_ROLE: OrganizationMemberSystemRole =
  "admin"

/** Try in order when inserting invited staff (first match should succeed after migration 014). */
export const INVITED_MEMBER_SYSTEM_ROLE_FALLBACKS: OrganizationMemberSystemRole[] =
  ["admin", "coordinator", "viewer"]

/** Platform admin invites org staff only — never fall back to viewer. */
export const PLATFORM_INVITED_MEMBER_SYSTEM_ROLE_FALLBACKS: OrganizationMemberSystemRole[] =
  ["admin", "coordinator"]

export function isOrganizationMemberSystemRole(
  value: string
): value is OrganizationMemberSystemRole {
  return ORGANIZATION_MEMBER_SYSTEM_ROLES.includes(
    value as OrganizationMemberSystemRole
  )
}

function normalizeRoleToken(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase()
}

export function isCustomerPortalSystemRole(value: string | null | undefined) {
  return CUSTOMER_PORTAL_SYSTEM_ROLES.includes(
    normalizeRoleToken(value) as (typeof CUSTOMER_PORTAL_SYSTEM_ROLES)[number]
  )
}

export function isCustomerPortalOrgRoleName(value: string | null | undefined) {
  return CUSTOMER_PORTAL_ORG_ROLE_NAMES.includes(
    normalizeRoleToken(value) as (typeof CUSTOMER_PORTAL_ORG_ROLE_NAMES)[number]
  )
}

export function isOrgStaffSystemRole(value: string | null | undefined) {
  if (!value || isCustomerPortalSystemRole(value)) {
    return false
  }

  return ORG_ADMIN_DASHBOARD_ROLES.includes(
    normalizeRoleToken(value) as (typeof ORG_ADMIN_DASHBOARD_ROLES)[number]
  )
}

export function invitedMemberSystemRoleCandidates(
  inviterSystemRole?: string | null
): OrganizationMemberSystemRole[] {
  const candidates: OrganizationMemberSystemRole[] = []

  if (
    inviterSystemRole &&
    isOrganizationMemberSystemRole(inviterSystemRole) &&
    inviterSystemRole !== "super_admin" &&
    inviterSystemRole !== "owner"
  ) {
    candidates.push(inviterSystemRole)
  }

  for (const role of INVITED_MEMBER_SYSTEM_ROLE_FALLBACKS) {
    if (!candidates.includes(role)) {
      candidates.push(role)
    }
  }

  return candidates
}
