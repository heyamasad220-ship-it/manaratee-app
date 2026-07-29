"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TimeInput } from "@/components/ui/time-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createRecurringScheduleItems,
  createScheduleItem,
  deleteScheduleItem,
  updateScheduleItem,
} from "@/lib/programs/program-schedule-actions"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { ProgramScheduleItem } from "@/lib/programs/program-schedule-types"
import {
  PROGRAM_SCHEDULE_DAY_LABELS,
  PROGRAM_SCHEDULE_DAYS,
  type ProgramScheduleDayOfWeek,
} from "@/lib/programs/program-schedule-types"
import { FacilityVenueSelect } from "@/components/reservations/facility-venue-select"
import { cn } from "@/lib/utils"

const DAY_SHORT: Record<ProgramScheduleDayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(value: string) {
  if (!value) return "—"
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return value
  const hour = Number(match[1])
  const minute = match[2]
  const suffix = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${suffix}`
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

const JS_DAY_TO_SCHEDULE: ProgramScheduleDayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

function weekKey(date: Date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = copy.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + mondayOffset)
  return `${copy.getFullYear()}-${copy.getMonth() + 1}-${copy.getDate()}`
}

function countScheduleSpan(
  start: string | null,
  end: string | null,
  scheduledDays: ProgramScheduleDayOfWeek[]
) {
  if (!start || !end || scheduledDays.length === 0) {
    return { weeks: null as number | null, meetings: null as number | null }
  }
  const startDate = parseLocalDate(start)
  const endDate = parseLocalDate(end)
  if (!startDate || !endDate || endDate < startDate) {
    return { weeks: null, meetings: null }
  }

  const daySet = new Set(scheduledDays)
  const weeks = new Set<string>()
  let meetings = 0
  const cursor = new Date(startDate)

  while (cursor <= endDate) {
    const scheduleDay = JS_DAY_TO_SCHEDULE[cursor.getDay()]
    if (daySet.has(scheduleDay)) {
      meetings += 1
      weeks.add(weekKey(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  if (meetings === 0) {
    const spanned = new Set<string>()
    const walk = new Date(startDate)
    while (walk <= endDate) {
      spanned.add(weekKey(walk))
      walk.setDate(walk.getDate() + 1)
    }
    return { weeks: Math.max(1, spanned.size), meetings: null }
  }

  return { weeks: weeks.size, meetings }
}

function uniqueOrderedDays(items: ProgramScheduleItem[]) {
  const present = new Set(items.map((item) => item.day_of_week))
  return PROGRAM_SCHEDULE_DAYS.filter((day) => present.has(day))
}

type ScheduleDraft = {
  title: string
  day_of_week: ProgramScheduleDayOfWeek
  days_of_week: ProgramScheduleDayOfWeek[]
  start_time: string
  end_time: string
  location: string
  venue_id: string
  instructor_name: string
  capacity: string
  recurring: boolean
}

const emptyDraft = (defaultTitle = ""): ScheduleDraft => ({
  title: defaultTitle,
  day_of_week: "sunday",
  days_of_week: ["sunday"],
  start_time: "09:00",
  end_time: "10:00",
  location: "",
  venue_id: "",
  instructor_name: "",
  capacity: "",
  recurring: true,
})

function itemToDraft(item: ProgramScheduleItem): ScheduleDraft {
  return {
    title: item.title,
    day_of_week: item.day_of_week,
    days_of_week: [item.day_of_week],
    start_time: item.start_time?.slice(0, 5) || "09:00",
    end_time: item.end_time?.slice(0, 5) || "10:00",
    location: item.location || "",
    venue_id: item.venue_id || "",
    instructor_name: item.instructor_name || "",
    capacity: item.capacity == null ? "" : String(item.capacity),
    recurring: false,
  }
}

function SummaryField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm font-semibold text-foreground">{children}</div>
    </div>
  )
}

/**
 * Single schedule block: offering dates + weekly meeting times with add/edit/delete.
 */
export function OfferingScheduleSummaryCard({
  offering,
  programId,
  items: initialItems,
  venues = [],
}: {
  offering: ProgramOffering
  programId: string
  items: ProgramScheduleItem[]
  venues?: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [items, setItems] = React.useState(initialItems)
  const [open, setOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<ScheduleDraft>(emptyDraft)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const days = uniqueOrderedDays(items)
  const { weeks, meetings } = countScheduleSpan(
    offering.start_date,
    offering.end_date,
    days
  )

  function openCreate() {
    setEditingId(null)
    setDraft(emptyDraft(offering.name))
    setError(null)
    setOpen(true)
  }

  function openEdit(item: ProgramScheduleItem) {
    setEditingId(item.id)
    setDraft(itemToDraft(item))
    setError(null)
    setOpen(true)
  }

  async function handleSave() {
    const title = draft.title.trim() || offering.name.trim() || "Weekly time"
    if (!draft.start_time || !draft.end_time) {
      setError("Start and end time are required.")
      return
    }

    setSaving(true)
    setError(null)

    const capacity =
      draft.capacity.trim() === "" ? undefined : Number(draft.capacity)

    try {
      if (editingId) {
        await updateScheduleItem(editingId, {
          program_id: programId,
          offering_id: offering.id,
          title,
          day_of_week: draft.day_of_week,
          start_time: draft.start_time,
          end_time: draft.end_time,
          location: draft.location.trim() || undefined,
          venue_id: draft.venue_id || null,
          instructor_name: draft.instructor_name.trim() || undefined,
          capacity: Number.isFinite(capacity) ? capacity : undefined,
        })
      } else if (draft.recurring && draft.days_of_week.length > 0) {
        await createRecurringScheduleItems({
          program_id: programId,
          offering_id: offering.id,
          title,
          days_of_week: draft.days_of_week,
          start_time: draft.start_time,
          end_time: draft.end_time,
          location: draft.location.trim() || undefined,
          venue_id: draft.venue_id || null,
          instructor_name: draft.instructor_name.trim() || undefined,
          capacity: Number.isFinite(capacity) ? capacity : undefined,
        })
      } else {
        await createScheduleItem({
          program_id: programId,
          offering_id: offering.id,
          title,
          day_of_week: draft.day_of_week,
          start_time: draft.start_time,
          end_time: draft.end_time,
          location: draft.location.trim() || undefined,
          venue_id: draft.venue_id || null,
          instructor_name: draft.instructor_name.trim() || undefined,
          capacity: Number.isFinite(capacity) ? capacity : undefined,
        })
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save schedule.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: ProgramScheduleItem) {
    if (!window.confirm(`Remove “${item.title}” from the weekly schedule?`)) {
      return
    }

    try {
      await deleteScheduleItem(item.id, programId, offering.id)
      setItems((current) => current.filter((row) => row.id !== item.id))
      router.refresh()
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Could not delete schedule item."
      )
    }
  }

  function toggleRecurringDay(day: ProgramScheduleDayOfWeek, checked: boolean) {
    setDraft((current) => {
      const next = checked
        ? Array.from(new Set([...current.days_of_week, day]))
        : current.days_of_week.filter((value) => value !== day)
      return {
        ...current,
        days_of_week: next.length > 0 ? next : [day],
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          When and where this offering meets. Weekly times update the schedule
          summary below.
        </p>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add time
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryField label="Start Date">
          {formatDate(offering.start_date)}
        </SummaryField>
        <SummaryField label="End Date">
          {formatDate(offering.end_date)}
        </SummaryField>
        <SummaryField label="Duration">
          {weeks != null ? `${weeks} weeks` : "—"}
        </SummaryField>
      </div>

      <div className="border-t" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Repeats</p>
          <p className="text-sm font-semibold">
            {items.length > 0 ? "Weekly" : "—"}
          </p>
        </div>
        <p className="text-sm font-semibold">
          {meetings != null
            ? `${meetings} class meeting${meetings === 1 ? "" : "s"}`
            : items.length > 0
              ? `${items.length} weekly time${items.length === 1 ? "" : "s"}`
              : "No weekly times yet"}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Add a weekly day and time. It will show here and drive the schedule
          above.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
            >
              <Badge
                variant="outline"
                className="rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700"
              >
                {DAY_SHORT[item.day_of_week]}
              </Badge>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium">
                  {formatTime(item.start_time)} – {formatTime(item.end_time)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[item.location?.trim(), item.instructor_name?.trim()]
                    .filter(Boolean)
                    .join(" · ") || "No location"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => openEdit(item)}
                  aria-label="Edit schedule time"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => void handleDelete(item)}
                  aria-label="Delete schedule time"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit weekly time" : "Add weekly time"}
            </DialogTitle>
            <DialogDescription>
              Recurring times update Days, Time, and Location on this schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-title">Title (optional)</Label>
              <Input
                id="schedule-title"
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder={offering.name || "Uses program name if blank"}
              />
            </div>

            {!editingId ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="schedule-recurring"
                  checked={draft.recurring}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      recurring: checked === true,
                    }))
                  }
                />
                <Label htmlFor="schedule-recurring" className="font-normal">
                  Repeat on multiple days
                </Label>
              </div>
            ) : null}

            {editingId || !draft.recurring ? (
              <div className="space-y-2">
                <Label>Day</Label>
                <Select
                  value={draft.day_of_week}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      day_of_week: value as ProgramScheduleDayOfWeek,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROGRAM_SCHEDULE_DAYS.map((day) => (
                      <SelectItem key={day} value={day}>
                        {PROGRAM_SCHEDULE_DAY_LABELS[day]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Days</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PROGRAM_SCHEDULE_DAYS.map((day) => (
                    <label
                      key={day}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={draft.days_of_week.includes(day)}
                        onCheckedChange={(checked) =>
                          toggleRecurringDay(day, checked === true)
                        }
                      />
                      {PROGRAM_SCHEDULE_DAY_LABELS[day]}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="schedule-start">Start</Label>
                <TimeInput
                  id="schedule-start"
                  value={draft.start_time}
                  minuteStep={5}
                  onChange={(nextValue) =>
                    setDraft((current) => ({
                      ...current,
                      start_time: nextValue || "09:00",
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-end">End</Label>
                <TimeInput
                  id="schedule-end"
                  value={draft.end_time}
                  minuteStep={5}
                  onChange={(nextValue) =>
                    setDraft((current) => ({
                      ...current,
                      end_time: nextValue || "10:00",
                    }))
                  }
                />
              </div>
            </div>

            <FacilityVenueSelect
              id="schedule-venue"
              value={draft.venue_id}
              venues={venues}
              disabled={saving}
              onChange={(venueId, venueName) =>
                setDraft((current) => ({
                  ...current,
                  venue_id: venueId,
                  location:
                    venueName ||
                    (venueId ? current.location : current.location),
                }))
              }
            />

            <div className="space-y-2">
              <Label htmlFor="schedule-location">Location label</Label>
              <Input
                id="schedule-location"
                value={draft.location}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
                placeholder="Optional display label"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-instructor">Instructor</Label>
              <Input
                id="schedule-instructor"
                value={draft.instructor_name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    instructor_name: event.target.value,
                  }))
                }
                placeholder="Optional"
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
