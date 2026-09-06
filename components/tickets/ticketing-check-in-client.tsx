"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ScanLine, Ticket } from "lucide-react"

import { TicketCheckInScanner } from "@/components/tickets/ticket-check-in-scanner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { isTicketedEventPast, type TicketedEventOverviewRow } from "@/lib/tickets/ticketing-overview-types"
import { formatEventSchedule } from "@/lib/tickets/ticketing-overview-types"

export function TicketingCheckInClient({
  events,
  canCheckIn,
}: {
  events: TicketedEventOverviewRow[]
  canCheckIn: boolean
}) {
  const router = useRouter()
  const activeEvents = events.filter((event) => !isTicketedEventPast(event))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Check-in</h2>
        <p className="text-sm text-muted-foreground">
          Door check-in for every ticketed event. On a computer, type the ticket
          code. On a phone, start the camera and scan the QR. You can also open
          an event for its Orders list.
        </p>
      </div>

      {canCheckIn ? (
        <TicketCheckInScanner onCheckedIn={() => router.refresh()} />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanLine className="h-4 w-4" />
              Check-in scanner
            </CardTitle>
            <CardDescription>
              You can open an event below. Scanning at the door needs the check-in
              permission.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Active ticketed events</CardTitle>
          <CardDescription>
            Open an event workspace for that event&apos;s Orders list, ticket types,
            and row-by-row check-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeEvents.length === 0 ? (
            <div className="py-8 text-center">
              <Ticket className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No active ticketed events. Enable ticketing on an event in Event
                Management, a campaign, or a department — it will show up here.
              </p>
              <Button className="mt-4" variant="outline" asChild>
                <Link href="/event-management/events">Go to Events</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {activeEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-3 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{event.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatEventSchedule(event.startAt, event.endAt)}
                      {event.venueName || event.locationLabel
                        ? ` · ${event.venueName || event.locationLabel}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {event.ticketsIssued.toLocaleString()} issued
                      {event.ticketsCapacity != null
                        ? ` / ${event.ticketsCapacity.toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/event-management/${event.id}?tab=orders`}>
                        Open check-in
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/event-management/${event.id}`}>Event</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
