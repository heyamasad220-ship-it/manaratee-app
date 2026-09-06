import { redirect } from "next/navigation"

import {
  canManageDepartment,
  canViewDepartment,
} from "@/lib/departments/department-access"
import { getInternalEventRecordById } from "@/lib/events/internal-event-queries"
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

export async function canManageDepartmentEvents(
  departmentId: string | null | undefined
): Promise<boolean> {
  if (
    await hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE)
  ) {
    return true
  }
  const id = String(departmentId || "").trim()
  if (!id) return false
  return canManageDepartment(id)
}

/** Attach/unlink an event to a donations campaign (campaign staff or event managers). */
export async function canLinkEventToCampaign(eventId: string): Promise<boolean> {
  if (await canManageInternalEvent(eventId)) {
    return true
  }
  return hasAnyPermission(
    PERMISSIONS.DONATIONS_CAMPAIGNS_MANAGE,
    PERMISSIONS.DONATIONS_MANAGE
  )
}

export async function canManageInternalEvent(eventId: string): Promise<boolean> {
  if (
    await hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE)
  ) {
    return true
  }
  const event = await getInternalEventRecordById(eventId)
  const departmentId = (event?.department_id as string | null | undefined) ?? null
  if (!departmentId) return false
  return canManageDepartment(departmentId)
}

export async function canViewInternalEvent(eventId: string): Promise<boolean> {
  if (
    await hasAnyPermission(
      ...EVENT_WORKSPACE_VIEW_PERMISSIONS,
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
  ) {
    return true
  }
  const event = await getInternalEventRecordById(eventId)
  const departmentId = (event?.department_id as string | null | undefined) ?? null
  if (!departmentId) return false
  return canViewDepartment(departmentId)
}

export async function requireInternalEventWorkspaceAccess(eventId: string) {
  const allowed = await canViewInternalEvent(eventId)
  if (!allowed) {
    redirect("/unauthorized")
  }
}
