"use server"

import { revalidatePath } from "next/cache"

import { saveModuleNotificationSettings } from "./module-notification-settings-queries"
import type {
  ModuleNotificationKey,
  ModuleNotificationSettings,
} from "./module-notification-settings-types"

function revalidateModuleSettingsPaths(moduleKey: ModuleNotificationKey) {
  if (moduleKey === "event_management") {
    revalidatePath("/event-management/settings/notifications")
  } else if (moduleKey === "vendor_hub") {
    revalidatePath("/vendor-hub/settings/notifications")
    revalidatePath("/vendor-hub/settings")
  } else {
    revalidatePath("/bookings/settings/notifications")
  }
}

export async function saveModuleNotificationSettingsAction(input: {
  moduleKey: ModuleNotificationKey
  settings: ModuleNotificationSettings
}) {
  await saveModuleNotificationSettings(input)
  revalidateModuleSettingsPaths(input.moduleKey)
}
