"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { EventManagementSettingsNav } from "@/components/events/event-management-settings-nav"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updateEventManagementSettings } from "@/lib/events/event-management-settings-actions"
import type { EventManagementOrgSettings } from "@/lib/events/event-management-settings"

type EventManagementGeneralSettingsClientProps = {
  settings: EventManagementOrgSettings
  canManage: boolean
}

export function EventManagementGeneralSettingsClient({
  settings,
  canManage,
}: EventManagementGeneralSettingsClientProps) {
  const router = useRouter()
  const [approvalRequired, setApprovalRequired] = useState(
    settings.approvalRequired
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!canManage) return
    setError(null)
    setSaved(false)

    startTransition(async () => {
      try {
        const next = await updateEventManagementSettings({
          approvalRequired,
        })
        setApprovalRequired(next.approvalRequired)
        setSaved(true)
        router.refresh()
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save settings."
        )
      }
    })
  }

  return (
    <>
      <Header title="Event Management" />
      <div className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose whether Center events wait for approval before they go live.
          </p>
        </div>

        <EventManagementSettingsNav />

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {saved ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Settings saved.
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval required</CardTitle>
            <CardDescription>
              Off by default. When on, only on-site (Center) events wait in
              Pending until a manager confirms them. Online and External Venue
              events never wait for approval and do not use Facilities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div>
                <Label htmlFor="approval-required">Require approval for on-site events</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Leave this off if your organization does not review Center
                  events before they go live.
                </p>
              </div>
              <Switch
                id="approval-required"
                checked={approvalRequired}
                onCheckedChange={setApprovalRequired}
                disabled={!canManage || isPending}
              />
            </div>

            {canManage ? (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save settings
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
