import { redirect } from "next/navigation"

import {
  hasAnyPermission,
  requireAnyPermission,
  PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions/permissions"

export async function requireVendorHubView() {
  await requireAnyPermission(
    PERMISSIONS.VENDOR_HUB_VIEW,
    PERMISSIONS.VENDOR_HUB_MANAGE,
    PERMISSIONS.APPLICATIONS_VIEW
  )
}

export async function requireVendorHubManage() {
  await requireAnyPermission(
    PERMISSIONS.VENDOR_HUB_MANAGE,
    PERMISSIONS.EVENTS_MANAGE
  )
}

export async function canAccessVendorHub() {
  return hasAnyPermission(
    PERMISSIONS.VENDOR_HUB_VIEW,
    PERMISSIONS.VENDOR_HUB_MANAGE,
    PERMISSIONS.APPLICATIONS_VIEW
  )
}

export async function canManageVendorHub() {
  return hasAnyPermission(
    PERMISSIONS.VENDOR_HUB_MANAGE,
    PERMISSIONS.EVENTS_MANAGE
  )
}

export async function requireVendorHubSectionAccess(
  permissionKeys: PermissionKey[]
) {
  const allowed = await hasAnyPermission(...permissionKeys)

  if (!allowed) {
    redirect("/unauthorized")
  }
}
