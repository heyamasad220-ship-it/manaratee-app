"use client"

import { useEffect, useState } from "react"
import { format, isValid, parseISO } from "date-fns"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  formatTimeDisplay,
  parseTime24,
  TimePickerSpinner,
  toTime24,
} from "@/components/ui/time-picker"

function parseDatetimeLocal(value: string) {
  if (!value) {
    return { date: undefined as Date | undefined, time: "" }
  }

  const [datePart, timePart] = value.split("T")
  const parsedDate = parseISO(datePart)

  return {
    date: isValid(parsedDate) ? parsedDate : undefined,
    time: timePart?.slice(0, 5) ?? "",
  }
}

function toDatetimeLocal(date: Date | undefined, time: string) {
  if (!date || !time) {
    return ""
  }

  return `${format(date, "yyyy-MM-dd")}T${time}`
}

function formatDatetimeDisplay(date: Date | undefined, time: string) {
  if (!date || !time) {
    return ""
  }

  return `${format(date, "yyyy-MM-dd")} ${formatTimeDisplay(time)}`
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function getDefaultTime() {
  const now = new Date()
  return toTime24(now.getHours(), now.getMinutes())
}

export function toDatetimeLocalValue(value: string | null | Date) {
  if (!value) {
    return ""
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

export function addHoursToDatetimeLocal(value: string, hours: number) {
  if (!value) {
    return ""
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  date.setHours(date.getHours() + hours)
  return toDatetimeLocalValue(date)
}

export function DateTimeInput({
  id,
  value,
  onChange,
  className,
  placeholder = "Select date and time",
  disabled,
  min,
  minuteStep = 1,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  min?: string
  minuteStep?: number
}) {
  const [open, setOpen] = useState(false)
  const parsed = parseDatetimeLocal(value)
  const minParsed = parseDatetimeLocal(min ?? "")

  const [draftDate, setDraftDate] = useState<Date | undefined>(parsed.date)
  const [draftTime, setDraftTime] = useState(parsed.time || getDefaultTime())

  useEffect(() => {
    const nextParsed = parseDatetimeLocal(value)
    setDraftDate(nextParsed.date)
    setDraftTime(nextParsed.time || getDefaultTime())
  }, [value])

  const displayLabel = formatDatetimeDisplay(parsed.date, parsed.time)

  function commit(nextDate: Date | undefined, nextTime: string) {
    const resolvedDate = nextDate ?? new Date()
    let nextValue = toDatetimeLocal(resolvedDate, nextTime)

    if (
      minParsed.date &&
      minParsed.time &&
      startOfDay(resolvedDate).getTime() === startOfDay(minParsed.date).getTime() &&
      nextValue &&
      new Date(nextValue).getTime() < new Date(min ?? "").getTime()
    ) {
      nextValue = min ?? nextValue
      const clamped = parseDatetimeLocal(nextValue)
      setDraftTime(clamped.time || nextTime)
    }

    onChange(nextValue)
  }

  function handleDateSelect(selectedDate: Date | undefined) {
    if (!selectedDate) {
      onChange("")
      setDraftDate(undefined)
      setDraftTime(getDefaultTime())
      return
    }

    setDraftDate(selectedDate)
    commit(selectedDate, draftTime)
  }

  function handleTimeChange(nextTime: string) {
    setDraftTime(nextTime)
    commit(draftDate ?? new Date(), nextTime)
  }

  function handleToday() {
    const today = new Date()
    const nextTime = getDefaultTime()
    setDraftDate(today)
    setDraftTime(nextTime)
    commit(today, nextTime)
  }

  function handleClear() {
    setDraftDate(undefined)
    setDraftTime(getDefaultTime())
    onChange("")
    setOpen(false)
  }

  const minDate = minParsed.date

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn("w-full text-left", className)}
        >
          <Input
            readOnly
            disabled={disabled}
            value={displayLabel}
            placeholder={placeholder}
            className={cn(
              "cursor-pointer",
              !displayLabel ? "text-muted-foreground" : ""
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={draftDate}
          onSelect={handleDateSelect}
          disabled={
            minDate
              ? (candidate) => startOfDay(candidate) < startOfDay(minDate)
              : undefined
          }
          defaultMonth={draftDate ?? minDate}
          initialFocus
        />
        <div className="border-t px-3 py-2">
          <TimePickerSpinner
            value={draftTime}
            minuteStep={minuteStep}
            onChange={handleTimeChange}
          />
        </div>
        <div className="flex items-center justify-between border-t px-3 py-2">
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={handleToday}
          >
            Today
          </button>
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function isDatetimeBeforeMin(value: string, min: string) {
  if (!value || !min) {
    return false
  }

  const valueDate = new Date(value)
  const minDate = new Date(min)

  return valueDate.getTime() < minDate.getTime()
}

export function clampDatetimeToMin(value: string, min: string) {
  if (!isDatetimeBeforeMin(value, min)) {
    return value
  }

  return min
}

export { formatTimeDisplay, parseTime24 }
