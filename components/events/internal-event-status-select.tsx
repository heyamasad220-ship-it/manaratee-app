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
  fromWorkspaceEventStatus,
  getInternalEventWorkspaceStatusLabel,
  getInternalEventWorkspaceStatusOptions,
  toWorkspaceEventStatus,
  type InternalEventStatus,
  type InternalEventWorkspaceStatus,
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
  const options = getInternalEventWorkspaceStatusOptions()
  const workspaceStatus = toWorkspaceEventStatus(status)

  function handleChange(nextStatus: string) {
    startTransition(async () => {
      try {
        await updateInternalEventStatus(
          eventId,
          fromWorkspaceEventStatus(nextStatus as InternalEventWorkspaceStatus)
        )
      } catch (error) {
        console.error(error)
        window.alert(
          error instanceof Error ? error.message : "Failed to update status"
        )
      }
    })
  }

  return (
    <Select
      value={workspaceStatus}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="h-8 w-[130px]">
        <SelectValue>
          {getInternalEventWorkspaceStatusLabel(status)}
        </SelectValue>
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
