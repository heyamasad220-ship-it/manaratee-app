"use client"

import Link from "next/link"
import { CalendarDays, Globe, LayoutGrid, List, MapPin, Store, Ticket } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CALENDAR_VISIBILITY_LABELS } from "@/lib/community-calendar/calendar-visibility"
import type { CommunityCalendarItem } from "@/lib/community-calendar/queries"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { cn } from "@/lib/utils"

function sourceLabel(source: CommunityCalendarItem["source"]) {
  return source === "bazaar" ? "Bazaar" : "Event"
}

export function CommunityCalendarClient({
  items,
  includeBazaar,
  includeEvents,
}: {
  items: CommunityCalendarItem[]
  includeBazaar: boolean
  includeEvents: boolean
}) {
  const [viewMode, setViewMode] = useState<"list" | "month">("list")
  const [sourceFilter, setSourceFilter] = useState<"all" | "bazaar" | "event">("all")

  const visibleEvents = useMemo(() => {
    if (sourceFilter === "all") return items
    return items.filter((item) => item.source === sourceFilter)
  }, [items, sourceFilter])

  const emptyHint = (() => {
    if (includeBazaar && includeEvents) {
      return (
        <>
          Mark a bazaar as Public from{" "}
          <Link href={VENDOR_HUB_ROUTES.events.list} className="text-primary hover:underline">
            Bazaar Events
          </Link>
          , or publish an Event Management event from its Overview tab.
        </>
      )
    }
    if (includeBazaar) {
      return (
        <>
          Mark an event as Public from{" "}
          <Link href={VENDOR_HUB_ROUTES.events.list} className="text-primary hover:underline">
            Bazaar Events
          </Link>
          .
        </>
      )
    }
    return (
      <>
        Publish an event from{" "}
        <Link href="/event-management" className="text-primary hover:underline">
          Event Management
        </Link>{" "}
        → Settings → General → Community Calendar.
      </>
    )
  })()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Community Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Public events for your organization
            {includeBazaar && includeEvents
              ? " — bazaars and Event Management events."
              : includeBazaar
                ? " — Vendor Hub bazaars."
                : " — Event Management events."}{" "}
            Cross-organization federation is planned for a later release.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {includeBazaar && includeEvents ? (
            <div className="flex items-center rounded-lg border p-1">
              {(
                [
                  ["all", "All"],
                  ["event", "Events"],
                  ["bazaar", "Bazaars"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  variant={sourceFilter === value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSourceFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center rounded-lg border p-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="mr-1 h-4 w-4" />
              List
            </Button>
            <Button
              variant={viewMode === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
            >
              <LayoutGrid className="mr-1 h-4 w-4" />
              Month
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Visibility:</strong> Private (hidden), Community
          Visible (shown here), Public (shown with public badge). Set visibility when creating a
          bazaar or on an event&apos;s Overview tab.
        </CardContent>
      </Card>

      {visibleEvents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{emptyHint}</CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-3">
          {visibleEvents.map((event) => (
            <Card key={event.id}>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{event.name}</p>
                    <Badge variant="secondary" className="gap-1 font-normal">
                      {event.source === "bazaar" ? (
                        <Store className="h-3 w-3" />
                      ) : (
                        <Ticket className="h-3 w-3" />
                      )}
                      {sourceLabel(event.source)}
                    </Badge>
                    <Badge variant="outline">
                      {CALENDAR_VISIBILITY_LABELS[event.calendarStatus ?? ""] ??
                        event.calendarStatus}
                    </Badge>
                    {event.calendarStatus === "published" ? (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    ) : null}
                  </div>
                  <p className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {event.eventDate ?? "Date TBD"}
                      {event.startLabel ? ` · ${event.startLabel}` : null}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {event.location ?? "Location TBD"}
                    </span>
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={event.href}>
                    {event.source === "bazaar" ? "Open bazaar" : "Open event"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className={cn("p-6 text-sm text-muted-foreground")}>
            Month view coming soon. Use list view to see {visibleEvents.length} upcoming event
            {visibleEvents.length === 1 ? "" : "s"}.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
