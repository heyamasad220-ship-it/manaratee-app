import { Header } from "@/components/layout/header"
import { VenueRentalUpcomingDashboard } from "@/components/bookings/venue-rental-upcoming-dashboard"
import {
  getVenueRentalPaymentReportRows,
  getVenueRentalQueueRows,
} from "@/lib/bookings/venue-rental-queries"
import { completePastConfirmedVenueRentals } from "@/lib/bookings/venue-rental-actions"
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

  await completePastConfirmedVenueRentals()

  const [rows, paymentRows, canManage] = await Promise.all([
    getVenueRentalQueueRows({ skipConflictCheck: true }),
    getVenueRentalPaymentReportRows(),
    hasAnyPermission(PERMISSIONS.BOOKINGS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
  ])

  return (
    <>
      <Header title="Venue Rentals" />
      <VenueRentalUpcomingDashboard
        rows={rows}
        paymentRows={paymentRows}
        canManage={canManage}
      />
    </>
  )
}
