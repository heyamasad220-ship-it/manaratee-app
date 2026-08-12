"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { TimeInput } from "@/components/ui/time-input"
import {
  clearOfferingWeeklySchedule,
  replaceOfferingWeeklySchedule,
} from "@/lib/programs/program-schedule-actions"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { ProgramScheduleItem } from "@/lib/programs/program-schedule-types"
import {
  PROGRAM_SCHEDULE_DAY_LABELS,
  PROGRAM_SCHEDULE_DAYS,
  type ProgramScheduleDayOfWeek,
} from "@/lib/programs/program-schedule-types"
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

function uniqueOrderedDays(items: ProgramScheduleItem[]) {
  const present = new Set(items.map((item) => item.day_of_week))
  return PROGRAM_SCHEDULE_DAYS.filter((day) => present.has(day))
}

/**
 * Compact schedule editor: Time, Repeat (Weekly), and Days only.
 * Persists via parent Save through `saveHandlerRef` (no local Save button).
 */
export function OfferingSimpleScheduleForm({
  offering,
  programId,
  items: initialItems,
  saveHandlerRef,
  disabled = false,
}: {
  offering: ProgramOffering
  programId: string
  items: ProgramScheduleItem[]
  saveHandlerRef?: React.MutableRefObject<(() => Promise<boolean>) | null>
  disabled?: boolean
}) {
  const [items, setItems] = React.useState(initialItems)
  const [startTime, setStartTime] = React.useState("09:00")
  const [endTime, setEndTime] = React.useState("11:00")
  const [repeat, setRepeat] = React.useState<"weekly">("weekly")
  const [weekInterval, setWeekInterval] = React.useState("1")
  const [days, setDays] = React.useState<ProgramScheduleDayOfWeek[]>([])
  const [daysOpen, setDaysOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setItems(initialItems)
    const ordered = uniqueOrderedDays(initialItems)
    setDays(ordered.length > 0 ? ordered : [])
    const first = initialItems[0]
    if (first) {
      setStartTime(first.start_time?.slice(0, 5) || "09:00")
      setEndTime(first.end_time?.slice(0, 5) || "11:00")
    }
  }, [initialItems])

  const daysLabel =
    days.length === 0
      ? "Select days"
      : days.map((day) => DAY_SHORT[day]).join(", ")

  function toggleDay(day: ProgramScheduleDayOfWeek, checked: boolean) {
    setDays((current) => {
      if (checked) {
        return PROGRAM_SCHEDULE_DAYS.filter(
          (value) => current.includes(value) || value === day
        )
      }
      return current.filter((value) => value !== day)
    })
  }

  async function handleSave(): Promise<boolean> {
    setError(null)

    if (!startTime || !endTime) {
      setError("Start and end time are required.")
      return false
    }
    const interval = Number(weekInterval)
    if (!Number.isFinite(interval) || interval < 1) {
      setError("Weekly interval must be at least 1.")
      return false
    }
    if (interval !== 1) {
      setError("Only every 1 week is supported for now.")
      return false
    }

    // No days selected: clear existing weekly times if any; otherwise nothing to save.
    if (days.length === 0) {
      if (items.length === 0) return true
      try {
        await clearOfferingWeeklySchedule({
          program_id: programId,
          offering_id: offering.id,
        })
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not clear schedule."
        )
        return false
      }
    }

    const seed = items[0]

    try {
      await replaceOfferingWeeklySchedule({
        program_id: programId,
        offering_id: offering.id,
        title: offering.name.trim() || "Weekly time",
        days_of_week: days,
        start_time: startTime,
        end_time: endTime,
        location: seed?.location || undefined,
        venue_id: seed?.venue_id ?? null,
        instructor_name: seed?.instructor_name || undefined,
      })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save schedule.")
      return false
    }
  }

  React.useEffect(() => {
    if (!saveHandlerRef) return
    saveHandlerRef.current = () => handleSave()
    return () => {
      saveHandlerRef.current = null
    }
  })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>
          Time<span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">From</span>
            <TimeInput
              id="simple-schedule-start"
              value={startTime}
              minuteStep={5}
              disabled={disabled}
              onChange={(next) => setStartTime(next || "09:00")}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">to</span>
            <TimeInput
              id="simple-schedule-end"
              value={endTime}
              minuteStep={5}
              disabled={disabled}
              onChange={(next) => setEndTime(next || "11:00")}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className="w-[7.5rem] shrink-0 space-y-1.5">
            <Label htmlFor="simple-schedule-repeat">
              Repeat<span className="text-destructive">*</span>
            </Label>
            <select
              id="simple-schedule-repeat"
              value={repeat}
              onChange={() => setRepeat("weekly")}
              disabled={disabled}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Weekly rule<span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Every</span>
              <Input
                type="number"
                min={1}
                step={1}
                value={weekInterval}
                onChange={(event) => setWeekInterval(event.target.value)}
                disabled={disabled}
                className="h-9 w-14 bg-background"
              />
              <Popover open={daysOpen} onOpenChange={setDaysOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                      "h-9 min-w-[8.5rem] justify-between font-normal",
                      days.length === 0 && "text-muted-foreground"
                    )}
                  >
                    <span className="truncate">Days: {daysLabel}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    {PROGRAM_SCHEDULE_DAYS.map((day) => (
                      <label
                        key={day}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                      >
                        <Checkbox
                          checked={days.includes(day)}
                          onCheckedChange={(checked) =>
                            toggleDay(day, checked === true)
                          }
                        />
                        {PROGRAM_SCHEDULE_DAY_LABELS[day]}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
