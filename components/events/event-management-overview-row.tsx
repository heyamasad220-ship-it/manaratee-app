"use client"

import { useRouter } from "next/navigation"

import { TableCell, TableRow } from "@/components/ui/table"
import { formatEventDate, formatEventTimeRange } from "@/lib/events/internal-event-format"
import {
  formatInternalEventSpaceLabel,
  getInternalEventLocationTypeLabel,
} from "@/lib/events/internal-event-location"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"

export function EventManagementOverviewRow({
  event,
}: {
  event: InternalEventWithRelations
}) {
  const router = useRouter()
  const href = `/event-management/${event.id}`

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/40"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(eventKey) => {
        if (eventKey.key === "Enter" || eventKey.key === " ") {
          eventKey.preventDefault()
          router.push(href)
        }
      }}
    >
      <TableCell className="font-medium">{event.name}</TableCell>
      <TableCell className="text-muted-foreground">
        {getInternalEventLocationTypeLabel(event, { short: true })}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatEventDate(event.start_at)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatEventTimeRange(event.start_at, event.end_at)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatInternalEventSpaceLabel(event)}
      </TableCell>
    </TableRow>
  )
}
