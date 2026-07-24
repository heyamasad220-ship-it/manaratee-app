"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createRecurringScheduleItems,
  createScheduleItem,
  deleteScheduleItem,
  updateScheduleItem,
} from "@/lib/programs/program-schedule-actions"
import type { ProgramScheduleItem } from "@/lib/programs/program-schedule-types"
import {
  PROGRAM_SCHEDULE_DAY_LABELS,
  PROGRAM_SCHEDULE_DAYS,
  type ProgramScheduleDayOfWeek,
} from "@/lib/programs/program-schedule-types"

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

type ScheduleDraft = {
  title: string
  day_of_week: ProgramScheduleDayOfWeek
  days_of_week: ProgramScheduleDayOfWeek[]
  start_time: string
  end_time: string
  location: string
  instructor_name: string
  capacity: string
  recurring: boolean
}

const emptyDraft = (defaultTitle = ""): ScheduleDraft => ({
  title: defaultTitle,
  day_of_week: "monday",
  days_of_week: ["monday"],
  start_time: "09:00",
  end_time: "10:00",
  location: "",
  instructor_name: "",
  capacity: "",
  recurring: false,
})

function itemToDraft(item: ProgramScheduleItem): ScheduleDraft {
  return {
    title: item.title,
    day_of_week: item.day_of_week,
    days_of_week: [item.day_of_week],
    start_time: item.start_time?.slice(0, 5) || "09:00",
    end_time: item.end_time?.slice(0, 5) || "10:00",
    location: item.location || "",
    instructor_name: item.instructor_name || "",
    capacity: item.capacity == null ? "" : String(item.capacity),
    recurring: false,
  }
}

export function OfferingWeeklyScheduleEditor({
  programId,
  offeringId,
  offeringName,
  items: initialItems,
}: {
  programId: string
  offeringId: string
  offeringName: string
  items: ProgramScheduleItem[]
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

  function openCreate() {
    setEditingId(null)
    setDraft(emptyDraft(offeringName))
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
    const title = draft.title.trim() || offeringName.trim() || "Weekly time"
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
          offering_id: offeringId,
          title,
          day_of_week: draft.day_of_week,
          start_time: draft.start_time,
          end_time: draft.end_time,
          location: draft.location.trim() || undefined,
          instructor_name: draft.instructor_name.trim() || undefined,
          capacity: Number.isFinite(capacity) ? capacity : undefined,
        })
      } else if (draft.recurring && draft.days_of_week.length > 0) {
        await createRecurringScheduleItems({
          program_id: programId,
          offering_id: offeringId,
          title,
          days_of_week: draft.days_of_week,
          start_time: draft.start_time,
          end_time: draft.end_time,
          location: draft.location.trim() || undefined,
          instructor_name: draft.instructor_name.trim() || undefined,
          capacity: Number.isFinite(capacity) ? capacity : undefined,
        })
      } else {
        await createScheduleItem({
          program_id: programId,
          offering_id: offeringId,
          title,
          day_of_week: draft.day_of_week,
          start_time: draft.start_time,
          end_time: draft.end_time,
          location: draft.location.trim() || undefined,
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
      await deleteScheduleItem(item.id, programId, offeringId)
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
    <div className="space-y-4 rounded-lg border bg-muted/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Edit weekly times</p>
            <p className="text-sm text-muted-foreground">
              Add or change recurring days, times, and locations for{" "}
              {offeringName}.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add time
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No weekly times yet. Add a day and time for this program.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="secondary">
                      {PROGRAM_SCHEDULE_DAY_LABELS[item.day_of_week] ||
                        item.day_of_week}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatTime(item.start_time)} – {formatTime(item.end_time)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{item.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.location || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.instructor_name || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(item)}
                        aria-label="Edit schedule item"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => void handleDelete(item)}
                        aria-label="Delete schedule item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit weekly time" : "Add weekly time"}
            </DialogTitle>
            <DialogDescription>
              These times show on department schedule and the customer program
              page.
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
                placeholder={offeringName || "Uses program name if blank"}
              />
              <p className="text-xs text-muted-foreground">
                Defaults to the program name when left blank.
              </p>
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

            <div className="space-y-2">
              <Label htmlFor="schedule-location">Location</Label>
              <Input
                id="schedule-location"
                value={draft.location}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
                placeholder="Optional"
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

            <div className="space-y-2">
              <Label htmlFor="schedule-capacity">Capacity (optional)</Label>
              <Input
                id="schedule-capacity"
                type="number"
                min={0}
                value={draft.capacity}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    capacity: event.target.value,
                  }))
                }
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
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
