import { Header } from "@/components/layout/header"
import { VenueRentalGeneralClient } from "@/components/bookings/venue-rental-general-client"
import { getVenueRentalOrgSettings } from "@/lib/bookings/venue-rental-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function VenueRentalGeneralSettingsPage() {
  await requireAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const [settings, canManage] = await Promise.all([
    getVenueRentalOrgSettings(),
    hasAnyPermission(PERMISSIONS.BOOKINGS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
  ])

  return (
    <>
      <Header title="Venue Rentals" />
      <VenueRentalGeneralClient settings={settings} canManage={canManage} />
    </>
  )
}
