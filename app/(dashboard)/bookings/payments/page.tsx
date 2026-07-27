import { Header } from "@/components/layout/header"
import { VenueRentalPaymentsReport } from "@/components/bookings/venue-rental-payments-report"
import { getVenueRentalPaymentReportRows } from "@/lib/bookings/venue-rental-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function VenueRentalPaymentsPage() {
  await requireAnyPermission(
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_MANAGE,
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const [rows, canManage] = await Promise.all([
    getVenueRentalPaymentReportRows(),
    hasAnyPermission(PERMISSIONS.BOOKINGS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
  ])

  return (
    <>
      <Header title="Venue Rentals" />
      <VenueRentalPaymentsReport rows={rows} canManage={canManage} />
    </>
  )
}
