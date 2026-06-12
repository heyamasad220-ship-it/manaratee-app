import { ModuleNotificationSettingsClient } from "@/components/notifications/module-notification-settings-client"
import { VenueRentalsSettingsNav } from "@/components/bookings/venue-rentals-settings-nav"
import { getModuleNotificationSettings } from "@/lib/notifications/module-notification-settings-queries"
import {
  getNotificationCatalog,
} from "@/lib/notifications/module-notification-settings-types"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

export default async function VenueRentalNotificationSettingsPage() {
  await requireAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const organizationId = await resolveOrganizationId()
  const supabase = await createClient()

  let tablesAvailable = true
  if (organizationId) {
    const probe = await supabase
      .from("module_notification_settings")
      .select("id")
      .eq("organization_id", organizationId)
      .limit(1)

    if (probe.error?.code === "42P01" || probe.error?.code === "PGRST204") {
      tablesAvailable = false
    }
  }

  const catalog = getNotificationCatalog("venue_rentals")
  const initialSettings = await getModuleNotificationSettings("venue_rentals")

  return (
    <ModuleNotificationSettingsClient
      moduleKey="venue_rentals"
      headerTitle="Venue Rentals"
      pageTitle="Notification settings"
      pageDescription="Choose when staff and customers receive email updates about venue rental requests."
      settingsNav={<VenueRentalsSettingsNav />}
      initialSettings={initialSettings}
      staffEvents={catalog.staffEvents}
      customerEvents={catalog.customerEvents}
      tablesAvailable={tablesAvailable}
    />
  )
}
