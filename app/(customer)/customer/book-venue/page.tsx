import Link from "next/link"
import { redirect } from "next/navigation"
import { Building2, CalendarDays, Search, Users } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { CustomerTabs } from "@/components/customer/customer-tabs"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type VenueRow = {
  id: string
  name?: string | null
  title?: string | null
  description?: string | null
  capacity?: number | null
  max_capacity?: number | null
  status?: string | null
  organization_id?: string | null
}

export default async function BookVenuePage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string
    guests?: string
  }>
}) {
  const params = await searchParams

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
  const searchQuery = params?.q?.trim() || ""
  const guestCount = Number(params?.guests || 0)

  let query = supabase
    .from("venues")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (searchQuery) {
    query = query.ilike("name", `%${searchQuery}%`)
  }

  const { data: venues, error } = await query

  const filteredVenues = ((venues || []) as VenueRow[]).filter((venue) => {
    const capacity = venue.capacity || venue.max_capacity || 0

    if (!guestCount) {
      return true
    }

    return capacity >= guestCount
  })

  return (
    <div className="space-y-6">
      <CustomerTabs />

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {activeOrganization.organization_name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Book a Venue</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse available venues for this organization and start a booking
            request.
          </p>
        </div>
      </section>

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={searchQuery}
                placeholder="Search venues..."
                className="pl-9"
              />
            </div>

            <Input
              name="guests"
              defaultValue={guestCount || ""}
              type="number"
              min="1"
              placeholder="Guest count"
            />

            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-destructive">
              Could not load venues.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Check that your Supabase table is named <strong>venues</strong>{" "}
              and has an <strong>organization_id</strong> column.
            </p>
          </CardContent>
        </Card>
      )}

      {!error && filteredVenues.length === 0 && (
        <Card>
          <CardContent className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">No venues found</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              There are no venues available for this organization yet.
            </p>
          </CardContent>
        </Card>
      )}

      {!error && filteredVenues.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {filteredVenues.map((venue) => {
            const venueName = venue.name || venue.title || "Untitled Venue"
            const capacity = venue.capacity || venue.max_capacity || null

            return (
              <Card key={venue.id} className="overflow-hidden">
                <div className="flex h-36 items-center justify-center bg-muted">
                  <Building2 className="h-14 w-14 text-muted-foreground/40" />
                </div>

                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg">{venueName}</CardTitle>

                    {venue.status && (
                      <Badge variant="secondary">{venue.status}</Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="min-h-[44px] text-sm text-muted-foreground">
                    {venue.description || "No description has been added yet."}
                  </p>

                  {capacity && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Up to {capacity} guests
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="flex-1" asChild>
                      <Link
                        href={`/customer/venue-availability?venueId=${venue.id}`}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Check Availability
                      </Link>
                    </Button>

                    <Button variant="outline" className="flex-1" asChild>
                      <Link href={`/customer/bookings/new?venueId=${venue.id}`}>
                        Start Request
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}
    </div>
  )
}