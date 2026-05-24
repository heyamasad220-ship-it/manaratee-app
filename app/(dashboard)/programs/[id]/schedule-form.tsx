"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Plus, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createRecurringScheduleItems,
  createScheduleItem,
  updateScheduleItem,
} from "@/lib/programs/program-schedule-actions"

const DAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
]

const COLORS = [
  { value: "bg-blue-500", label: "Blue" },
  { value: "bg-green-500", label: "Green" },
  { value: "bg-purple-500", label: "Purple" },
  { value: "bg-amber-500", label: "Amber" },
  { value: "bg-red-500", label: "Red" },
  { value: "bg-pink-500", label: "Pink" },
  { value: "bg-teal-500", label: "Teal" },
]

const TIMES = [
  { value: "07:00:00", label: "7:00 AM" },
  { value: "07:30:00", label: "7:30 AM" },
  { value: "08:00:00", label: "8:00 AM" },
  { value: "08:30:00", label: "8:30 AM" },
  { value: "09:00:00", label: "9:00 AM" },
  { value: "09:30:00", label: "9:30 AM" },
  { value: "10:00:00", label: "10:00 AM" },
  { value: "10:30:00", label: "10:30 AM" },
  { value: "11:00:00", label: "11:00 AM" },
  { value: "11:30:00", label: "11:30 AM" },
  { value: "12:00:00", label: "12:00 PM" },
  { value: "12:30:00", label: "12:30 PM" },
  { value: "13:00:00", label: "1:00 PM" },
  { value: "13:30:00", label: "1:30 PM" },
  { value: "14:00:00", label: "2:00 PM" },
  { value: "14:30:00", label: "2:30 PM" },
  { value: "15:00:00", label: "3:00 PM" },
  { value: "15:30:00", label: "3:30 PM" },
  { value: "16:00:00", label: "4:00 PM" },
  { value: "16:30:00", label: "4:30 PM" },
  { value: "17:00:00", label: "5:00 PM" },
  { value: "17:30:00", label: "5:30 PM" },
  { value: "18:00:00", label: "6:00 PM" },
  { value: "18:30:00", label: "6:30 PM" },
  { value: "19:00:00", label: "7:00 PM" },
  { value: "19:30:00", label: "7:30 PM" },
  { value: "20:00:00", label: "8:00 PM" },
]

function normalizeTime(value?: string | null) {
  if (!value) return ""

  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    return value
  }

  const match = value.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i)

  if (!match) {
    return value
  }

  let hours = Number(match[1])
  const minutes = match[2]
  const period = match[3].toUpperCase()

  if (period === "PM" && hours !== 12) {
    hours += 12
  }

  if (period === "AM" && hours === 12) {
    hours = 0
  }

  return `${String(hours).padStart(2, "0")}:${minutes}:00`
}

type ScheduleFormItem = {
  id: string
  title: string
  day_of_week: string
  start_time: string
  end_time: string
  location: string | null
  instructor_name: string | null
  capacity: number | null
  color: string
}

type ScheduleFormProps = {
  programId: string
  item?: ScheduleFormItem
  onSuccess?: () => void
}

export function ScheduleForm({
  programId,
  item,
  onSuccess,
}: ScheduleFormProps) {
  const router = useRouter()

  const [isSaving, setIsSaving] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")
  const [isRecurring, setIsRecurring] = React.useState(false)

  const [selectedDays, setSelectedDays] = React.useState<string[]>(
    item?.day_of_week ? [item.day_of_week] : ["monday"]
  )

  function toggleDay(day: string) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((currentDay) => currentDay !== day)
        : [...current, day]
    )
  }

  async function handleSubmit(formData: FormData) {
    setIsSaving(true)
    setErrorMessage("")

    const payload = {
      program_id: programId,
      title: String(formData.get("title") || ""),
      day_of_week: String(formData.get("day_of_week") || "monday"),
      start_time: normalizeTime(String(formData.get("start_time") || "")),
      end_time: normalizeTime(String(formData.get("end_time") || "")),
      location: String(formData.get("location") || ""),
      instructor_name: String(formData.get("instructor_name") || ""),
      capacity: Number(formData.get("capacity") || 0),
      color: String(formData.get("color") || "bg-blue-500"),
    }

    try {
      if (item) {
        await updateScheduleItem(item.id, payload)
      } else if (isRecurring && selectedDays.length > 0) {
        await createRecurringScheduleItems({
          ...payload,
          days_of_week: selectedDays,
        })
      } else {
        await createScheduleItem(payload)
      }

      router.refresh()
      onSuccess?.()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      action={handleSubmit}
      className="grid gap-4 rounded-lg border bg-muted/20 p-4"
    >
      <div>
        <h3 className="font-medium">
          {item ? "Edit Schedule Item" : "Add Schedule Item"}
        </h3>

        <p className="text-sm text-muted-foreground">
          Add an activity, class, or session time for this program.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {!item && (
        <div className="rounded-lg border bg-background p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(event) => setIsRecurring(event.target.checked)}
            />
            Create recurring schedule
          </label>

          {isRecurring && (
            <div className="mt-4 flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const active = selectedDays.includes(day.value)

                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div
  className="grid gap-4"
  style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
>
        <div className="space-y-2">
          <Label htmlFor="title">Activity Name</Label>
          <Input
            id="title"
            name="title"
            required
            placeholder="Arts & Crafts"
            defaultValue={item?.title || ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            placeholder="Room 101, Gym, Field A"
            defaultValue={item?.location || ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructor_name">Instructor</Label>
          <Input
            id="instructor_name"
            name="instructor_name"
            placeholder="Instructor name"
            defaultValue={item?.instructor_name || ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min="0"
            placeholder="20"
            defaultValue={item?.capacity || ""}
          />
        </div>
      </div>

      <div
  className="grid gap-4"
  style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
>
        {!isRecurring && (
          <div className="space-y-2">
            <Label htmlFor="day_of_week">Day</Label>
            <select
              id="day_of_week"
              name="day_of_week"
              defaultValue={item?.day_of_week || "monday"}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="start_time">Start Time</Label>
          <select
            id="start_time"
            name="start_time"
            defaultValue={normalizeTime(item?.start_time) || "09:00:00"}
            required
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {TIMES.map((time) => (
              <option key={time.value} value={time.value}>
                {time.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_time">End Time</Label>
          <select
            id="end_time"
            name="end_time"
            defaultValue={normalizeTime(item?.end_time) || "10:00:00"}
            required
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {TIMES.map((time) => (
              <option key={time.value} value={time.value}>
                {time.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <select
            id="color"
            name="color"
            defaultValue={item?.color || "bg-blue-500"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {COLORS.map((color) => (
              <option key={color.value} value={color.value}>
                {color.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {item ? (
            <Save className="mr-2 h-4 w-4" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}

          {isSaving
            ? item
              ? "Saving..."
              : "Adding..."
            : item
              ? "Save Changes"
              : isRecurring
                ? "Create Recurring Schedule"
                : "Add Schedule Item"}
        </Button>
      </div>
    </form>
  )
}