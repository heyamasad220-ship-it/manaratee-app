"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updateEventWorkspaceFeatures } from "@/lib/events/internal-event-actions"
import {
  DEFAULT_WORKSPACE_FEATURES,
  type EventWorkspaceFeatures,
} from "@/lib/events/event-workspace-features"

const FEATURE_ROWS: Array<{
  key: keyof EventWorkspaceFeatures
  label: string
  description: string
}> = [
  {
    key: "registration",
    label: "Registration",
    description: "Tickets, free sign-up, and attendee lists.",
  },
  {
    key: "staff",
    label: "Staff & volunteers",
    description: "Paid staff and volunteer assignments.",
  },
  {
    key: "youth",
    label: "Youth",
    description: "Childcare and youth group registrations.",
  },
  {
    key: "vendors",
    label: "Vendors",
    description: "Vendor applications and assignments.",
  },
  {
    key: "finance",
    label: "Finance",
    description: "Expense tracking and event net summary.",
  },
  {
    key: "waitlist",
    label: "Waitlist",
    description: "Allow waitlisting when capacity is full.",
  },
]

export function InternalEventFeaturesSettings({
  eventId,
  initialFeatures,
  canManage = true,
}: {
  eventId: string
  initialFeatures?: Partial<EventWorkspaceFeatures> | null
  canManage?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [features, setFeatures] = useState<EventWorkspaceFeatures>(() => ({
    ...DEFAULT_WORKSPACE_FEATURES,
    ...(initialFeatures || {}),
  }))

  useEffect(() => {
    setFeatures({
      ...DEFAULT_WORKSPACE_FEATURES,
      ...(initialFeatures || {}),
    })
    setSaved(false)
  }, [eventId, initialFeatures])

  function toggle(key: keyof EventWorkspaceFeatures, checked: boolean) {
    setFeatures((prev) => ({ ...prev, [key]: checked }))
    setSaved(false)
  }

  function handleSave() {
    setSaveError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateEventWorkspaceFeatures({
        eventId,
        features,
      })
      if (!result.success) {
        setSaveError(result.error || "Could not save workspace features.")
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workspace modules</CardTitle>
        <p className="text-sm text-muted-foreground">
          Turn modules on to show their tabs and overview cards. Some tabs also
          appear automatically when data already exists.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {FEATURE_ROWS.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4 rounded-lg border p-3"
          >
            <div>
              <Label htmlFor={`feature-${row.key}`} className="text-sm font-medium">
                {row.label}
              </Label>
              <p className="text-sm text-muted-foreground">{row.description}</p>
            </div>
            <Switch
              id={`feature-${row.key}`}
              checked={features[row.key]}
              disabled={!canManage || isPending}
              onCheckedChange={(checked) => toggle(row.key, checked)}
            />
          </div>
        ))}

        {canManage ? (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
            {saveError ? (
              <p className="mr-auto text-sm text-destructive">{saveError}</p>
            ) : saved ? (
              <p className="mr-auto text-sm text-muted-foreground">Saved</p>
            ) : null}
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save features"
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
