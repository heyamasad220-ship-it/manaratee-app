import { notFound } from "next/navigation"

import { CustomerRentalDetailView } from "@/components/customer/rentals/customer-rental-detail-view"
import { getCustomerVenueRentalDetail } from "@/lib/bookings/customer-venue-rental-queries"
import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function CustomerVenueRentalDetailPage({ params }: PageProps) {
  const { id } = await params
  const { userId, organizationId } = await requireCustomerPortalPageContext()

  const detail = await getCustomerVenueRentalDetail(id, userId, organizationId)

  if (!detail) {
    notFound()
  }

  return <CustomerRentalDetailView detail={detail} />
}
