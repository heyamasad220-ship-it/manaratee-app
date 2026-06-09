import { Header } from "@/components/layout/header"
import { EventsCalendarPageClient } from "@/components/events/calendar/events-calendar-page-client"
import { internalEventsToGridItems } from "@/lib/events/event-calendar-utils"
import { getInternalEvents } from "@/lib/events/internal-event-queries"
import { getCalendarVenues } from "@/lib/reservations/reservation-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementCalendarPage() {
  await requireAnyPermission(PERMISSIONS.EVENTS_VIEW, PERMISSIONS.PROGRAMS_VIEW)

  const [venues, events, canManage] = await Promise.all([
    getCalendarVenues(),
    getInternalEvents(),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
  ])

  return (
    <>
      <Header title="Event Management" />
      <div className="flex flex-col gap-5 p-6">
        <EventsCalendarPageClient
          venues={venues.map((venue) => ({ id: venue.id, name: venue.name }))}
          events={internalEventsToGridItems(events)}
          canManage={canManage}
        />
      </div>
    </>
  )
}
