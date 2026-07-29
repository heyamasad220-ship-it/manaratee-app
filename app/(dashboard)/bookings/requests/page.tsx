import { Header } from "@/components/layout/header"
import { VenueRentalRequestsQueue } from "@/components/bookings/venue-rental-requests-queue"
import { getBookableVenues } from "@/lib/bookings/venue-queries"
import { getVenueRentalEventTypes } from "@/lib/bookings/venue-rental-event-type-queries"
import {
  getVenueRentalDashboardStats,
  getVenueRentalQueueRows,
} from "@/lib/bookings/venue-rental-queries"
import { getRoomSetupStyles } from "@/lib/setup-styles/setup-style-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function BookingsRequestsPage() {
  await requireAnyPermission(
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const [rows, canManage, venues, eventTypes, setupStyles] = await Promise.all([
    getVenueRentalQueueRows(),
    hasAnyPermission(PERMISSIONS.BOOKINGS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
    getBookableVenues(),
    getVenueRentalEventTypes({ activeOnly: true }),
    getRoomSetupStyles({ activeOnly: true }),
  ])

  const stats = getVenueRentalDashboardStats(rows)

  return (
    <>
      <Header title="Venue Rentals" />
      <VenueRentalRequestsQueue
        rows={rows}
        stats={stats}
        canManage={canManage}
        title="Requests"
        defaultStatusFilter="all"
        venues={venues.map((venue) => ({ id: venue.id, name: venue.name }))}
        eventTypes={eventTypes.map((eventType) => ({
          id: eventType.id,
          name: eventType.name,
        }))}
        setupStyles={setupStyles}
      />
    </>
  )
}
