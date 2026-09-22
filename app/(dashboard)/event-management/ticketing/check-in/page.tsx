import { TicketingCheckInClient } from "@/components/tickets/ticketing-check-in-client"
import {
  EVENT_CHECKIN_PERMISSIONS,
  hasEventCheckInPermission,
} from "@/lib/events/event-access"
import { getTicketedEventsOverview } from "@/lib/tickets/ticketing-overview-queries"
import { PERMISSIONS, requireAnyPermission } from "@/lib/permissions/permissions"

export default async function EventManagementTicketingCheckInPage() {
  await requireAnyPermission(
    ...EVENT_CHECKIN_PERMISSIONS,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.PROGRAMS_VIEW
  )

  const [events, canCheckIn] = await Promise.all([
    getTicketedEventsOverview(),
    hasEventCheckInPermission(),
  ])

  return (
    <div className="p-6">
      <TicketingCheckInClient events={events} canCheckIn={canCheckIn} />
    </div>
  )
}
