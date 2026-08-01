import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { VenueRentalDetailClient } from "@/components/bookings/venue-rental-detail-client"
import { getVenuesWithStats } from "@/lib/bookings/venue-queries"
import { reconcileVenueRentalStatusFromPayments } from "@/lib/bookings/venue-rental-actions"
import {
  getActiveRentalAddons,
  getRentalPaymentsForRental,
  getVenueRentalDetailRow,
  getVenueRentalOrgSettings,
  getVenueRentalQuotedCharges,
} from "@/lib/bookings/venue-rental-queries"
import { getVenueRentalEmployeePricingSuggestion } from "@/lib/bookings/venue-rental-employee-pricing"
import { getVenueRentalEventTypes } from "@/lib/bookings/venue-rental-event-type-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; action?: string; from?: string }>
}

export default async function VenueRentalDetailPage({
  params,
  searchParams,
}: PageProps) {
  await requireAnyPermission(
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const { id } = await params
  const query = await searchParams
  const [rentalRow, canManage, canViewFinance] = await Promise.all([
    getVenueRentalDetailRow(id),
    hasAnyPermission(PERMISSIONS.BOOKINGS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
    hasAnyPermission(
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.FINANCE_MANAGE,
      PERMISSIONS.BOOKINGS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    ),
  ])

  let rental = rentalRow

  if (!rental) {
    notFound()
  }

  // Repair: Approved + booking payment already on ledger → Confirmed
  // (payments recorded as Final Payment / Installment before the sync fix).
  if (canManage && rental.status === "approved_pending_payment") {
    const reconciled = await reconcileVenueRentalStatusFromPayments(id)
    if (reconciled.updated) {
      rental = (await getVenueRentalDetailRow(id)) ?? rental
    }
  }

  const [
    payments,
    employeePricing,
    quotedCharges,
    venuesWithStats,
    eventTypes,
    addons,
    orgSettings,
  ] = await Promise.all([
      canViewFinance ? getRentalPaymentsForRental(id) : Promise.resolve([]),
      canManage &&
      rental.status === "awaiting_supervisor_approval"
        ? getVenueRentalEmployeePricingSuggestion(id)
        : Promise.resolve(null),
      canViewFinance
        ? getVenueRentalQuotedCharges(rental)
        : Promise.resolve({
            spaceFee: 0,
            addonFees: 0,
            totalCharges: 0,
            hours: 0,
          }),
      canManage ? getVenuesWithStats() : Promise.resolve([]),
      canManage
        ? getVenueRentalEventTypes({ activeOnly: true })
        : Promise.resolve([]),
      canViewFinance || canManage
        ? getActiveRentalAddons()
        : Promise.resolve([]),
      getVenueRentalOrgSettings(),
    ])

  const venues = venuesWithStats
    .filter((venue) => venue.available_for_bookings && venue.status === "active")
    .map((venue) => ({
      id: venue.id,
      name: venue.name,
    }))

  return (
    <>
      <Header title="Venue Rentals" />
      <VenueRentalDetailClient
        rental={rental}
        payments={payments}
        canManage={canManage}
        canViewFinance={canViewFinance}
        employeePricing={employeePricing}
        financialAction={query.action ?? null}
        from={query.from ?? null}
        quotedCharges={quotedCharges}
        venues={venues}
        eventTypes={eventTypes.map((eventType) => ({
          id: eventType.id,
          name: eventType.name,
        }))}
        addons={addons}
        orgSettings={orgSettings}
      />
    </>
  )
}
