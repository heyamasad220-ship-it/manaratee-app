import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { VenueRentalDetailClient } from "@/components/bookings/venue-rental-detail-client"
import {
  getRentalPaymentsForRental,
  getVenueRentalDetailRow,
  getVenueRentalQuotedCharges,
} from "@/lib/bookings/venue-rental-queries"
import { getVenueRentalEmployeePricingSuggestion } from "@/lib/bookings/venue-rental-employee-pricing"
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
  const [rental, canManage, canViewFinance] = await Promise.all([
    getVenueRentalDetailRow(id),
    hasAnyPermission(PERMISSIONS.BOOKINGS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
    hasAnyPermission(
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.FINANCE_MANAGE,
      PERMISSIONS.BOOKINGS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    ),
  ])

  if (!rental) {
    notFound()
  }

  const [payments, employeePricing, quotedCharges] = await Promise.all([
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
  ])

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
      />
    </>
  )
}
