import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { FacilityEventEditPageClient } from "@/components/events/facility-event-edit-page-client"
import { getDepartments } from "@/lib/departments/department-queries"
import { getEventTypes } from "@/lib/events/event-type-queries"
import { getInternalEventById } from "@/lib/events/internal-event-queries"
import { getInternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"
import { getActiveCalendarVenues } from "@/lib/bookings/venue-calendar-venues"
import { getRoomSetupStyles } from "@/lib/setup-styles/setup-style-queries"
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
  const [event, departments, eventTypes, venues, setupStyles, defaults] =
    await Promise.all([
      getInternalEventById(id),
      getDepartments(),
      getEventTypes({ activeOnly: true }),
      getActiveCalendarVenues(),
      getRoomSetupStyles({ activeOnly: true }),
      getInternalEventFormDefaults(),
    ])

  if (!event) {
    notFound()
  }

  return (
    <>
      <Header title="Event Management" />
      <FacilityEventEditPageClient
        eventId={event.id}
        eventName={event.name}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        eventTypes={eventTypes.map((t) => ({ id: t.id, name: t.name }))}
        venues={venues.map((v) => ({ id: v.id, name: v.name }))}
        setupStyles={setupStyles}
        defaults={defaults}
      />
    </>
  )
}
