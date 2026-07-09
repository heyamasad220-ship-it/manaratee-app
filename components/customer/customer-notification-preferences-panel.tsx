"use client"

import { Bell } from "lucide-react"

import {
  type CustomerNotificationPreferenceKey,
  type CustomerNotificationSettings,
  getVisibleCustomerNotificationPreferences,
} from "@/lib/customer/customer-notification-preferences"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

type CustomerNotificationPreferencesPanelProps = {
  enabledModuleSlugs: string[]
  notifications: CustomerNotificationSettings
  onChange: (key: CustomerNotificationPreferenceKey, value: boolean) => void
}

export function CustomerNotificationPreferencesPanel({
  enabledModuleSlugs,
  notifications,
  onChange,
}: CustomerNotificationPreferencesPanelProps) {
  const visiblePreferences = getVisibleCustomerNotificationPreferences(enabledModuleSlugs)

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bell className="h-4 w-4" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Manage how you receive updates for your organization&apos;s enabled services.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {visiblePreferences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notification options are available for your organization yet.
          </p>
        ) : (
          visiblePreferences.map((preference, index) => (
            <div key={preference.key}>
              {index > 0 ? <Separator className="mb-5" /> : null}
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{preference.label}</span>
                  <span className="text-xs text-muted-foreground">{preference.description}</span>
                </div>
                <Switch
                  checked={notifications[preference.key]}
                  onCheckedChange={(value) => onChange(preference.key, value)}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
