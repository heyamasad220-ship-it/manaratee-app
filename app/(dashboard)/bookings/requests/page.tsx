import { Header } from "@/components/layout/header"
import { VenueRentalRequestsQueue } from "@/components/bookings/venue-rental-requests-queue"
import {
  getVenueRentalDashboardStats,
  getVenueRentalQueueRows,
} from "@/lib/bookings/venue-rental-queries"
import { VENUE_RENTAL_STATUSES } from "@/lib/bookings/venue-rental-types"
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
    getVenueRentalQueueRows({
      statuses: [
        VENUE_RENTAL_STATUSES.awaitingSupervisorApproval,
        VENUE_RENTAL_STATUSES.approvedPendingPayment,
        VENUE_RENTAL_STATUSES.depositPaid,
        VENUE_RENTAL_STATUSES.securityDepositPaid,
        VENUE_RENTAL_STATUSES.confirmed,
        VENUE_RENTAL_STATUSES.declined,
        VENUE_RENTAL_STATUSES.holdExpired,
      ],
    }),
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
        description="Real venue rental requests awaiting supervisor review, payment, or follow-up."
        defaultStatusFilter="awaiting_approval"
      />
    </>
  )
}
