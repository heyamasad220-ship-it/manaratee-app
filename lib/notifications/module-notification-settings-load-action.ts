"use server"

import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { getModuleNotificationSettings } from "@/lib/notifications/module-notification-settings-queries"
import {
  getNotificationCatalog,
  type ModuleNotificationKey,
  type ModuleNotificationSettings,
  type NotificationEventDefinition,
} from "@/lib/notifications/module-notification-settings-types"

export type ModuleNotificationSettingsPanelData = {
  initialSettings: ModuleNotificationSettings
  staffEvents: NotificationEventDefinition[]
  customerEvents: NotificationEventDefinition[]
  tablesAvailable: boolean
}

export async function loadModuleNotificationSettingsPanelAction(
  moduleKey: ModuleNotificationKey
): Promise<ModuleNotificationSettingsPanelData> {
  const organizationId = await resolveOrganizationId()
  const catalog = getNotificationCatalog(moduleKey)
  const initialSettings = await getModuleNotificationSettings(moduleKey, organizationId)

  let tablesAvailable = true
  if (organizationId) {
    const supabase = await createClient()
    const probe = await supabase
      .from("module_notification_settings")
      .select("id")
      .eq("organization_id", organizationId)
      .limit(1)

    if (probe.error?.code === "42P01" || probe.error?.code === "PGRST204") {
      tablesAvailable = false
    }
  }

  return {
    initialSettings,
    staffEvents: catalog.staffEvents,
    customerEvents: catalog.customerEvents,
    tablesAvailable,
  }
}
