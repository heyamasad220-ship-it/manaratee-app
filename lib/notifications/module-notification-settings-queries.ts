import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

import {
  buildDefaultModuleNotificationSettings,
  mergeModuleNotificationSettings,
  type ModuleNotificationKey,
  type ModuleNotificationSettings,
} from "./module-notification-settings-types"

function isMissingSettingsTable(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code === "42P01" || error.code === "PGRST204") return true
  return error.message?.toLowerCase().includes("does not exist") ?? false
}

export async function getModuleNotificationSettings(
  moduleKey: ModuleNotificationKey,
  organizationId?: string | null
): Promise<ModuleNotificationSettings> {
  const orgId = organizationId ?? (await resolveOrganizationId())

  if (!orgId) {
    return buildDefaultModuleNotificationSettings(moduleKey)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("module_notification_settings")
    .select("settings")
    .eq("organization_id", orgId)
    .eq("module_key", moduleKey)
    .maybeSingle()

  if (error) {
    if (isMissingSettingsTable(error)) {
      return buildDefaultModuleNotificationSettings(moduleKey)
    }
    console.error(error)
    return buildDefaultModuleNotificationSettings(moduleKey)
  }

  return mergeModuleNotificationSettings(
    moduleKey,
    (data?.settings as Partial<ModuleNotificationSettings> | null) ?? null
  )
}

export async function saveModuleNotificationSettings(input: {
  moduleKey: ModuleNotificationKey
  settings: ModuleNotificationSettings
}) {
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const supabase = await createClient()
  const { error } = await supabase.from("module_notification_settings").upsert(
    {
      organization_id: organizationId,
      module_key: input.moduleKey,
      settings: input.settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,module_key" }
  )

  if (error) {
    if (isMissingSettingsTable(error)) {
      throw new Error(
        "Notification settings table is not installed yet. Run scripts/072_module_notification_settings.sql in Supabase."
      )
    }
    console.error(error)
    throw new Error("Failed to save notification settings")
  }
}

export async function isModuleNotificationEnabled(input: {
  moduleKey: ModuleNotificationKey
  audience: "staff" | "customer"
  eventKey: string
  organizationId?: string | null
}) {
  const settings = await getModuleNotificationSettings(
    input.moduleKey,
    input.organizationId
  )

  return settings[input.audience][input.eventKey] ?? false
}
