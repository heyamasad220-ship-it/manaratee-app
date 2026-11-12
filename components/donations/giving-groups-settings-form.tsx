"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  getGivingGroupsEnabledAction,
  setGivingGroupsEnabledAction,
} from "@/lib/donations/giving-groups-settings-actions"

export function GivingGroupsSettingsForm() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getGivingGroupsEnabledAction().then((value) => {
      if (cancelled) return
      setEnabled(value)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleChange(next: boolean) {
    setSaving(true)
    setErrorMessage(null)
    const result = await setGivingGroupsEnabledAction(next)
    setSaving(false)
    if (!result.success) {
      setErrorMessage(result.error)
      return
    }
    setEnabled(next)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign groups</CardTitle>
        <CardDescription>
          Turn this on when the organization wants gifts assigned to a campaign group, such as a
          department competition. Staff then see Campaign group on Receive Payment, pledges, and
          recurring plans, including the donor profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="enable-giving-groups">Enable campaign groups on donation forms</Label>
                <p className="text-sm text-muted-foreground">
                  Off hides the field. Groups already saved on a campaign stay in place.
                </p>
              </div>
              <Switch
                id="enable-giving-groups"
                checked={enabled}
                disabled={saving}
                onCheckedChange={(checked) => void handleChange(checked)}
              />
            </div>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
