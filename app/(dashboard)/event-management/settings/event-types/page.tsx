import { EventTypesClient } from "@/components/events/event-types-client"
import { getEventTypes } from "@/lib/events/event-type-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventTypesSettingsPage() {
  await requireAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE)

  const eventTypes = await getEventTypes()

  return <EventTypesClient eventTypes={eventTypes} />
}
