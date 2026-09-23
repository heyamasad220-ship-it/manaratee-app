import { PERMISSIONS, requireAnyPermission } from "@/lib/permissions/permissions"

export async function requireSignUpsAccess() {
  await requireAnyPermission(
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.EVENTS_CHECKIN,
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.VENDOR_HUB_VIEW,
    PERMISSIONS.VENDOR_HUB_MANAGE
  )
}
