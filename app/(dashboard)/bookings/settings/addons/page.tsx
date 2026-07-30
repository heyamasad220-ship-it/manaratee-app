import { VenueRentalAddonsClient } from "@/components/bookings/venue-rental-addons-client"
import { getRentalAddonsForSettings } from "@/lib/bookings/venue-rental-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function VenueRentalAddonsSettingsPage() {
  await requireAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const addons = await getRentalAddonsForSettings()

  return <VenueRentalAddonsClient addons={addons} />
}
