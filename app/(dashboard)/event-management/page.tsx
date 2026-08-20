import Link from "next/link"
import { Suspense } from "react"
import { Archive, Plus } from "lucide-react"

import { Header } from "@/components/layout/header"
import { EventManagementDashboardPanels } from "@/components/events/event-management-dashboard-panels"
import { EventManagementOverviewRow } from "@/components/events/event-management-overview-row"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  filterEventsForDashboardPeriod,
  getEventManagementDashboard,
  parseDashboardTimePeriod,
} from "@/lib/events/internal-event-dashboard-queries"
import { getInternalEvents } from "@/lib/events/internal-event-queries"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import { requireEventWorkspaceViewPermission } from "@/lib/events/event-access"
import {
  hasAnyPermission,
  PERMISSIONS,
} from "@/lib/permissions/permissions"
import { CREATE_EVENT_CTA_LABEL } from "@/lib/events/facility-event-request-href"

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function AllEventsList({
  events,
  canManage,
  isPast,
}: {
  events: InternalEventWithRelations[]
  canManage: boolean
  isPast: boolean
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">
          {isPast ? "Past events" : "All events"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isPast
            ? "Most recent first. Open a row to view the event workspace."
            : "Soonest first. Open a row to view the event workspace."}
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Archive className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">No events found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPast
              ? "No past events in this view yet."
              : "Create an event or choose a different period."}
          </p>
          {canManage && !isPast ? (
            <Button className="mt-4" asChild>
              <Link href="/facilities/calendar?openNew=1">
                <Plus className="mr-2 h-4 w-4" />
                {CREATE_EVENT_CTA_LABEL}
              </Link>
            </Button>
          ) : null}
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Event</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Space</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <EventManagementOverviewRow key={event.id} event={event} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

async function EventManagementEventsContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireEventWorkspaceViewPermission()

  const resolvedSearchParams = await searchParams
  const period = parseDashboardTimePeriod(getValue(resolvedSearchParams?.period))

  const [events, canManage] = await Promise.all([
    getInternalEvents(),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
  ])
  const dashboard = await getEventManagementDashboard(period, events)
  const listEvents = filterEventsForDashboardPeriod(events, period)

  return (
    <>
      <Header title="Events" />

      <div className="flex flex-col gap-6 p-6">
        <EventManagementDashboardPanels
          data={dashboard}
          period={period}
          canManage={canManage}
          eventsList={
            <AllEventsList
              events={listEvents}
              canManage={canManage}
              isPast={period === "past"}
            />
          }
        />
      </div>
    </>
  )
}

export default function EventManagementCatalogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={null}>
      <EventManagementEventsContent searchParams={searchParams} />
    </Suspense>
  )
}
