"use client"

import { useEffect, useRef, useState } from "react"
import { Clock3 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  buildTimeOptions,
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
  minuteStep = 5,
  picker = "spinner",
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
  picker?: "spinner" | "list"
}) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue ?? value ?? "")
  const [open, setOpen] = useState(false)
  const selectedOptionRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (isControlled) {
      setInternalValue(value ?? "")
    }
  }, [isControlled, value])

  const currentValue = isControlled ? (value ?? "") : internalValue
  const timeOptions = picker === "list" ? buildTimeOptions(minuteStep) : []

  function commit(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue)
    }
    onChange?.(nextValue)
  }

  useEffect(() => {
    if (!open || picker !== "list") return
    const selected = selectedOptionRef.current
    const list = selected?.parentElement
    if (!selected || !list) return
    list.scrollTop =
      selected.offsetTop - list.clientHeight / 2 + selected.offsetHeight / 2
  }, [open, picker, currentValue])

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
              picker === "list" ? "justify-between gap-2" : "",
              !currentValue ? "text-muted-foreground" : "text-foreground",
              className
            )}
          >
            {picker === "list" ? (
              <>
                <span className="truncate text-left">
                  {currentValue ? formatTimeDisplay(currentValue) : placeholder}
                </span>
                <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            ) : (
              <>
                <Clock3 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-left">
                  {currentValue ? formatTimeDisplay(currentValue) : placeholder}
                </span>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className={cn("p-0", picker === "list" ? "w-[var(--radix-popover-trigger-width)]" : "w-auto")}
          align="start"
        >
          {picker === "list" ? (
            <div className="max-h-60 overflow-y-auto py-1">
              {timeOptions.map((option) => {
                const selected = option === currentValue
                return (
                  <button
                    key={option}
                    type="button"
                    ref={selected ? selectedOptionRef : undefined}
                    className={cn(
                      "flex w-full px-3 py-1.5 text-left text-sm hover:bg-accent",
                      selected && "bg-primary text-primary-foreground hover:bg-primary"
                    )}
                    onClick={() => {
                      commit(option)
                      setOpen(false)
                    }}
                  >
                    {formatTimeDisplay(option)}
                  </button>
                )
              })}
            </div>
          ) : (
            <>
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
            </>
          )}
        </PopoverContent>
      </Popover>
    </>
  )
}

/** Read-only styled trigger variant using Input appearance for embedded forms. */
export function TimeInputField(props: React.ComponentProps<typeof TimeInput>) {
  return <TimeInput {...props} className={cn("font-normal", props.className)} />
}
