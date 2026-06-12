"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useVendorHubEvent } from "@/components/vendor-hub/vendor-hub-event-provider"

export function VendorHubEventSelector({ className }: { className?: string }) {
  const { events, selectedEventId, setSelectedEventId } = useVendorHubEvent()

  if (events.length === 0) {
    return (
      <Badge variant="outline" className="border-dashed text-muted-foreground">
        No vendor events yet
      </Badge>
    )
  }

  return (
    <div className={className}>
      <Select value={selectedEventId} onValueChange={setSelectedEventId}>
        <SelectTrigger className="w-full min-w-[240px] max-w-[320px]">
          <SelectValue placeholder="Select event" />
        </SelectTrigger>
        <SelectContent>
          {events.map((event) => (
            <SelectItem key={event.id} value={event.id}>
              {event.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
