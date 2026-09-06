import { EventManagementEventsClient } from "@/components/events/event-management-events-client"
import { CreateInternalEventButton } from "@/components/events/create-internal-event-button"
import { Header } from "@/components/layout/header"
import { getDepartments } from "@/lib/departments/department-queries"
import { requireEventWorkspaceViewPermission } from "@/lib/events/event-access"
import { parseEventManagementEventsFilters } from "@/lib/events/event-management-events-filters"
import { getInternalEvents } from "@/lib/events/internal-event-queries"
import { getTicketingEventCategories } from "@/lib/tickets/ticketing-event-category-queries"
import { getTicketedEventsOverview } from "@/lib/tickets/ticketing-overview-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
} from "@/lib/permissions/permissions"

export default async function EventManagementEventsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireEventWorkspaceViewPermission()

  const resolvedSearchParams = await searchParams
  const initialFilters = parseEventManagementEventsFilters(
    resolvedSearchParams || {}
  )
  const createParam = resolvedSearchParams?.create
  const initialCreateOpen =
    (Array.isArray(createParam) ? createParam[0] : createParam) === "1"

  const [events, departments, ticketSales, categories, canManage] =
    await Promise.all([
      getInternalEvents(),
      getDepartments(),
      getTicketedEventsOverview(),
      getTicketingEventCategories(),
      hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
    ])

  const departmentOptions = departments
    .map((department) => ({
      id: department.id as string,
      name: (department.name as string) || "Department",
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  return (
    <>
      <Header title="Events" />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View and manage every event. Ticketed rows show issued seats,
              remaining capacity, revenue, and category.
            </p>
          </div>
          {canManage ? (
            <CreateInternalEventButton initialOpen={initialCreateOpen} />
          ) : null}
        </div>
        <EventManagementEventsClient
          events={events}
          departments={departmentOptions}
          ticketSales={ticketSales}
          categories={categories}
          canManage={canManage}
          initialFilters={initialFilters}
        />
      </div>
    </>
  )
}
