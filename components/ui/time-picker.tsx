"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

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

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1)

function buildMinuteOptions(minuteStep: number) {
  const step = Math.max(1, Math.min(30, minuteStep))
  const options: number[] = []
  for (let minute = 0; minute < 60; minute += step) {
    options.push(minute)
  }
  return options
}

const selectClassName =
  "h-10 rounded-md border border-input bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

type TimePickerSpinnerProps = {
  value: string
  onChange: (value: string) => void
  minuteStep?: number
  className?: string
}

/** Full hour / minute / AM·PM selects so every option is visible (not the OS scroll slice). */
export function TimePickerSpinner({
  value,
  onChange,
  minuteStep = 5,
  className,
}: TimePickerSpinnerProps) {
  const id = React.useId()
  const { hours24, minutes } = parseTime24(value || "12:00")
  const { hour12, period } = to12HourParts(hours24)
  const minuteOptions = buildMinuteOptions(minuteStep)
  const nearestMinute =
    minuteOptions.find((option) => option === minutes) ??
    minuteOptions.reduce((best, option) =>
      Math.abs(option - minutes) < Math.abs(best - minutes) ? option : best
    )

  function commit(nextHour12: number, nextPeriod: "AM" | "PM", nextMinutes: number) {
    onChange(toTime24(from12HourParts(nextHour12, nextPeriod), nextMinutes))
  }

  return (
    <div className={cn("flex items-center justify-center gap-2 py-1", className)}>
      <label className="sr-only" htmlFor={`${id}-hour`}>
        Hour
      </label>
      <select
        id={`${id}-hour`}
        className={cn(selectClassName, "w-16")}
        value={hour12}
        onChange={(event) =>
          commit(Number(event.target.value), period, nearestMinute)
        }
      >
        {HOUR_OPTIONS.map((hour) => (
          <option key={hour} value={hour}>
            {String(hour).padStart(2, "0")}
          </option>
        ))}
      </select>

      <span className="text-lg font-medium text-muted-foreground">:</span>

      <label className="sr-only" htmlFor={`${id}-minute`}>
        Minute
      </label>
      <select
        id={`${id}-minute`}
        className={cn(selectClassName, "w-16")}
        value={nearestMinute}
        onChange={(event) =>
          commit(hour12, period, Number(event.target.value))
        }
      >
        {minuteOptions.map((minute) => (
          <option key={minute} value={minute}>
            {String(minute).padStart(2, "0")}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor={`${id}-period`}>
        AM or PM
      </label>
      <select
        id={`${id}-period`}
        className={cn(selectClassName, "w-16")}
        value={period}
        onChange={(event) =>
          commit(hour12, event.target.value as "AM" | "PM", nearestMinute)
        }
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}
