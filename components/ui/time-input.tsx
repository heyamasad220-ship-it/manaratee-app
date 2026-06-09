"use client"

import { useEffect, useState } from "react"
import { Clock3 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  formatTimeDisplay,
  TimePickerSpinner,
} from "@/components/ui/time-picker"

export function TimeInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  className,
  placeholder = "Select time",
  disabled,
  required,
  minuteStep = 1,
}: {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  minuteStep?: number
}) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue ?? value ?? "")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isControlled) {
      setInternalValue(value ?? "")
    }
  }, [isControlled, value])

  const currentValue = isControlled ? (value ?? "") : internalValue

  function commit(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue)
    }
    onChange?.(nextValue)
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-required={required}
            className={cn(
              "border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full items-center rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              !currentValue ? "text-muted-foreground" : "text-foreground",
              className
            )}
          >
            <Clock3 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-left">
              {currentValue ? formatTimeDisplay(currentValue) : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3">
            <TimePickerSpinner
              value={currentValue || "12:00"}
              minuteStep={minuteStep}
              onChange={(nextValue) => {
                commit(nextValue)
              }}
            />
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2">
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => {
                const now = new Date()
                const nextValue = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
                commit(nextValue)
              }}
            >
              Now
            </button>
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => {
                commit("")
                setOpen(false)
              }}
            >
              Clear
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}

/** Read-only styled trigger variant using Input appearance for embedded forms. */
export function TimeInputField(props: React.ComponentProps<typeof TimeInput>) {
  return <TimeInput {...props} className={cn("font-normal", props.className)} />
}
