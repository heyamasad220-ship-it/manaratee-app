"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  listCampaignProspectActivitiesAction,
  logCampaignProspectActivityAction,
} from "@/lib/donations/campaign-prospect-actions"
import {
  CAMPAIGN_PROSPECT_ACTIVITY_TYPE_LABELS,
  CAMPAIGN_PROSPECT_ACTIVITY_TYPES,
  type CampaignProspectActivityRow,
  type CampaignProspectActivityType,
} from "@/lib/donations/campaign-prospect-types"

function formatActivityDate(value: string | null | undefined) {
  if (!value) return "—"
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
  const date = dateOnly ? new Date(`${dateOnly}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function todayIso() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${today.getFullYear()}-${month}-${day}`
}

export function CampaignProspectActivityPanel({
  prospectId,
  canManage,
  onLastContactUpdated,
}: {
  prospectId: string
  canManage: boolean
  onLastContactUpdated?: (lastContactedAt: string | null) => void
}) {
  const [activities, setActivities] = useState<CampaignProspectActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activityType, setActivityType] = useState<CampaignProspectActivityType>("phone_call")
  const [activityDate, setActivityDate] = useState(todayIso)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listCampaignProspectActivitiesAction(prospectId).then((result) => {
      if (cancelled) return
      if (result.success) setActivities(result.activities)
      else setActivities([])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [prospectId])

  async function handleSave() {
    setSaving(true)
    const result = await logCampaignProspectActivityAction(prospectId, {
      activity_type: activityType,
      activity_date: activityDate,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (!result.success) {
      alert(result.error)
      return
    }
    setActivities((prev) => [result.activity, ...prev])
    setShowForm(false)
    setNotes("")
    setActivityDate(todayIso())
    onLastContactUpdated?.(result.lastContactedAt)
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Outreach Activity</h3>
        {canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? "Cancel" : "Log Activity"}
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-md bg-muted/40 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Activity Type</Label>
              <Select
                value={activityType}
                onValueChange={(value: CampaignProspectActivityType) => setActivityType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_PROSPECT_ACTIVITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {CAMPAIGN_PROSPECT_ACTIVITY_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity-date">Date</Label>
              <Input
                id="activity-date"
                type="date"
                value={activityDate}
                onChange={(event) => setActivityDate(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="activity-notes">Notes</Label>
            <Textarea
              id="activity-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Called office manager. Asked us to email the sponsorship packet."
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving..." : "Save Activity"}
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading activity…</p>
      ) : activities.length === 0 ? (
        <p className="text-xs text-muted-foreground">No outreach logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {activities.map((activity) => (
            <li key={activity.id} className="border-l-2 border-border pl-3">
              <p className="text-xs text-muted-foreground">
                {formatActivityDate(activity.activity_date)} ·{" "}
                {CAMPAIGN_PROSPECT_ACTIVITY_TYPE_LABELS[activity.activity_type]}
              </p>
              {activity.notes ? (
                <p className="text-sm leading-snug">{activity.notes}</p>
              ) : null}
              {activity.created_by_name ? (
                <p className="text-xs text-muted-foreground">{activity.created_by_name}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
