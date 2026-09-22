import { TicketingOverviewTable } from "@/components/tickets/ticketing-overview-table"
import { getTicketedEventsOverview } from "@/lib/tickets/ticketing-overview-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementTicketingOverviewPage() {
  await requireAnyPermission(
    PERMISSIONS.TICKETING_VIEW,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.PROGRAMS_VIEW
  )

  const [events, canManage] = await Promise.all([
    getTicketedEventsOverview(),
    hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE,
      PERMISSIONS.TICKETING_MANAGE
    ),
  ])

  return (
    <div className="p-6">
      <TicketingOverviewTable events={events} canManage={canManage} />
    </div>
  )
}
