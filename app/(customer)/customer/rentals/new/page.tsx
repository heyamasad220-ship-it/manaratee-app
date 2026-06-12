import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { CustomerVenueRentalCalendar } from "@/components/customer/customer-venue-rental-calendar"
import { Button } from "@/components/ui/button"
import { getVenueRentalEventTypes } from "@/lib/bookings/venue-rental-event-type-queries"
import {
  getActiveRentalAddons,
  getPublicAvailabilityBlocks,
} from "@/lib/bookings/venue-rental-queries"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"

export default async function CustomerVenueRentalRequestPage({
  searchParams,
}: {
  searchParams?: Promise<{ venueId?: string }>
}) {
  const params = await searchParams
  const initialVenueId = params?.venueId

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    redirect("/login")
  }

  const organizationId = activeOrganization.organization_id
  const rangeStart = new Date()
  rangeStart.setDate(rangeStart.getDate() - 7)
  const rangeEnd = new Date()
  rangeEnd.setDate(rangeEnd.getDate() + 60)

  const [venuesResult, availabilityBlocks, eventTypes, addons] = await Promise.all([
    supabase
      .from("venues")
      .select("id, name, description, capacity, status, available_for_bookings, usage_tag")
      .eq("organization_id", organizationId)
      .eq("available_for_bookings", true)
      .in("status", ["active", "closed", "inactive"])
      .order("name", { ascending: true }),
    getPublicAvailabilityBlocks(
      organizationId,
      rangeStart.toISOString(),
      rangeEnd.toISOString()
    ),
    getVenueRentalEventTypes({
      organizationId,
      activeOnly: true,
    }),
    getActiveRentalAddons(organizationId),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link href="/customer/rentals">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Venue Rentals
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Book a Space</h1>
          <p className="text-sm text-muted-foreground">
            Check availability for bookable spaces, choose your time, then submit your rental request.
          </p>
        </div>
      </div>

      <CustomerVenueRentalCalendar
        organizationName={activeOrganization.organization_name}
        venues={venuesResult.data || []}
        availabilityBlocks={availabilityBlocks}
        eventTypes={eventTypes.map((eventType) => ({
          id: eventType.id,
          name: eventType.name,
        }))}
        addons={addons}
        initialVenueId={initialVenueId}
        dashboardHref="/customer/rentals"
      />
    </div>
  )
}
