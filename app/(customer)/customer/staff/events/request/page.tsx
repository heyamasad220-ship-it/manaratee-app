import { redirect } from "next/navigation"

import { CustomerStaffEventRequestClient } from "@/components/events/customer-staff-event-request-client"
import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"
import { requireStaffToolsPortal } from "@/lib/auth/portal-capabilities"
import { getDepartments } from "@/lib/departments/department-queries"
import { getEventTypes } from "@/lib/events/event-type-queries"
import { getInternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"
import { getActiveCalendarVenues } from "@/lib/bookings/venue-calendar-venues"
import { getEventManagementSettings } from "@/lib/events/event-management-settings"
import { getRoomSetupStyles } from "@/lib/setup-styles/setup-style-queries"

type PageProps = {
  searchParams?: Promise<{
    venueId?: string
    start?: string
    end?: string
  }>
}

export default async function CustomerStaffEventRequestPage({
  searchParams,
}: PageProps) {
  const { userId, organizationId } = await requireCustomerPortalPageContext()
  const hasStaffTools = await requireStaffToolsPortal(userId, organizationId)

  if (!hasStaffTools) {
    redirect("/customer/dashboard")
  }

  const params = await searchParams
  const [departments, eventTypes, venues, defaults, setupStyles, settings] =
    await Promise.all([
    getDepartments(),
    getEventTypes({ activeOnly: true }),
    getActiveCalendarVenues(),
    getInternalEventFormDefaults(),
    getRoomSetupStyles({ activeOnly: true }),
    getEventManagementSettings(organizationId),
  ])

  return (
    <CustomerStaffEventRequestClient
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      eventTypes={eventTypes.map((t) => ({ id: t.id, name: t.name }))}
      venues={venues.map((v) => ({ id: v.id, name: v.name }))}
      setupStyles={setupStyles}
      defaults={defaults}
      initialSlot={{
        venueId: params?.venueId || "",
        startAt: params?.start || "",
        endAt: params?.end || "",
      }}
      approvalRequired={settings.approvalRequired}
    />
  )
}
