"use client"

import { Header } from "@/components/layout/header"
import { EventsCalendar } from "@/components/events/calendar/events-calendar"

export default function CalendarPage() {
  return (
    <>
      <Header title="Calendar" />
      <div className="flex flex-1 flex-col p-6">
        <EventsCalendar />
      </div>
    </>
  )
}
