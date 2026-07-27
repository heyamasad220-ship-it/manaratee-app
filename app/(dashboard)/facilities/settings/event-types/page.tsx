import { VenueRentalEventTypesClient } from "@/components/bookings/venue-rental-event-types-client"
import { getVenueRentalEventTypes } from "@/lib/bookings/venue-rental-event-type-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function FacilitiesEventTypesSettingsPage() {
  await requireAnyPermission(
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.SPACES_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const venueRentalEventTypes = await getVenueRentalEventTypes()

  return (
    <VenueRentalEventTypesClient venueRentalEventTypes={venueRentalEventTypes} />
  )
}
