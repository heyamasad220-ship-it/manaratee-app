import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  getEventListDisplayStatus,
  getEventListDisplayStatusLabel,
  type InternalEventStatus,
} from "@/lib/events/internal-event-status"

const statusStyles = {
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  published: "bg-emerald-100 text-emerald-700 border-emerald-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
} as const

export function InternalEventDbStatusBadge({
  status,
  startAt = null,
  endAt = null,
}: {
  status: InternalEventStatus
  startAt?: string | null
  endAt?: string | null
}) {
  const event = { status, start_at: startAt, end_at: endAt }
  const displayStatus = getEventListDisplayStatus(event)

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", statusStyles[displayStatus])}
    >
      {getEventListDisplayStatusLabel(event)}
    </Badge>
  )
}
