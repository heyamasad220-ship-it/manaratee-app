"use client"

import { useState } from "react"
import { format, isValid, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const MIN_BIRTH_DATE = new Date("1900-01-01T00:00:00")

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined

  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function BirthDateInput({
  id,
  value,
  onChange,
  className,
  placeholder = "Select date of birth",
  disabled,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = parseIsoDate(value)
  const maxDate = new Date()
  maxDate.setHours(0, 0, 0, 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "MMMM d, yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onChange(date ? toIsoDate(date) : "")
            if (date) setOpen(false)
          }}
          disabled={(date) => date > maxDate || date < MIN_BIRTH_DATE}
          defaultMonth={selected ?? maxDate}
          initialFocus
          captionLayout="dropdown"
          startMonth={MIN_BIRTH_DATE}
          endMonth={maxDate}
        />
      </PopoverContent>
    </Popover>
  )
}
