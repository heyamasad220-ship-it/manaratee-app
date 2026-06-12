"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { CalendarDays, Globe, LayoutGrid, List, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { cn } from "@/lib/utils"

type CalendarEvent = {
  id: string
  name: string
  event_date: string | null
  start_time: string | null
  location: string | null
  calendar_status: string | null
  description: string | null
}

import {
  CALENDAR_VISIBILITY_LABELS,
  isVisibleOnCommunityCalendar,
} from "@/lib/vendor-hub/calendar-visibility"

export function CommunityCalendarClient() {
  const supabase = createClient()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"list" | "month">("list")

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from("vendor_hub_events")
        .select("id, name, event_date, start_time, location, calendar_status, description")
        .order("event_date", { ascending: true, nullsFirst: false })

      if (error) {
        console.error("Community calendar load error:", error)
        setEvents([])
      } else {
        setEvents(data ?? [])
      }
      setLoading(false)
    }

    load()
  }, [])

  const visibleEvents = useMemo(
    () => events.filter((event) => isVisibleOnCommunityCalendar(event.calendar_status)),
    [events]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Community Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Coordinate bazaar dates across your organization. Cross-organization federation is
            planned for a later release.
          </p>
        </div>
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

      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">MVP visibility levels:</strong> Private (hidden),{" "}
          Community Visible (shown here), Public (shown with public badge). Set visibility when
          creating or editing a bazaar event.
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading calendar…</CardContent>
        </Card>
      ) : visibleEvents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No community-visible bazaar events yet. Mark an event as Community Visible or Public
            from{" "}
            <Link href={VENDOR_HUB_ROUTES.events.list} className="text-primary hover:underline">
              Bazaar Events
            </Link>
            .
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-3">
          {visibleEvents.map((event) => (
            <Card key={event.id}>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{event.name}</p>
                    <Badge variant="outline">
                      {CALENDAR_VISIBILITY_LABELS[event.calendar_status ?? ""] ?? event.calendar_status}
                    </Badge>
                    {event.calendar_status === "published" ? (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    ) : null}
                  </div>
                  <p className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {event.event_date ?? "Date TBD"}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {event.location ?? "Location TBD"}
                    </span>
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={VENDOR_HUB_ROUTES.events.detail(event.id)}>Open bazaar</Link>
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
