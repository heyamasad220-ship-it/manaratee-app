import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { VenueRentalDetailClient } from "@/components/bookings/venue-rental-detail-client"
import {
  getRentalPaymentsForRental,
  getVenueRentalDetailRow,
} from "@/lib/bookings/venue-rental-queries"
import { getVenueRentalEmployeePricingSuggestion } from "@/lib/bookings/venue-rental-employee-pricing"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function VenueRentalDetailPage({ params }: PageProps) {
  await requireAnyPermission(
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const { id } = await params
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

  const [payments, employeePricing] = await Promise.all([
    canViewFinance ? getRentalPaymentsForRental(id) : Promise.resolve([]),
    canManage &&
    rental.status === "awaiting_supervisor_approval"
      ? getVenueRentalEmployeePricingSuggestion(id)
      : Promise.resolve(null),
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
      />
    </>
  )
}
