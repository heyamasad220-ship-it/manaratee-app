import Link from "next/link"
import { CalendarDays, MapPin, Store } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { buildOrganizationJoinUrl } from "@/lib/organizations/join-organization-url"
import {
  formatBazaarEventSchedule,
  type PublicBazaarEvent,
} from "@/lib/vendor-hub/public-bazaar-event-queries"

export function PublicBazaarEventPage({ event }: { event: PublicBazaarEvent }) {
  const schedule = formatBazaarEventSchedule({
    eventDate: event.eventDate,
    startTime: event.startTime,
    endTime: event.endTime,
  })

  const vendorJoinUrl = event.organizationSlug
    ? buildOrganizationJoinUrl(event.organizationSlug)
    : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/80 to-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{event.organizationName}</Badge>
          {event.isPublished ? (
            <Badge className="bg-teal-700 hover:bg-teal-700">Open for vendors</Badge>
          ) : (
            <Badge variant="outline">Preview</Badge>
          )}
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{event.name}</h1>
          {schedule ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4 shrink-0" />
              {schedule}
            </p>
          ) : null}
          {event.location ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              {event.location}
            </p>
          ) : null}
        </div>

        {event.flyerUrl ? (
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardContent className="p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.flyerUrl}
                alt={`${event.name} flyer`}
                className="max-h-[720px] w-full object-contain bg-muted"
              />
            </CardContent>
          </Card>
        ) : null}

        {event.description ? (
          <Card>
            <CardContent className="pt-6">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {event.description}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-teal-200 bg-white/90">
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Interested in vending?</p>
              <p className="text-sm text-muted-foreground">
                Approved vendors can reserve booths and pay online through My Bazaars.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/customer/bazaars">
                  <Store className="mr-2 h-4 w-4" />
                  My Bazaars
                </Link>
              </Button>
              {vendorJoinUrl ? (
                <Button variant="outline" asChild>
                  <Link href={vendorJoinUrl}>Become a vendor</Link>
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
