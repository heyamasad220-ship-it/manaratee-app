"use client"

import { useRouter } from "next/navigation"
import { EventsCalendar } from "@/components/events/calendar/events-calendar"
import {
  buildEventFormPathFromSlot,
  type CalendarSlotSelection,
  type EventCalendarGridItem,
} from "@/lib/events/event-calendar-utils"

type CalendarVenueOption = {
  id: string
  name: string
}

export function EventsCalendarPageClient({
  venues,
  events,
  canManage,
}: {
  venues: CalendarVenueOption[]
  events: EventCalendarGridItem[]
  canManage: boolean
}) {
  const router = useRouter()

  function handleSlotClick(slot: CalendarSlotSelection) {
    router.push(buildEventFormPathFromSlot(slot, canManage))
  }

  function handleCreateEvent() {
    router.push(canManage ? "/event-management/create" : "/event-management/request")
  }

  return (
    <EventsCalendar
      variant="events"
      venues={venues}
      calendarEvents={events}
      onSlotClick={handleSlotClick}
      onCreateEventClick={handleCreateEvent}
    />
  )
}
