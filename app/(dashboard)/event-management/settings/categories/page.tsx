import { EventManagementCategoriesSettingsClient } from "@/components/events/event-management-categories-settings-client"
import { getTicketingEventCategories } from "@/lib/tickets/ticketing-event-category-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementCategoriesSettingsPage() {
  await requireAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE)

  const categories = await getTicketingEventCategories()

  return <EventManagementCategoriesSettingsClient categories={categories} />
}
