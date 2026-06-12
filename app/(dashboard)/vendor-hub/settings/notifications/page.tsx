import Link from "next/link"

import { ModuleNotificationSettingsClient } from "@/components/notifications/module-notification-settings-client"
import { Button } from "@/components/ui/button"
import { getModuleNotificationSettings } from "@/lib/notifications/module-notification-settings-queries"
import { getNotificationCatalog } from "@/lib/notifications/module-notification-settings-types"
import { PERMISSIONS, requireAnyPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export default async function VendorHubNotificationSettingsPage() {
  await requireAnyPermission(PERMISSIONS.VENDOR_HUB_MANAGE, PERMISSIONS.EVENTS_MANAGE)

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

  const catalog = getNotificationCatalog("vendor_hub")
  const initialSettings = await getModuleNotificationSettings("vendor_hub")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendor notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Control when vendors receive email about bazaar publishing, updates, reminders, and
            cancellations.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={VENDOR_HUB_ROUTES.settings}>Back to Vendor Hub settings</Link>
        </Button>
      </div>
      <ModuleNotificationSettingsClient
        moduleKey="vendor_hub"
        headerTitle="Vendor Hub"
        pageTitle="Vendor notification settings"
        pageDescription="Messages always appear in vendor My Bazaars. Email delivery uses these toggles when a provider is connected."
        initialSettings={initialSettings}
        staffEvents={catalog.staffEvents}
        customerEvents={catalog.customerEvents}
        tablesAvailable={tablesAvailable}
        settingsNav={null}
      />
    </div>
  )
}
