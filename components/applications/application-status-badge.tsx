import { Badge } from "@/components/ui/badge"
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  isPendingStatus,
} from "@/lib/applications/application-types"
import { cn } from "@/lib/utils"

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const label = APPLICATION_STATUS_LABELS[status] ?? status

  return (
    <Badge
      variant="secondary"
      className={cn(
        status === "approved" && "bg-green-100 text-green-800 hover:bg-green-100",
        status === "rejected" && "bg-red-100 text-red-800 hover:bg-red-100",
        isPendingStatus(status) && "bg-amber-100 text-amber-800 hover:bg-amber-100",
        status === "withdrawn" && "bg-muted text-muted-foreground",
        status === "draft" && "bg-slate-100 text-slate-700 hover:bg-slate-100"
      )}
    >
      {label}
    </Badge>
  )
}
