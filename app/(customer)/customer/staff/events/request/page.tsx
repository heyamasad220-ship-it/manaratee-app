import { redirect } from "next/navigation"

import { InternalEventForm } from "@/components/events/internal-event-form"
import { requireStaffToolsPortal } from "@/lib/auth/portal-capabilities"
import { getDepartments } from "@/lib/departments/department-queries"
import { getEventTypes } from "@/lib/events/event-type-queries"
import { getInternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { getInternalCalendarVenues } from "@/lib/bookings/venue-calendar-venues"
import { createClient } from "@/lib/supabase/server"

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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    redirect("/login")
  }

  const hasStaffTools = await requireStaffToolsPortal(
    user.id,
    activeOrganization.organization_id
  )

  if (!hasStaffTools) {
    redirect("/customer/dashboard")
  }

  const params = await searchParams
  const [departments, eventTypes, venues, defaults] = await Promise.all([
    getDepartments(),
    getEventTypes({ activeOnly: true }),
    getInternalCalendarVenues(),
    getInternalEventFormDefaults(),
  ])

  return (
    <InternalEventForm
      mode="request"
      requestOrigin="member-staff"
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
  )
}
