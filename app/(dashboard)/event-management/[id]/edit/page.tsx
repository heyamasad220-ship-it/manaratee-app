import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { InternalEventForm } from "@/components/events/internal-event-form"
import { getDepartments } from "@/lib/departments/department-queries"
import { getEventTypes } from "@/lib/events/event-type-queries"
import { getInternalEventById } from "@/lib/events/internal-event-queries"
import { getActiveCalendarVenues } from "@/lib/bookings/venue-calendar-venues"
import { getRoomSetupStyles } from "@/lib/setup-styles/setup-style-queries"
import { getVendorHubVendorTypes } from "@/lib/vendor-hub/vendor-type-queries"
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
  const [event, departments, eventTypes, venues, setupStyles, vendorTypes] =
    await Promise.all([
      getInternalEventById(id),
      getDepartments(),
      getEventTypes({ activeOnly: true }),
      getActiveCalendarVenues(),
      getRoomSetupStyles({ activeOnly: true }),
      getVendorHubVendorTypes({ activeOnly: true }),
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
        setupStyles={setupStyles}
        canManageSetupStyles
        vendorTypes={vendorTypes}
        canManageVendorTypes
      />
    </>
  )
}
