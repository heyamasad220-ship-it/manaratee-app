import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
  type PermissionKey,
} from "@/lib/permissions/permissions"

/** Open Event Management list and event workspace (read + check-in). */
export const EVENT_WORKSPACE_VIEW_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.EVENTS_VIEW,
  PERMISSIONS.EVENTS_CHECKIN,
  PERMISSIONS.PROGRAMS_VIEW,
]

/** Scan / check in attendees and youth. Manage roles include check-in. */
export const EVENT_CHECKIN_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.EVENTS_CHECKIN,
  PERMISSIONS.EVENTS_MANAGE,
  PERMISSIONS.PROGRAMS_MANAGE,
  PERMISSIONS.TICKETING_MANAGE,
]

export async function requireEventWorkspaceViewPermission() {
  await requireAnyPermission(...EVENT_WORKSPACE_VIEW_PERMISSIONS)
}

export async function hasEventCheckInPermission() {
  return hasAnyPermission(...EVENT_CHECKIN_PERMISSIONS)
}
