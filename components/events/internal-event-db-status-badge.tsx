import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  getInternalEventWorkspaceStatusLabel,
  toWorkspaceEventStatus,
  type InternalEventStatus,
} from "@/lib/events/internal-event-status"

const statusStyles = {
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  published: "bg-emerald-100 text-emerald-700 border-emerald-200",
} as const

export function InternalEventDbStatusBadge({
  status,
}: {
  status: InternalEventStatus
}) {
  const workspaceStatus = toWorkspaceEventStatus(status)

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", statusStyles[workspaceStatus])}
    >
      {getInternalEventWorkspaceStatusLabel(status)}
    </Badge>
  )
}
