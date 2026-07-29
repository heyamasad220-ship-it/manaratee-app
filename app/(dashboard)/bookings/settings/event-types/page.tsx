import { VenueRentalEventTypesClient } from "@/components/bookings/venue-rental-event-types-client"
import { getVenueRentalEventTypes } from "@/lib/bookings/venue-rental-event-type-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function VenueRentalEventTypesSettingsPage() {
  await requireAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const venueRentalEventTypes = await getVenueRentalEventTypes()

  return (
    <VenueRentalEventTypesClient venueRentalEventTypes={venueRentalEventTypes} />
  )
}
