import { redirect } from "next/navigation"

export default async function CustomerBookVenueRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ venueId?: string }>
}) {
  const params = await searchParams
  const venueId = params?.venueId
  redirect(venueId ? `/customer/rentals/new?venueId=${venueId}` : "/customer/rentals/new")
}
