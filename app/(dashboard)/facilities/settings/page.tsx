import { Header } from "@/components/layout/header"
import { FacilitiesSettingsNav } from "@/components/bookings/bookings-settings-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function BookingsModuleSettingsPage() {
  await requireAnyPermission(
    PERMISSIONS.SPACES_VIEW,
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.PROGRAMS_VIEW
  )

  return (
    <>
      <Header title="Facilities" />
      <div className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure spaces and facility options for your organization.
          </p>
        </div>

        <FacilitiesSettingsNav />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facilities settings</CardTitle>
            <CardDescription>
              Use the Spaces tab to manage venues, capacity, pricing, and availability
              used across calendars.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Additional bookings configuration options will appear here as they are
              added.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
