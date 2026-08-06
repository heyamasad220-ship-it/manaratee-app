"use client"

import { useState, useTransition } from "react"
import { Bell, Loader2, Mail, Users } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { saveModuleNotificationSettingsAction } from "@/lib/notifications/module-notification-settings-actions"
import type {
  ModuleNotificationKey,
  ModuleNotificationSettings,
  NotificationEventDefinition,
} from "@/lib/notifications/module-notification-settings-types"

type ModuleNotificationSettingsClientProps = {
  moduleKey: ModuleNotificationKey
  headerTitle: string
  pageTitle: string
  pageDescription: string
  settingsNav: React.ReactNode
  initialSettings: ModuleNotificationSettings
  staffEvents: NotificationEventDefinition[]
  customerEvents: NotificationEventDefinition[]
  tablesAvailable?: boolean
  /** When true, omit page Header and outer padding for embedding in another settings surface. */
  embedded?: boolean
}

function NotificationToggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label>{label}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  )
}

export function ModuleNotificationSettingsClient({
  moduleKey,
  headerTitle,
  pageTitle,
  pageDescription,
  settingsNav,
  initialSettings,
  staffEvents,
  customerEvents,
  tablesAvailable = true,
  embedded = false,
}: ModuleNotificationSettingsClientProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateStaffToggle(key: string, checked: boolean) {
    setSettings((current) => ({
      ...current,
      staff: { ...current.staff, [key]: checked },
    }))
  }

  function updateCustomerToggle(key: string, checked: boolean) {
    setSettings((current) => ({
      ...current,
      customer: { ...current.customer, [key]: checked },
    }))
  }

  function handleSave() {
    setMessage(null)
    setError(null)

    startTransition(async () => {
      try {
        await saveModuleNotificationSettingsAction({ moduleKey, settings })
        setMessage("Notification settings saved.")
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save notification settings."
        )
      }
    })
  }

  const body = (
    <div className={embedded ? "flex flex-col gap-5" : "flex flex-col gap-5 p-6"}>
      <div>
        <h2 className="text-xl font-semibold">{pageTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>
      </div>

      {settingsNav}

      {!tablesAvailable ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            Notification settings storage is not connected yet. Run{" "}
            <code className="rounded bg-amber-100 px-1">
              scripts/072_module_notification_settings.sql
            </code>{" "}
            in Supabase, then refresh this page.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Staff notifications
            </CardTitle>
            <CardDescription>
              Email staff when booking or event workflow steps occur.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {staffEvents.map((event) => (
              <NotificationToggle
                key={event.key}
                label={event.label}
                description={event.description}
                checked={settings.staff[event.key] ?? event.defaultEnabled}
                onCheckedChange={(checked) => updateStaffToggle(event.key, checked)}
              />
            ))}

            <div className="space-y-2 pt-2">
              <Label htmlFor="staff_additional_emails">Additional staff emails</Label>
              <Input
                id="staff_additional_emails"
                value={settings.staffAdditionalEmails}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    staffAdditionalEmails: event.target.value,
                  }))
                }
                placeholder="coordinator@example.org, facilities@example.org"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated addresses copied on staff notifications in addition to
                module managers.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Customer notifications
            </CardTitle>
            <CardDescription>
              Email customers and requesters about their booking status.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {customerEvents.map((event) => (
              <NotificationToggle
                key={event.key}
                label={event.label}
                description={event.description}
                checked={settings.customer[event.key] ?? event.defaultEnabled}
                onCheckedChange={(checked) => updateCustomerToggle(event.key, checked)}
              />
            ))}

            <div className="space-y-2 pt-2">
              <Label htmlFor="customer_reply_to_email">Reply-to email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="customer_reply_to_email"
                  className="pl-9"
                  type="email"
                  value={settings.customerReplyToEmail}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      customerReplyToEmail: event.target.value,
                    }))
                  }
                  placeholder="events@yourorganization.org"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Optional reply-to address shown on customer notification emails.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {message ? (
        <p className="text-sm text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending || !tablesAvailable}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save notification settings
        </Button>
      </div>
    </div>
  )

  if (embedded) {
    return body
  }

  return (
    <>
      <Header title={headerTitle} />
      {body}
    </>
  )
}
