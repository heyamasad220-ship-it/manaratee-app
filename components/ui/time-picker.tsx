"use client"

import { ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function parseTime24(time: string) {
  if (!time) {
    return { hours24: 12, minutes: 0 }
  }

  const [hoursPart, minutesPart] = time.split(":")
  const hours24 = Number.parseInt(hoursPart, 10)
  const minutes = Number.parseInt(minutesPart, 10)

  if (
    Number.isNaN(hours24) ||
    Number.isNaN(minutes) ||
    hours24 < 0 ||
    hours24 > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return { hours24: 12, minutes: 0 }
  }

  return { hours24, minutes }
}

export function toTime24(hours24: number, minutes: number) {
  const normalizedHours = ((hours24 % 24) + 24) % 24
  const normalizedMinutes = ((minutes % 60) + 60) % 60
  return `${String(normalizedHours).padStart(2, "0")}:${String(normalizedMinutes).padStart(2, "0")}`
}

export function to12HourParts(hours24: number) {
  const period = hours24 >= 12 ? "PM" : "AM"
  const hour12 = hours24 % 12 || 12
  return { hour12, period: period as "AM" | "PM" }
}

export function from12HourParts(hour12: number, period: "AM" | "PM") {
  if (period === "AM") {
    return hour12 === 12 ? 0 : hour12
  }

  return hour12 === 12 ? 12 : hour12 + 12
}

export function formatTimeDisplay(time24: string) {
  if (!time24) {
    return ""
  }

  const { hours24, minutes } = parseTime24(time24)
  const { hour12, period } = to12HourParts(hours24)
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`
}

type TimePickerSpinnerProps = {
  value: string
  onChange: (value: string) => void
  minuteStep?: number
  className?: string
}

function SpinnerColumn({
  label,
  onIncrement,
  onDecrement,
}: {
  label: string
  onIncrement: () => void
  onDecrement: () => void
}) {
  return (
    <div className="flex flex-col items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-10 text-muted-foreground hover:text-foreground"
        onClick={onIncrement}
        aria-label={`Increase ${label}`}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <span className="min-w-10 select-none text-center text-lg font-medium tabular-nums">
        {label}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-10 text-muted-foreground hover:text-foreground"
        onClick={onDecrement}
        aria-label={`Decrease ${label}`}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function TimePickerSpinner({
  value,
  onChange,
  minuteStep = 1,
  className,
}: TimePickerSpinnerProps) {
  const { hours24, minutes } = parseTime24(value || "12:00")
  const { hour12, period } = to12HourParts(hours24)

  function commit(nextHours24: number, nextMinutes: number) {
    onChange(toTime24(nextHours24, nextMinutes))
  }

  function adjustHour(delta: number) {
    commit(hours24 + delta, minutes)
  }

  function adjustMinute(delta: number) {
    const totalMinutes = hours24 * 60 + minutes + delta * minuteStep
    const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
    commit(Math.floor(wrapped / 60), wrapped % 60)
  }

  function adjustPeriod(delta: number) {
    if (delta > 0) {
      if (period === "AM") {
        commit(hours24 + 12, minutes)
      }
      return
    }

    if (period === "PM") {
      commit(hours24 - 12, minutes)
    }
  }

  return (
    <div className={cn("flex items-center justify-center gap-1 py-1", className)}>
      <SpinnerColumn
        label={String(hour12).padStart(2, "0")}
        onIncrement={() => adjustHour(1)}
        onDecrement={() => adjustHour(-1)}
      />
      <span className="pb-1 text-lg font-medium text-muted-foreground">:</span>
      <SpinnerColumn
        label={String(minutes).padStart(2, "0")}
        onIncrement={() => adjustMinute(1)}
        onDecrement={() => adjustMinute(-1)}
      />
      <SpinnerColumn
        label={period}
        onIncrement={() => adjustPeriod(1)}
        onDecrement={() => adjustPeriod(-1)}
      />
    </div>
  )
}
