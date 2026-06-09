import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { InternalEventForm } from "@/components/events/internal-event-form"
import { getDepartments } from "@/lib/departments/department-queries"
import { getEventTypes } from "@/lib/events/event-type-queries"
import { getInternalEventById } from "@/lib/events/internal-event-queries"
import { getInternalCalendarVenues } from "@/lib/bookings/venue-calendar-venues"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EditInternalEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE)

  const { id } = await params
  const [event, departments, eventTypes, venues] = await Promise.all([
    getInternalEventById(id),
    getDepartments(),
    getEventTypes({ activeOnly: true }),
    getInternalCalendarVenues(),
  ])

  if (!event) {
    notFound()
  }

  return (
    <>
      <Header title="Event Management" />
      <InternalEventForm
        mode="edit"
        event={event}
        departments={departments}
        eventTypes={eventTypes}
        venues={venues}
      />
    </>
  )
}
