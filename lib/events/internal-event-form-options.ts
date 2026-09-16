import { getDepartments } from "@/lib/departments/department-queries"
import { getEventTypes } from "@/lib/events/event-type-queries"
import { getEventManagementSettings } from "@/lib/events/event-management-settings"
import { getInternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"
import { getActiveCalendarVenues } from "@/lib/bookings/venue-calendar-venues"
import { getRoomSetupStyles } from "@/lib/setup-styles/setup-style-queries"
import type { RoomSetupStyle } from "@/lib/setup-styles/setup-style-types"
import type { InternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"

export type InternalEventCreateFormOptions = {
  departments: { id: string; name: string }[]
  eventTypes: { id: string; name: string }[]
  venues: { id: string; name: string }[]
  setupStyles: RoomSetupStyle[]
  defaults: InternalEventFormDefaults
  approvalRequired: boolean
}

export async function loadInternalEventCreateFormOptions(options?: {
  lockDepartmentId?: string | null
}): Promise<InternalEventCreateFormOptions> {
  const [departments, eventTypes, venues, setupStyles, defaults, settings] =
    await Promise.all([
      getDepartments(),
      getEventTypes({ activeOnly: true }),
      getActiveCalendarVenues(),
      getRoomSetupStyles({ activeOnly: true }),
      getInternalEventFormDefaults(),
      getEventManagementSettings(),
    ])

  const lockDepartmentId = options?.lockDepartmentId?.trim() || null
  const visibleDepartments = lockDepartmentId
    ? departments.filter((department) => department.id === lockDepartmentId)
    : departments

  return {
    departments: visibleDepartments.map((department) => ({
      id: department.id as string,
      name: (department.name as string) || "Department",
    })),
    eventTypes: eventTypes.map((eventType) => ({
      id: eventType.id,
      name: eventType.name,
    })),
    venues: venues.map((venue) => ({ id: venue.id, name: venue.name })),
    setupStyles,
    defaults,
    approvalRequired: settings.approvalRequired,
  }
}
