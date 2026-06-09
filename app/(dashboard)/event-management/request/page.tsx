import { redirect } from "next/navigation"

import { InternalEventForm } from "@/components/events/internal-event-form"
import { Header } from "@/components/layout/header"
import { getDepartments } from "@/lib/departments/department-queries"
import { getEventTypes } from "@/lib/events/event-type-queries"
import { getInternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"
import { getCalendarVenues } from "@/lib/reservations/reservation-queries"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

type PageProps = {
  searchParams?: Promise<{
    venueId?: string
    start?: string
    end?: string
  }>
}

export default async function InternalEventRequestPage({ searchParams }: PageProps) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    redirect("/login")
  }

  const canSubmit = await hasAnyPermission(
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  if (!canSubmit) {
    redirect("/event-management/overview")
  }

  const params = await searchParams
  const [departments, eventTypes, venues, defaults] = await Promise.all([
    getDepartments(),
    getEventTypes({ activeOnly: true }),
    getCalendarVenues(),
    getInternalEventFormDefaults(),
  ])

  return (
    <>
      <Header title="Event Management" />
      <InternalEventForm
      mode="request"
      departments={departments}
      eventTypes={eventTypes}
      venues={venues}
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
