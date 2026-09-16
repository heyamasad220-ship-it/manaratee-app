"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getInternalEventStatusMenuLabel,
  getInternalEventStatusMenuOptions,
  toInternalEventStatusMenuValue,
  type InternalEventStatus,
  type InternalEventStatusMenuValue,
} from "@/lib/events/internal-event-status"
import { setInternalEventStatusFromMenu } from "@/lib/events/internal-event-actions"

export function InternalEventStatusSelect({
  eventId,
  status,
}: {
  eventId: string
  status: InternalEventStatus
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const options = getInternalEventStatusMenuOptions()
  const menuValue = toInternalEventStatusMenuValue(status)

  function handleChange(nextStatus: string) {
    startTransition(async () => {
      try {
        await setInternalEventStatusFromMenu(
          eventId,
          nextStatus as InternalEventStatusMenuValue
        )
        router.refresh()
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
      value={menuValue}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="h-8 w-[150px]">
        <SelectValue>{getInternalEventStatusMenuLabel(status)}</SelectValue>
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
