import { SpacesSettingsClient } from "@/components/bookings/settings/spaces-settings-client"
import {
  getVenuesWithStats,
  venueCatalogSupportsUsageTags,
} from "@/lib/bookings/venue-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function BookingsSpacesSettingsPage() {
  await requireAnyPermission(
    PERMISSIONS.SPACES_VIEW,
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.PROGRAMS_VIEW
  )

  const [venues, canManage, supportsUsageTags] = await Promise.all([
    getVenuesWithStats(),
    hasAnyPermission(
      PERMISSIONS.SPACES_MANAGE,
      PERMISSIONS.BOOKINGS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    ),
    venueCatalogSupportsUsageTags(),
  ])

  return (
    <SpacesSettingsClient
      venues={venues}
      canManage={canManage}
      supportsUsageTags={supportsUsageTags}
    />
  )
}
