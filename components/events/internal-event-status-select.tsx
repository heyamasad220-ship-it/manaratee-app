"use client"

import { useTransition } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getInternalEventStatusLabel,
  getInternalEventStatusOptions,
  type InternalEventStatus,
} from "@/lib/events/internal-event-status"
import { updateInternalEventStatus } from "@/lib/events/internal-event-actions"

export function InternalEventStatusSelect({
  eventId,
  status,
}: {
  eventId: string
  status: InternalEventStatus
}) {
  const [isPending, startTransition] = useTransition()
  const options = getInternalEventStatusOptions()

  function handleChange(nextStatus: string) {
    startTransition(async () => {
      try {
        await updateInternalEventStatus(eventId, nextStatus as InternalEventStatus)
      } catch (error) {
        console.error(error)
        window.alert(
          error instanceof Error ? error.message : "Failed to update status"
        )
      }
    })
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="h-8 w-[130px]">
        <SelectValue>{getInternalEventStatusLabel(status)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
