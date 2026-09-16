import { EventManagementGeneralSettingsClient } from "@/components/events/event-management-general-settings-client"
import { getEventManagementSettings } from "@/lib/events/event-management-settings"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementGeneralSettingsPage() {
  await requireAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE)

  const [settings, canManage] = await Promise.all([
    getEventManagementSettings(),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
  ])

  return (
    <EventManagementGeneralSettingsClient
      settings={settings}
      canManage={canManage}
    />
  )
}
