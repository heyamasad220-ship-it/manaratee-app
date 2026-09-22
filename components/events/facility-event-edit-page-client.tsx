"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { FacilityEventRequestDrawer } from "@/components/events/facility-event-request-drawer"
import { Button } from "@/components/ui/button"
import type { RoomSetupStyle } from "@/lib/setup-styles/setup-style-types"
import type { InternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"
import {
  buildEventManagementEventsHref,
  DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
} from "@/lib/events/event-management-events-filters"

type FacilityEventEditPageClientProps = {
  eventId: string
  eventName: string
  departments: { id: string; name: string }[]
  eventTypes: { id: string; name: string }[]
  venues: { id: string; name: string }[]
  setupStyles: RoomSetupStyle[]
  defaults: InternalEventFormDefaults
}

export function FacilityEventEditPageClient({
  eventId,
  eventName,
  departments,
  eventTypes,
  venues,
  setupStyles,
  defaults,
}: FacilityEventEditPageClientProps) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const savedRef = useRef(false)
  const backHref = `/event-management/${eventId}`

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen && !savedRef.current) {
      router.push(backHref)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="mt-0.5 shrink-0">
          <Link href={backHref} aria-label="Back to event">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit event</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {eventName || "Update this event using the same form as Facilities booking."}
          </p>
        </div>
      </div>

      <FacilityEventRequestDrawer
        open={open}
        onOpenChange={handleOpenChange}
        departments={departments}
        eventTypes={eventTypes}
        venues={venues}
        setupStyles={setupStyles}
        defaults={defaults}
        editEventId={eventId}
        onSubmitted={(_eventId, extras) => {
          savedRef.current = true
          if (extras?.recurrenceChanged) {
            router.push(
              buildEventManagementEventsHref({
                ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
                recurrence: extras.recurring ? "recurring" : "one_time",
              })
            )
            return
          }
          router.push(backHref)
          router.refresh()
        }}
      />
    </div>
  )
}
