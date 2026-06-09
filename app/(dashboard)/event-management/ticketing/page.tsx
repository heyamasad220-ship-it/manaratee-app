import { TicketingOverviewTable } from "@/components/tickets/ticketing-overview-table"
import { getTicketedEventsOverview } from "@/lib/tickets/ticketing-overview-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementTicketingOverviewPage() {
  await requireAnyPermission(PERMISSIONS.EVENTS_VIEW, PERMISSIONS.PROGRAMS_VIEW)

  const [events, canManage] = await Promise.all([
    getTicketedEventsOverview(),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
  ])

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground">
          Ticket sales and capacity for each ticketed event.
        </p>
      </div>
      <TicketingOverviewTable events={events} canManage={canManage} />
    </div>
  )
}
