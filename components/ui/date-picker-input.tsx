"use client"

import { useState } from "react"
import { format, isValid, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function DatePickerInput({
  id,
  value,
  onChange,
  className,
  placeholder = "Select date",
  disabled,
  required,
  min,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  min?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = parseIsoDate(value)
  const minDate = parseIsoDate(min ?? "")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-required={required}
          className={cn(
            "border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate text-left">
            {selected ? format(selected, "EEE d MMM yyyy") : placeholder}
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onChange(date ? toIsoDate(date) : "")
            if (date) setOpen(false)
          }}
          disabled={
            minDate
              ? (candidate) => {
                  const start = new Date(minDate)
                  start.setHours(0, 0, 0, 0)
                  const next = new Date(candidate)
                  next.setHours(0, 0, 0, 0)
                  return next < start
                }
              : undefined
          }
          defaultMonth={selected ?? minDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
