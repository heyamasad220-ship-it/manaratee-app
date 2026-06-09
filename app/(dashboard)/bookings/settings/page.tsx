import { Header } from "@/components/layout/header"
import Link from "next/link"
import { VenueRentalsSettingsNav } from "@/components/bookings/venue-rentals-settings-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function BookingsSettingsPage() {
  await requireAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  return (
    <>
      <Header title="Venue Rentals" />
      <div className="flex flex-col gap-5 p-6">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure venue rental options for your organization.
          </p>
        </div>

        <VenueRentalsSettingsNav />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Venue rental settings</CardTitle>
            <CardDescription>
              Use the Event Types tab to manage wedding, party, and other categories
              customers choose when booking a venue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Additional venue rental configuration options will appear here as they
              are added.
            </p>
            <Button variant="outline" asChild>
              <Link href="/facilities/reservation-center">View reservation center</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
