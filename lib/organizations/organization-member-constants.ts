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

/** Try in order when inserting invited members (first match should succeed after migration 014). */
export const INVITED_MEMBER_SYSTEM_ROLE_FALLBACKS: OrganizationMemberSystemRole[] =
  ["admin", "coordinator", "viewer"]

export function isOrganizationMemberSystemRole(
  value: string
): value is OrganizationMemberSystemRole {
  return ORGANIZATION_MEMBER_SYSTEM_ROLES.includes(
    value as OrganizationMemberSystemRole
  )
}

export function isOrgStaffSystemRole(value: string) {
  return isOrganizationMemberSystemRole(value)
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
