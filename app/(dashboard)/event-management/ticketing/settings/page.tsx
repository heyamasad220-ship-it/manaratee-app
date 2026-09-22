import { TicketingSettingsClient } from "@/components/tickets/ticketing-settings-client"
import { getTicketingEventCategories } from "@/lib/tickets/ticketing-event-category-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementTicketingSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE,
    PERMISSIONS.TICKETING_MANAGE
  )

  const resolved = await searchParams
  const sectionParam = resolved?.section
  const initialSection = Array.isArray(sectionParam)
    ? sectionParam[0]
    : sectionParam

  const categories = await getTicketingEventCategories()

  return (
    <TicketingSettingsClient
      categories={categories}
      initialSection={initialSection}
    />
  )
}
