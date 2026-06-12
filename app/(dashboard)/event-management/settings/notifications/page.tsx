import { EventManagementSettingsNav } from "@/components/events/event-management-settings-nav"
import { ModuleNotificationSettingsClient } from "@/components/notifications/module-notification-settings-client"
import { getModuleNotificationSettings } from "@/lib/notifications/module-notification-settings-queries"
import {
  getNotificationCatalog,
} from "@/lib/notifications/module-notification-settings-types"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

export default async function EventManagementNotificationSettingsPage() {
  await requireAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE)

  const organizationId = await resolveOrganizationId()
  const supabase = await createClient()

  let tablesAvailable = true
  if (organizationId) {
    const probe = await supabase
      .from("module_notification_settings")
      .select("id")
      .eq("organization_id", organizationId)
      .limit(1)

    if (probe.error?.code === "42P01" || probe.error?.code === "PGRST204") {
      tablesAvailable = false
    }
  }

  const catalog = getNotificationCatalog("event_management")
  const initialSettings = await getModuleNotificationSettings("event_management")

  return (
    <ModuleNotificationSettingsClient
      moduleKey="event_management"
      headerTitle="Event Management"
      pageTitle="Notification settings"
      pageDescription="Choose when staff and requesters receive email updates about internal event requests."
      settingsNav={<EventManagementSettingsNav />}
      initialSettings={initialSettings}
      staffEvents={catalog.staffEvents}
      customerEvents={catalog.customerEvents}
      tablesAvailable={tablesAvailable}
    />
  )
}
