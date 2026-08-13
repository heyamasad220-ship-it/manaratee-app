import {
  hasAnyPermission,
  requireAnyPermission,
  PERMISSIONS,
} from "@/lib/permissions/permissions"

const COMMUNITY_CALENDAR_PERMISSIONS = [
  PERMISSIONS.VENDOR_HUB_VIEW,
  PERMISSIONS.VENDOR_HUB_MANAGE,
  PERMISSIONS.APPLICATIONS_VIEW,
  PERMISSIONS.EVENTS_VIEW,
  PERMISSIONS.EVENTS_MANAGE,
] as const

export async function requireCommunityCalendarAccess() {
  await requireAnyPermission(...COMMUNITY_CALENDAR_PERMISSIONS)
}

export async function canAccessCommunityCalendar() {
  return hasAnyPermission(...COMMUNITY_CALENDAR_PERMISSIONS)
}
