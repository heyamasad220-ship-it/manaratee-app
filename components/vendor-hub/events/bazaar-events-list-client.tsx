"use client"

import Link from "next/link"
import { useState } from "react"
import { Calendar, MapPin, Plus, Store, Users } from "lucide-react"

import { CreateBazaarEventDrawer } from "@/components/bazaar/create-bazaar-event-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyBazaarEventButton } from "@/components/vendor-hub/events/copy-bazaar-event-button"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import type { VendorHubEventWithInternal } from "@/lib/vendor-hub/vendor-hub-types"

export function BazaarEventsListClient({
  events,
}: {
  events: VendorHubEventWithInternal[]
}) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bazaar Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage booth reservations, assignments, and payments for each bazaar, market, or
            festival. Vendors apply once at the organization level.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Bazaar Event
        </Button>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No bazaar events yet. Create one, publish it to the calendar, and approved vendors can
            reserve booths.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="flex flex-col">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">{event.name}</CardTitle>
                  {event.internal_event_id ? (
                    <Badge variant="secondary">Event Management</Badge>
                  ) : null}
                </div>
                <CardDescription className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {event.event_date ?? "Date not set"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {event.location ?? "Location not set"}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-3">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Store className="h-4 w-4" />
                    {event.total_booths ?? 0} booths
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {event.expected_attendees ?? 0} expected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={VENDOR_HUB_ROUTES.events.detail(event.id)}>Open event</Link>
                  </Button>
                  <CopyBazaarEventButton
                    eventId={event.id}
                    eventName={event.name}
                    size="sm"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateBazaarEventDrawer open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
