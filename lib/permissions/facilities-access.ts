import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permission-keys"

export const FACILITY_MANAGER_ROLE_NAME = "Facility Manager"
export const FACILITY_COORDINATOR_ROLE_NAME = "Facility Coordinator"

export const FACILITIES_MODULE_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.SPACES_VIEW,
  PERMISSIONS.SPACES_MANAGE,
]

/** Permissions that grant access outside the Facilities module. */
export const NON_FACILITIES_MODULE_PERMISSIONS: string[] = [
  PERMISSIONS.SETTINGS_USERS_VIEW,
  PERMISSIONS.SETTINGS_USERS_MANAGE,
  PERMISSIONS.SETTINGS_ROLES_VIEW,
  PERMISSIONS.SETTINGS_ROLES_MANAGE,
  PERMISSIONS.APPLICATIONS_VIEW,
  PERMISSIONS.APPLICATIONS_MANAGE,
  PERMISSIONS.PROGRAMS_VIEW,
  PERMISSIONS.PROGRAMS_MANAGE,
  PERMISSIONS.STAFF_VIEW,
  PERMISSIONS.STAFF_MANAGE,
  PERMISSIONS.DONATIONS_VIEW,
  PERMISSIONS.DONATIONS_MANAGE,
  PERMISSIONS.REPORTS_VIEW,
  PERMISSIONS.EVENTS_VIEW,
  PERMISSIONS.EVENTS_MANAGE,
  PERMISSIONS.BOOKINGS_VIEW,
  PERMISSIONS.BOOKINGS_MANAGE,
  PERMISSIONS.FINANCE_VIEW,
  PERMISSIONS.FINANCE_MANAGE,
  "contacts.view",
  "contacts.manage",
  "ticketing.view",
  "ticketing.manage",
  "vendor_hub.view",
  "vendor_hub.manage",
]

export function isFacilitiesOnlyAccess(input: {
  isOwner: boolean
  enabledPermissions: Iterable<string>
}): boolean {
  if (input.isOwner) {
    return false
  }

  const enabled = new Set(input.enabledPermissions)
  const hasFacilitiesAccess = FACILITIES_MODULE_PERMISSIONS.some((key) =>
    enabled.has(key)
  )

  if (!hasFacilitiesAccess) {
    return false
  }

  return !NON_FACILITIES_MODULE_PERMISSIONS.some((key) => enabled.has(key))
}

export function isFacilitiesRoute(pathname: string) {
  return pathname === "/facilities" || pathname.startsWith("/facilities/")
}
