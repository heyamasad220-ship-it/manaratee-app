import { Header } from "@/components/layout/header"
import { VenueRentalRequestsQueue } from "@/components/bookings/venue-rental-requests-queue"
import { getVenuesWithStats } from "@/lib/bookings/venue-queries"
import {
  getActiveRentalAddons,
  getVenueRentalDashboardStats,
  getVenueRentalQueueRows,
} from "@/lib/bookings/venue-rental-queries"
import {
  completePastConfirmedVenueRentals,
  reconcileApprovedVenueRentalsWithPayments,
} from "@/lib/bookings/venue-rental-actions"
import { getVenueRentalEventTypes } from "@/lib/bookings/venue-rental-event-type-queries"
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

  // Keep Completed in sync when staff open the queue (cron also runs hourly).
  await completePastConfirmedVenueRentals()
  // Approved + payment already on ledger → Confirmed (repairs stuck rows).
  await reconcileApprovedVenueRentalsWithPayments()

  const [rows, canManage, venuesWithStats, eventTypes, setupStyles, addons] =
    await Promise.all([
      getVenueRentalQueueRows(),
      hasAnyPermission(PERMISSIONS.BOOKINGS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
      getVenuesWithStats(),
      getVenueRentalEventTypes({ activeOnly: true }),
      getRoomSetupStyles({ activeOnly: true }),
      getActiveRentalAddons(),
    ])

  const stats = getVenueRentalDashboardStats(rows)
  const venues = venuesWithStats
    .filter((venue) => venue.available_for_bookings && venue.status === "active")
    .map((venue) => ({
      id: venue.id,
      name: venue.name,
      hourlyRate: venue.hourly_rate,
      peakHourlyRate: venue.peak_hourly_rate,
      basePrice: venue.base_price,
      peakFlatPrice: venue.peak_flat_price,
      dayHourlyRates: venue.daySchedule
        .filter((day) => day.open)
        .map((day) => ({
          dayOfWeek: day.dayOfWeek,
          hourlyPrice: Number(day.hourlyPrice) || 0,
        })),
      dayFlatRates: venue.daySchedule
        .filter((day) => day.open)
        .map((day) => ({
          dayOfWeek: day.dayOfWeek,
          flatPrice: Number(day.flatPrice) || 0,
        })),
    }))

  return (
    <>
      <Header title="Venue Rentals" />
      <VenueRentalRequestsQueue
        rows={rows}
        stats={stats}
        canManage={canManage}
        title="Requests"
        defaultStatusFilter="all"
        venues={venues}
        eventTypes={eventTypes.map((eventType) => ({
          id: eventType.id,
          name: eventType.name,
        }))}
        setupStyles={setupStyles}
        addons={addons}
      />
    </>
  )
}
