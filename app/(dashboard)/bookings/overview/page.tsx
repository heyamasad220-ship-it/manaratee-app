import { Header } from "@/components/layout/header"
import { VenueRentalRequestsQueue } from "@/components/bookings/venue-rental-requests-queue"
import { VenueRentalTransitionReportPanel } from "@/components/bookings/venue-rental-transition-report-panel"
import {
  getVenueRentalDashboardStats,
  getVenueRentalQueueRows,
} from "@/lib/bookings/venue-rental-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function BookingsDashboardPage() {
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
      <div className="space-y-6">
        {canManage ? (
          <div className="px-4 sm:px-6 pt-4 sm:pt-6">
            <VenueRentalTransitionReportPanel />
          </div>
        ) : null}
        <VenueRentalRequestsQueue
          rows={rows}
          stats={stats}
          canManage={canManage}
          title="Dashboard"
          description="Monitor venue rental requests, payments, and conflicts."
        />
      </div>
    </>
  )
}
