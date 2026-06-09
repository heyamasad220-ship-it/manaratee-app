import { EventManagementReportsClient } from "@/components/events/event-management-reports-client"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementReportsPage() {
  await requireAnyPermission(PERMISSIONS.EVENTS_VIEW, PERMISSIONS.PROGRAMS_VIEW)

  return <EventManagementReportsClient />
}
