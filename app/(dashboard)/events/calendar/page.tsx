"use client"

import { Header } from "@/components/layout/header"
import { CalendarTable } from "@/components/bookings/calendar/calendar-table"

export default function EventsCalendarPage() {
  return (
    <>
      <Header title="Calendar" />
      <div className="flex flex-col gap-5 p-6">
        <CalendarTable />
      </div>
    </>
  )
}
