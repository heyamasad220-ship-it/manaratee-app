"use client"

import * as React from "react"
import Link from "next/link"
import { Archive } from "lucide-react"

import { InternalEventCardActions } from "@/components/events/internal-event-card-actions"
import { InternalEventDbStatusBadge } from "@/components/events/internal-event-db-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildEventManagementEventsHref,
  DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
  EVENT_MANAGEMENT_EVENTS_STATUS_FILTER_ITEMS,
  filterEventManagementEvents,
  type EventManagementEventsFilters,
  type EventManagementEventsStatusFilter,
} from "@/lib/events/event-management-events-filters"
import { EVENT_MANAGEMENT_EVENTS_PATH } from "@/lib/events/event-management-section-path"
import { formatEventDate, formatEventTimeRange } from "@/lib/events/internal-event-format"
import {
  formatInternalEventSpaceLabel,
  getInternalEventLocationTypeLabel,
} from "@/lib/events/internal-event-location"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"

function FilterSelect({
  label,
  value,
  onValueChange,
  items,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  items: Array<{ value: string; label: string }>
}) {
  return (
    <div className="min-w-[9.5rem] space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger size="sm" className="w-full bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function EventRow({
  event,
  canManage,
  deleteBlockedReason,
}: {
  event: InternalEventWithRelations
  canManage: boolean
  deleteBlockedReason: string | null
}) {
  const href = `/event-management/${event.id}`

  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="font-medium">
        <Link href={href} className="hover:underline">
          {event.name}
        </Link>
      </TableCell>
      <TableCell>
        <InternalEventDbStatusBadge status={event.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {event.departments?.name || "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {getInternalEventLocationTypeLabel(event, { short: true })}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatEventDate(event.start_at)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatEventTimeRange(event.start_at, event.end_at)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatInternalEventSpaceLabel(event)}
      </TableCell>
      {canManage ? (
        <TableCell className="text-right">
          <InternalEventCardActions
            eventId={event.id}
            eventName={event.name}
            compact
            deleteBlockedReason={deleteBlockedReason}
            redirectAfterDelete={EVENT_MANAGEMENT_EVENTS_PATH}
          />
        </TableCell>
      ) : null}
    </TableRow>
  )
}

export function EventManagementEventsClient({
  events,
  departments,
  canManage,
  deleteBlockers,
  initialFilters,
}: {
  events: InternalEventWithRelations[]
  departments: Array<{ id: string; name: string }>
  canManage: boolean
  deleteBlockers: Record<string, string | null>
  initialFilters: EventManagementEventsFilters
}) {
  const [filters, setFilters] = React.useState(initialFilters)
  const [query, setQuery] = React.useState(initialFilters.q)
  const filtersRef = React.useRef(filters)
  filtersRef.current = filters

  function syncUrl(nextFilters: EventManagementEventsFilters) {
    window.history.replaceState(
      window.history.state,
      "",
      buildEventManagementEventsHref(nextFilters)
    )
  }

  function applyFilters(next: Partial<EventManagementEventsFilters>) {
    const merged = { ...filtersRef.current, ...next }
    filtersRef.current = merged
    setFilters(merged)
    syncUrl(merged)
  }

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (query === filtersRef.current.q) return
      applyFilters({ q: query })
    }, 250)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce query only
  }, [query])

  function clearFilters() {
    setQuery("")
    applyFilters({ ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS })
  }

  const filtered = filterEventManagementEvents(events, { ...filters, q: query })
  const noEventsExist = events.length === 0
  const filtersHideResults = !noEventsExist && filtered.length === 0

  return (
    <div className="space-y-4">
      {!noEventsExist ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search events..."
              aria-label="Search events"
              className="h-8 bg-background"
            />
          </div>
          <FilterSelect
            label="Department"
            value={filters.department}
            onValueChange={(value) => applyFilters({ department: value })}
            items={[
              { value: "all", label: "All Departments" },
              ...departments.map((department) => ({
                value: department.id,
                label: department.name,
              })),
            ]}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onValueChange={(value) =>
              applyFilters({
                status: value as EventManagementEventsStatusFilter,
              })
            }
            items={[...EVENT_MANAGEMENT_EVENTS_STATUS_FILTER_ITEMS]}
          />
        </div>
      ) : null}

      {noEventsExist ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Archive className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">No events yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an event from Facilities to start managing it here.
          </p>
        </Card>
      ) : filtersHideResults ? (
        <div className="rounded-lg border bg-card px-6 py-12 text-center">
          <h2 className="text-base font-semibold">
            No events match these filters.
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Space</TableHead>
                    {canManage ? <TableHead className="w-[1%] text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      canManage={canManage}
                      deleteBlockedReason={deleteBlockers[event.id] ?? null}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
