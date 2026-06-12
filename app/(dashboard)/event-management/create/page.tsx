import { Header } from "@/components/layout/header"
import { InternalEventForm } from "@/components/events/internal-event-form"
import { getDepartments } from "@/lib/departments/department-queries"
import { getEventTypes } from "@/lib/events/event-type-queries"
import { getInternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"
import { getActiveCalendarVenues } from "@/lib/bookings/venue-calendar-venues"
import { getRoomSetupStyles } from "@/lib/setup-styles/setup-style-queries"
import { getVendorHubVendorTypes } from "@/lib/vendor-hub/vendor-type-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

type PageProps = {
  searchParams?: Promise<{
    venueId?: string
    start?: string
    end?: string
  }>
}

export default async function CreateInternalEventPage({ searchParams }: PageProps) {
  await requireAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE)

  const params = await searchParams
  const [departments, eventTypes, venues, defaults, setupStyles, vendorTypes] =
    await Promise.all([
      getDepartments(),
      getEventTypes({ activeOnly: true }),
      getActiveCalendarVenues(),
      getInternalEventFormDefaults(),
      getRoomSetupStyles({ activeOnly: true }),
      getVendorHubVendorTypes({ activeOnly: true }),
    ])

  return (
    <>
      <Header title="Event Management" />
      <InternalEventForm
        mode="create"
        departments={departments}
        eventTypes={eventTypes}
        venues={venues}
        setupStyles={setupStyles}
        canManageSetupStyles
        vendorTypes={vendorTypes}
        canManageVendorTypes
        initialSlot={{
          venueId: params?.venueId || "",
          startAt: params?.start || "",
          endAt: params?.end || "",
        }}
        defaults={defaults}
      />
    </>
  )
}
