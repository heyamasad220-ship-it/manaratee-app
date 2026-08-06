"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { ModuleNotificationSettingsClient } from "@/components/notifications/module-notification-settings-client"
import {
  loadModuleNotificationSettingsPanelAction,
  type ModuleNotificationSettingsPanelData,
} from "@/lib/notifications/module-notification-settings-load-action"

export function VendorHubNotificationsSettingsPanel() {
  const [data, setData] = useState<ModuleNotificationSettingsPanelData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void loadModuleNotificationSettingsPanelAction("vendor_hub")
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load notification settings."
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading notification settings...
      </div>
    )
  }

  return (
    <ModuleNotificationSettingsClient
      moduleKey="vendor_hub"
      headerTitle="Vendor Hub"
      pageTitle="Vendor notification settings"
      pageDescription="Messages always appear in vendor My Bazaars. Email delivery uses these toggles when a provider is connected."
      initialSettings={data.initialSettings}
      staffEvents={data.staffEvents}
      customerEvents={data.customerEvents}
      tablesAvailable={data.tablesAvailable}
      settingsNav={null}
      embedded
    />
  )
}
