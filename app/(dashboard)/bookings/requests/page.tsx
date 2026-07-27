import { Header } from "@/components/layout/header"
import { VenueRentalRequestsQueue } from "@/components/bookings/venue-rental-requests-queue"
import {
  getVenueRentalDashboardStats,
  getVenueRentalQueueRows,
} from "@/lib/bookings/venue-rental-queries"
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

  const [rows, canManage] = await Promise.all([
    getVenueRentalQueueRows(),
    hasAnyPermission(PERMISSIONS.BOOKINGS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
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
      />
    </>
  )
}
