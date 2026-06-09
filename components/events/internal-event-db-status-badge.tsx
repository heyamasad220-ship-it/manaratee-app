import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  getInternalEventStatusLabel,
  type InternalEventStatus,
} from "@/lib/events/internal-event-status"

const statusStyles: Record<InternalEventStatus, string> = {
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  scheduled: "bg-violet-100 text-violet-700 border-violet-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
}

export function InternalEventDbStatusBadge({
  status,
}: {
  status: InternalEventStatus
}) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", statusStyles[status])}
    >
      {getInternalEventStatusLabel(status)}
    </Badge>
  )
}
