import { redirect } from "next/navigation"

import { guardCustomerPortalPath } from "@/lib/customer/customer-portal-modules-server"

export default async function CustomerVenueAvailabilityRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ venueId?: string }>
}) {
  await guardCustomerPortalPath("/customer/venue-availability")
  const params = await searchParams
  const venueId = params?.venueId
  redirect(venueId ? `/customer/rentals/new?venueId=${venueId}` : "/customer/rentals/new")
}
