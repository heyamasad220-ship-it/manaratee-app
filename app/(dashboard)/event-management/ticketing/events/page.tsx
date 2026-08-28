import { TicketingEventsClient } from "@/components/tickets/ticketing-events-client"
import { getTicketingEventCategories } from "@/lib/tickets/ticketing-event-category-queries"
import { getTicketedEventsOverview } from "@/lib/tickets/ticketing-overview-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementTicketingEventsPage() {
  await requireAnyPermission(PERMISSIONS.EVENTS_VIEW, PERMISSIONS.PROGRAMS_VIEW)

  const [events, categories, canManage] = await Promise.all([
    getTicketedEventsOverview(),
    getTicketingEventCategories(),
    hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE,
      PERMISSIONS.TICKETING_MANAGE
    ),
  ])

  return (
    <div className="p-6">
      <TicketingEventsClient
        events={events}
        categories={categories}
        canManage={canManage}
      />
    </div>
  )
}
