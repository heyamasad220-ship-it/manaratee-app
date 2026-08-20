"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { updateEventWorkspaceMeta } from "@/lib/events/internal-event-actions"

export const EVENT_AUDIENCE_PRESETS = [
  "Everyone",
  "Families",
  "Adults",
  "Men",
  "Women",
  "Youth",
  "Children",
  "Seniors",
  "Members only",
] as const

export const EVENT_TAG_PRESETS = [
  "Fundraiser",
  "Education",
  "Youth",
  "Family",
  "Community",
  "Social",
  "Workshop",
  "Conference",
] as const

export type EventCoordinatorCandidate = {
  id: string
  full_name: string
}

const NONE_VALUE = "__none__"

function normalizeList(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) return []
  return values.filter((value) => typeof value === "string" && value.trim())
}

function toggleValue(list: string[], value: string, checked: boolean): string[] {
  if (checked) {
    return list.includes(value) ? list : [...list, value]
  }
  return list.filter((item) => item !== value)
}

export function InternalEventMetaSettings({
  eventId,
  coordinatorCandidates = [],
  initialCoordinatorContactId = null,
  initialAudience = [],
  initialEventTags = [],
  initialEstimatedAttendance = null,
  initialInternalNotes = null,
  canManage = true,
}: {
  eventId: string
  coordinatorCandidates?: EventCoordinatorCandidate[]
  initialCoordinatorContactId?: string | null
  initialAudience?: string[] | null
  initialEventTags?: string[] | null
  initialEstimatedAttendance?: number | null
  initialInternalNotes?: string | null
  canManage?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [coordinatorContactId, setCoordinatorContactId] = useState(
    initialCoordinatorContactId || NONE_VALUE
  )
  const [audience, setAudience] = useState(() => normalizeList(initialAudience))
  const [eventTags, setEventTags] = useState(() =>
    normalizeList(initialEventTags)
  )
  const [estimatedAttendance, setEstimatedAttendance] = useState(
    initialEstimatedAttendance != null ? String(initialEstimatedAttendance) : ""
  )
  const [internalNotes, setInternalNotes] = useState(
    initialInternalNotes || ""
  )

  const coordinatorOptions = (() => {
    const byId = new Map(
      coordinatorCandidates.map((candidate) => [candidate.id, candidate])
    )
    if (
      initialCoordinatorContactId &&
      !byId.has(initialCoordinatorContactId)
    ) {
      byId.set(initialCoordinatorContactId, {
        id: initialCoordinatorContactId,
        full_name: "Current coordinator",
      })
    }
    return Array.from(byId.values())
  })()

  useEffect(() => {
    setCoordinatorContactId(initialCoordinatorContactId || NONE_VALUE)
    setAudience(normalizeList(initialAudience))
    setEventTags(normalizeList(initialEventTags))
    setEstimatedAttendance(
      initialEstimatedAttendance != null
        ? String(initialEstimatedAttendance)
        : ""
    )
    setInternalNotes(initialInternalNotes || "")
    setSaved(false)
  }, [
    eventId,
    initialCoordinatorContactId,
    initialAudience,
    initialEventTags,
    initialEstimatedAttendance,
    initialInternalNotes,
  ])

  function markDirty() {
    setSaved(false)
  }

  function handleSave() {
    setSaveError(null)
    setSaved(false)

    const trimmedAttendance = estimatedAttendance.trim()
    let attendanceValue: number | null = null
    if (trimmedAttendance) {
      const parsed = Number.parseInt(trimmedAttendance, 10)
      if (!Number.isFinite(parsed) || parsed < 0) {
        setSaveError("Estimated attendance must be a non-negative number.")
        return
      }
      attendanceValue = parsed
    }

    startTransition(async () => {
      const result = await updateEventWorkspaceMeta({
        eventId,
        coordinatorContactId:
          coordinatorContactId === NONE_VALUE ? null : coordinatorContactId,
        audience,
        eventTags,
        estimatedAttendance: attendanceValue,
        internalNotes: internalNotes.trim() || null,
      })
      if (!result.success) {
        setSaveError(result.error || "Could not save event metadata.")
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Visibility & access</CardTitle>
        <p className="text-sm text-muted-foreground">
          Audience, tags, coordinator, and internal notes for this event.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="event-coordinator">Primary coordinator</Label>
          <Select
            value={coordinatorContactId}
            onValueChange={(value) => {
              setCoordinatorContactId(value)
              markDirty()
            }}
            disabled={!canManage || isPending}
          >
            <SelectTrigger id="event-coordinator">
              <SelectValue placeholder="Select a coordinator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>None</SelectItem>
              {coordinatorOptions.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Audience</Label>
            <p className="text-sm text-muted-foreground">
              Who this event is for (shown publicly when published).
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {EVENT_AUDIENCE_PRESETS.map((preset) => {
              const checked = audience.includes(preset)
              return (
                <label
                  key={preset}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    disabled={!canManage || isPending}
                    onCheckedChange={(next) => {
                      setAudience((prev) =>
                        toggleValue(prev, preset, next === true)
                      )
                      markDirty()
                    }}
                  />
                  <span>{preset}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Event tags</Label>
            <p className="text-sm text-muted-foreground">
              Search and filter labels (separate from event type).
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {EVENT_TAG_PRESETS.map((preset) => {
              const checked = eventTags.includes(preset)
              return (
                <label
                  key={preset}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    disabled={!canManage || isPending}
                    onCheckedChange={(next) => {
                      setEventTags((prev) =>
                        toggleValue(prev, preset, next === true)
                      )
                      markDirty()
                    }}
                  />
                  <span>{preset}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimated-attendance">Estimated attendance</Label>
          <p className="text-sm text-muted-foreground">
            Optional headcount estimate for open-public events.
          </p>
          <Input
            id="estimated-attendance"
            type="number"
            min={0}
            inputMode="numeric"
            value={estimatedAttendance}
            disabled={!canManage || isPending}
            onChange={(event) => {
              setEstimatedAttendance(event.target.value)
              markDirty()
            }}
            placeholder="e.g. 150"
            className="max-w-xs"
          />
        </div>

        <div className="space-y-2 border-t pt-6">
          <Label htmlFor="internal-notes">Internal notes</Label>
          <p className="text-sm text-muted-foreground">
            Staff-only notes — not shown on public pages.
          </p>
          <Textarea
            id="internal-notes"
            value={internalNotes}
            disabled={!canManage || isPending}
            onChange={(event) => {
              setInternalNotes(event.target.value)
              markDirty()
            }}
            rows={4}
            placeholder="Logistics, contacts, reminders…"
            className="min-h-24 resize-y"
          />
        </div>

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
                "Save metadata"
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
