import Link from "next/link"
import { Calendar, ChevronRight, Clock, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { LegacyVenueBookingRow } from "@/lib/bookings/customer-venue-rental-experience"

function formatLegacyDate(value: string | null) {
  if (!value) return "Date not set"
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function LegacyVenueBookingCard({ booking }: { booking: LegacyVenueBookingRow }) {
  return (
    <Link href={`/customer/bookings/${booking.id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="flex items-center justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{booking.event_type || "Venue booking"}</h3>
              <Badge variant="outline">Legacy</Badge>
              {booking.status ? (
                <Badge variant="secondary" className="capitalize">
                  {booking.status.replaceAll("_", " ")}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {booking.venueName || "Venue"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatLegacyDate(booking.event_date)}
              </span>
              {booking.start_time ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {booking.start_time}
                  {booking.end_time ? ` – ${booking.end_time}` : ""}
                </span>
              ) : null}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}
