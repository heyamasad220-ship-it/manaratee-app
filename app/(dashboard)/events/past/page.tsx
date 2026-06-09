"use client"

import Link from "next/link"
import { Plus, SlidersHorizontal } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { PastEventsTable } from "@/components/events/past/past-events-table"

export default function PastEventsPage() {
  return (
    <>
      <Header title="Past Events" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Past Events</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              All events that have already occurred.
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
        <PastEventsTable />
      </div>
    </>
  )
}
