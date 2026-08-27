import Link from "next/link"
import { Plus } from "lucide-react"

import { EventManagementEventsClient } from "@/components/events/event-management-events-client"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { getDepartments } from "@/lib/departments/department-queries"
import { requireEventWorkspaceViewPermission } from "@/lib/events/event-access"
import { parseEventManagementEventsFilters } from "@/lib/events/event-management-events-filters"
import { CREATE_EVENT_CTA_LABEL } from "@/lib/events/facility-event-request-href"
import { getInternalEventDeleteBlockersMap } from "@/lib/events/internal-event-actions"
import { getInternalEvents } from "@/lib/events/internal-event-queries"
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

  const [events, departments, canManage] = await Promise.all([
    getInternalEvents(),
    getDepartments(),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
  ])

  const deleteBlockers = canManage
    ? await getInternalEventDeleteBlockersMap(events.map((event) => event.id))
    : {}

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
              View and manage internal department-owned events.
            </p>
          </div>
          {canManage ? (
            <Button asChild size="sm">
              <Link href="/facilities/calendar?openNew=1">
                <Plus className="mr-2 h-4 w-4" />
                {CREATE_EVENT_CTA_LABEL}
              </Link>
            </Button>
          ) : null}
        </div>
        <EventManagementEventsClient
          events={events}
          departments={departmentOptions}
          canManage={canManage}
          deleteBlockers={deleteBlockers}
          initialFilters={initialFilters}
        />
      </div>
    </>
  )
}
