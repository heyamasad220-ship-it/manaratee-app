import { Header } from "@/components/layout/header"
import { InternalEventForm } from "@/components/events/internal-event-form"
import { getDepartments } from "@/lib/departments/department-queries"
import { getEventTypes } from "@/lib/events/event-type-queries"
import { getInternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"
import {
  mergeInternalEventFormDefaults,
  resolveInternalEventFormReturnTo,
} from "@/lib/events/internal-event-form-query"
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
    department?: string
    returnTo?: string
  }>
}

export default async function CreateInternalEventPage({ searchParams }: PageProps) {
  await requireAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE)

  const params = await searchParams
  const departmentFromQuery = params?.department?.trim() || ""
  const returnTo = resolveInternalEventFormReturnTo(params?.returnTo)

  const [departments, eventTypes, venues, baseDefaults, setupStyles, vendorTypes] =
    await Promise.all([
      getDepartments(),
      getEventTypes({ activeOnly: true }),
      getActiveCalendarVenues(),
      getInternalEventFormDefaults(),
      getRoomSetupStyles({ activeOnly: true }),
      getVendorHubVendorTypes({ activeOnly: true }),
    ])

  const defaults = mergeInternalEventFormDefaults(baseDefaults, departmentFromQuery)
  const departmentExists = departments.some((department) => department.id === departmentFromQuery)

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
        lockDepartment={Boolean(departmentFromQuery && departmentExists)}
        returnTo={returnTo}
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
