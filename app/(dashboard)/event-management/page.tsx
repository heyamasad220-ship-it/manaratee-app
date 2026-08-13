import Link from "next/link"
import { Suspense } from "react"
import { Archive, Calendar, MapPin, Plus } from "lucide-react"

import { Header } from "@/components/layout/header"
import { EventManagementDashboardPanels } from "@/components/events/event-management-dashboard-panels"
import { EventManagementSectionNav } from "@/components/events/event-management-section-nav"
import { InternalEventCardActions } from "@/components/events/internal-event-card-actions"
import { InternalEventCatalogFilters } from "@/components/events/internal-event-catalog-filters"
import { InternalEventStatusSelect } from "@/components/events/internal-event-status-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDepartments } from "@/lib/departments/department-queries"
import {
  getEventManagementDashboard,
  parseDashboardTimePeriod,
} from "@/lib/events/internal-event-dashboard-queries"
import { getEventTypes } from "@/lib/events/event-type-queries"
import { getInternalEvents } from "@/lib/events/internal-event-queries"
import { getInternalEventDeleteBlockersMap } from "@/lib/events/internal-event-actions"
import { getInternalEventStatusLabel } from "@/lib/events/internal-event-status"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"
import { CREATE_EVENT_CTA_LABEL } from "@/lib/events/facility-event-request-href"

type PageSearchParams = {
  q?: string
  status?: string
  department?: string
  eventType?: string
  view?: string
  period?: string
}

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value: string | null) {
  if (!value) {
    return "TBD"
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function matchesEvent(
  event: InternalEventWithRelations,
  filters: PageSearchParams
) {
  const query = filters.q?.trim().toLowerCase()
  const status = filters.status || "all"
  const department = filters.department || "all"
  const eventType = filters.eventType || "all"

  const matchesSearch =
    !query ||
    event.name.toLowerCase().includes(query) ||
    event.description?.toLowerCase().includes(query) ||
    event.location_label?.toLowerCase().includes(query)

  const matchesStatus = status === "all" || event.status === status
  const matchesDepartment =
    department === "all" || event.department_id === department
  const matchesEventType =
    eventType === "all" || event.event_type_id === eventType

  return matchesSearch && matchesStatus && matchesDepartment && matchesEventType
}

function EventCard({
  event,
  canManage,
  deleteBlockedReason,
}: {
  event: InternalEventWithRelations
  canManage: boolean
  deleteBlockedReason?: string | null
}) {
  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/event-management/${event.id}`}
              className="text-base font-semibold leading-tight hover:text-amber-700"
            >
              {event.name}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {event.departments?.name || "No department"} ·{" "}
              {event.event_types?.name || "No type"}
            </p>
          </div>
          {canManage ? (
            <InternalEventStatusSelect eventId={event.id} status={event.status} />
          ) : (
            <Badge variant="outline">{getInternalEventStatusLabel(event.status)}</Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>
            {formatDate(event.start_at)}
            {event.end_at ? ` – ${formatDate(event.end_at)}` : ""}
          </span>
        </div>

        {event.location_label ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{event.location_label}</span>
          </div>
        ) : null}

        {canManage ? (
          <div className="flex justify-end pt-1">
            <InternalEventCardActions
              eventId={event.id}
              eventName={event.name}
              deleteBlockedReason={deleteBlockedReason}
            />
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function EventsTable({
  events,
  canManage,
  deleteBlockers,
}: {
  events: InternalEventWithRelations[]
  canManage: boolean
  deleteBlockers: Record<string, string | null>
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <Link
                    href={`/event-management/${event.id}`}
                    className="font-medium hover:text-amber-700"
                  >
                    {event.name}
                  </Link>
                  {event.location_label ? (
                    <p className="text-xs text-muted-foreground">{event.location_label}</p>
                  ) : null}
                </TableCell>
                <TableCell>{event.departments?.name || "—"}</TableCell>
                <TableCell>{event.event_types?.name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(event.start_at)}
                  {event.end_at ? ` – ${formatDate(event.end_at)}` : ""}
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <InternalEventStatusSelect eventId={event.id} status={event.status} />
                  ) : (
                    <Badge variant="outline">
                      {getInternalEventStatusLabel(event.status)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <InternalEventCardActions
                      eventId={event.id}
                      eventName={event.name}
                      compact
                      deleteBlockedReason={deleteBlockers[event.id] ?? null}
                    />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

async function EventManagementEventsContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAnyPermission(PERMISSIONS.EVENTS_VIEW, PERMISSIONS.PROGRAMS_VIEW)

  const resolvedSearchParams = await searchParams
  const filters: PageSearchParams = {
    q: getValue(resolvedSearchParams?.q) || "",
    status: getValue(resolvedSearchParams?.status) || "all",
    department: getValue(resolvedSearchParams?.department) || "all",
    eventType: getValue(resolvedSearchParams?.eventType) || "all",
    view: getValue(resolvedSearchParams?.view) || "cards",
    period: getValue(resolvedSearchParams?.period) || "",
  }
  const period = parseDashboardTimePeriod(filters.period)

  const [events, departments, eventTypes, canManage, dashboard] =
    await Promise.all([
      getInternalEvents(),
      getDepartments(),
      getEventTypes({ activeOnly: false }),
      hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
      getEventManagementDashboard(period),
    ])

  const filteredEvents = events.filter((event) => matchesEvent(event, filters))
  const viewMode = filters.view === "table" ? "table" : "cards"
  const deleteBlockers = canManage
    ? await getInternalEventDeleteBlockersMap(filteredEvents.map((event) => event.id))
    : {}

  return (
    <>
      <Header title="Events" />
      <Suspense fallback={null}>
        <EventManagementSectionNav />
      </Suspense>

      <div className="flex flex-col gap-6 p-6">
        <EventManagementDashboardPanels
          data={dashboard}
          period={period}
          canManage={canManage}
        />

        <div className="space-y-4">
          <h2 className="text-base font-semibold">All events</h2>

          <Card>
            <CardContent className="p-4">
              <InternalEventCatalogFilters
                departments={departments}
                eventTypes={eventTypes}
                initialFilters={{
                  q: filters.q || "",
                  status: filters.status || "all",
                  department: filters.department || "all",
                  eventType: filters.eventType || "all",
                  view: viewMode,
                }}
              />
            </CardContent>
          </Card>

          {filteredEvents.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12">
              <Archive className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">No events found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an event or adjust your filters.
              </p>
              {canManage ? (
                <Button className="mt-4" asChild>
                  <Link href="/facilities/calendar?openNew=1">
                    <Plus className="mr-2 h-4 w-4" />
                    {CREATE_EVENT_CTA_LABEL}
                  </Link>
                </Button>
              ) : null}
            </Card>
          ) : viewMode === "table" ? (
            <EventsTable
              events={filteredEvents}
              canManage={canManage}
              deleteBlockers={deleteBlockers}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  canManage={canManage}
                  deleteBlockedReason={deleteBlockers[event.id] ?? null}
                />
              ))}
            </div>
          )}
        </div>
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
