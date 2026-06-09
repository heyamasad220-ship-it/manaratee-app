"use client"

import Link from "next/link"
import { Plus, SlidersHorizontal } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { UpcomingEventsTable } from "@/components/events/upcoming/upcoming-events-table"

export default function UpcomingEventsPage() {
  return (
    <>
      <Header title="Upcoming Events" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Upcoming Events</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              All events scheduled in the future.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild className="gap-1.5">
              <Link href="/bookings/requests">
                <Plus className="h-4 w-4" />
                New Event
              </Link>
            </Button>
            <Button variant="outline" className="gap-1.5">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>
        <UpcomingEventsTable />
      </div>
    </>
  )
}
