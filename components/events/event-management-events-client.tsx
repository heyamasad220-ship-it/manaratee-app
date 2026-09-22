"use client"

import * as React from "react"
import Link from "next/link"
import { Archive, CalendarClock, Clock, Columns3, Repeat } from "lucide-react"

import { InternalEventCardActions } from "@/components/events/internal-event-card-actions"
import { InternalEventDbStatusBadge } from "@/components/events/internal-event-db-status-badge"
import { EventCategorySelect } from "@/components/tickets/ticketing-event-sales-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  DEFAULT_EVENT_MANAGEMENT_EVENTS_COLUMNS,
  EVENT_MANAGEMENT_EVENTS_COLUMN_DEFINITIONS,
  LOCKED_EVENT_MANAGEMENT_EVENTS_COLUMNS,
  loadEventManagementEventsColumns,
  saveEventManagementEventsColumns,
  toggleEventManagementEventsColumn,
  type EventManagementEventsColumnId,
} from "@/lib/events/event-management-events-columns"
import {
  buildEventManagementEventsHref,
  DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
  EVENT_MANAGEMENT_EVENTS_RECURRENCE_FILTER_ITEMS,
  EVENT_MANAGEMENT_EVENTS_STATUS_FILTER_ITEMS,
  EVENT_MANAGEMENT_EVENTS_TICKETED_FILTER_ITEMS,
  filterEventManagementEvents,
  getEventManagementSearchSeriesSummary,
  listEventManagementRecurringSeries,
  type EventManagementEventsFilters,
  type EventManagementEventsRecurrenceFilter,
  type EventManagementEventsStatusFilter,
  type EventManagementEventsTicketedFilter,
  type EventManagementRecurringSeries,
} from "@/lib/events/event-management-events-filters"
import { formatEventDate, formatEventTimeRange } from "@/lib/events/internal-event-format"
import {
  formatInternalEventSpaceLabel,
  getInternalEventLocationTypeLabel,
} from "@/lib/events/internal-event-location"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import {
  UNCATEGORIZED_TICKETING_CATEGORY_VALUE,
  type TicketingEventCategory,
} from "@/lib/tickets/ticketing-event-category-types"
import type { TicketedEventOverviewRow } from "@/lib/tickets/ticketing-overview-types"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"
import { formatPhoneDisplayOrDash } from "@/lib/ui/format-phone"

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

function eventIsTicketed(
  event: InternalEventWithRelations,
  sales: TicketedEventOverviewRow | undefined
) {
  return event.requires_ticketing === true || sales != null
}

function seriesRemainingHint(series: EventManagementRecurringSeries) {
  if (series.remainingCount > 0) {
    return `${series.remainingCount.toLocaleString("en-US")} remaining`
  }
  return `${series.totalCount.toLocaleString("en-US")} ${
    series.totalCount === 1 ? "meeting" : "meetings"
  }`
}

function EventRow({
  event,
  sales,
  categories,
  canManage,
  visible,
  schedule,
  remainingHint,
}: {
  event: InternalEventWithRelations
  sales: TicketedEventOverviewRow | undefined
  categories: TicketingEventCategory[]
  canManage: boolean
  visible: Set<EventManagementEventsColumnId>
  schedule?: string
  remainingHint?: string
}) {
  const href = `/event-management/${event.id}`
  const ticketed = eventIsTicketed(event, sales)

  return (
    <TableRow className="hover:bg-muted/40">
      {visible.has("event") ? (
        <TableCell className="font-medium">
          <Link href={href} className="text-primary hover:underline">
            {event.name}
          </Link>
          {remainingHint ? (
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">
              {remainingHint}
            </p>
          ) : null}
        </TableCell>
      ) : null}
      {visible.has("department") ? (
        <TableCell className="text-muted-foreground">
          {event.departments?.name || "—"}
        </TableCell>
      ) : null}
      {visible.has("contact") ? (
        <TableCell className="text-muted-foreground">
          {event.coordinator?.id && event.coordinator.full_name ? (
            <Link
              href={`/contacts/${event.coordinator.id}`}
              className="text-primary hover:underline"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
            >
              {event.coordinator.full_name}
            </Link>
          ) : (
            event.coordinator?.full_name || "—"
          )}
        </TableCell>
      ) : null}
      {visible.has("phone") ? (
        <TableCell className="text-muted-foreground">
          {event.coordinator?.phone ? (
            <a
              href={`tel:${event.coordinator.phone}`}
              className="hover:underline"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
            >
              {formatPhoneDisplayOrDash(event.coordinator.phone)}
            </a>
          ) : (
            "—"
          )}
        </TableCell>
      ) : null}
      {visible.has("email") ? (
        <TableCell className="text-muted-foreground">
          {event.coordinator?.email ? (
            <a
              href={`mailto:${event.coordinator.email}`}
              className="hover:underline"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
            >
              {event.coordinator.email}
            </a>
          ) : (
            "—"
          )}
        </TableCell>
      ) : null}
      {schedule ? (
        <TableCell className="text-muted-foreground">{schedule}</TableCell>
      ) : null}
      {visible.has("date") ? (
        <TableCell className="text-muted-foreground">
          {formatEventDate(event.start_at)}
        </TableCell>
      ) : null}
      {visible.has("time") ? (
        <TableCell className="text-muted-foreground">
          {formatEventTimeRange(event.start_at, event.end_at)}
        </TableCell>
      ) : null}
      {visible.has("location") ? (
        <TableCell className="text-muted-foreground">
          {getInternalEventLocationTypeLabel(event, { short: true })}
        </TableCell>
      ) : null}
      {visible.has("space") ? (
        <TableCell className="text-muted-foreground">
          {formatInternalEventSpaceLabel(event)}
        </TableCell>
      ) : null}
      {visible.has("status") ? (
        <TableCell>
          <InternalEventDbStatusBadge
            status={event.status}
            startAt={event.start_at}
            endAt={event.end_at}
          />
        </TableCell>
      ) : null}
      {visible.has("category") ? (
        <TableCell>
          {ticketed ? (
            <EventCategorySelect
              eventId={event.id}
              value={
                sales?.ticketingCategoryId ?? event.ticketing_category_id ?? null
              }
              categories={categories}
              disabled={!canManage}
            />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      ) : null}
      {visible.has("issued") ? (
        <TableCell className="text-right tabular-nums">
          {ticketed ? (sales?.ticketsIssued ?? 0).toLocaleString("en-US") : "—"}
        </TableCell>
      ) : null}
      {visible.has("remaining") ? (
        <TableCell className="text-right tabular-nums">
          {ticketed
            ? sales?.ticketsRemaining == null
              ? "—"
              : sales.ticketsRemaining.toLocaleString("en-US")
            : "—"}
        </TableCell>
      ) : null}
      {visible.has("revenue") ? (
        <TableCell className="text-right tabular-nums">
          {ticketed
            ? formatTicketPrice(sales?.revenueCents ?? 0, sales?.currency || "USD")
            : "—"}
        </TableCell>
      ) : null}
      {canManage && visible.has("actions") ? (
        <TableCell
          className="text-right"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <InternalEventCardActions
            eventId={event.id}
            eventName={event.name}
            compact
            showEdit={false}
            showDelete
            layout="menu"
            redirectAfterDelete={null}
          />
        </TableCell>
      ) : null}
    </TableRow>
  )
}

export function EventManagementEventsClient({
  events,
  departments,
  ticketSales,
  categories,
  canManage,
  initialFilters,
}: {
  events: InternalEventWithRelations[]
  departments: Array<{ id: string; name: string }>
  ticketSales: TicketedEventOverviewRow[]
  categories: TicketingEventCategory[]
  canManage: boolean
  initialFilters: EventManagementEventsFilters
}) {
  const [filters, setFilters] = React.useState(initialFilters)
  const [query, setQuery] = React.useState(initialFilters.q)
  const [columnsOpen, setColumnsOpen] = React.useState(false)
  const [visibleColumns, setVisibleColumns] = React.useState<
    EventManagementEventsColumnId[]
  >(() =>
    DEFAULT_EVENT_MANAGEMENT_EVENTS_COLUMNS.filter(
      (id) => canManage || id !== "actions"
    )
  )
  const filtersRef = React.useRef(filters)
  filtersRef.current = filters

  React.useEffect(() => {
    setVisibleColumns(loadEventManagementEventsColumns({ canManage }))
  }, [canManage])

  const salesByEventId = React.useMemo(() => {
    const map = new Map<string, TicketedEventOverviewRow>()
    for (const row of ticketSales) {
      map.set(row.id, row)
    }
    return map
  }, [ticketSales])

  const visible = React.useMemo(
    () => new Set(visibleColumns),
    [visibleColumns]
  )

  const columnChoices = React.useMemo(
    () =>
      EVENT_MANAGEMENT_EVENTS_COLUMN_DEFINITIONS.filter(
        (column) => canManage || column.id !== "actions"
      ),
    [canManage]
  )

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

  function applyColumns(next: EventManagementEventsColumnId[]) {
    setVisibleColumns(next)
    saveEventManagementEventsColumns(next)
  }

  function handleColumnToggle(
    id: EventManagementEventsColumnId,
    checked: boolean
  ) {
    applyColumns(
      toggleEventManagementEventsColumn(visibleColumns, id, checked, {
        canManage,
      })
    )
  }

  function resetColumns() {
    applyColumns(
      DEFAULT_EVENT_MANAGEMENT_EVENTS_COLUMNS.filter(
        (id) => canManage || id !== "actions"
      )
    )
  }

  const appliedFilters = { ...filters, q: query }
  const isRecurringTab = filters.recurrence === "recurring"
  const filtered = isRecurringTab
    ? []
    : filterEventManagementEvents(events, appliedFilters)
  const seriesRows = isRecurringTab
    ? listEventManagementRecurringSeries(events, appliedFilters)
    : []
  const seriesSummary =
    isRecurringTab && query.trim()
      ? getEventManagementSearchSeriesSummary(events, appliedFilters)
      : null
  const visibleRowCount = isRecurringTab ? seriesRows.length : filtered.length
  const noEventsExist = events.length === 0
  const filtersHideResults = !noEventsExist && visibleRowCount === 0
  const dateColumnLabel = isRecurringTab
    ? filters.status === "past"
      ? "Last date"
      : "Next date"
    : "Date"
  const showTicketFilters =
    events.some((event) => event.requires_ticketing === true) ||
    ticketSales.length > 0

  return (
    <div className="space-y-4">
      {!noEventsExist ? (
        <div className="space-y-3">
          <Tabs
            value={filters.recurrence}
            onValueChange={(value) =>
              applyFilters({
                recurrence: value as EventManagementEventsRecurrenceFilter,
              })
            }
          >
            <TabsList aria-label="Event type">
              {EVENT_MANAGEMENT_EVENTS_RECURRENCE_FILTER_ITEMS.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
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
            {showTicketFilters ? (
              <>
                <FilterSelect
                  label="Tickets"
                  value={filters.ticketed}
                  onValueChange={(value) =>
                    applyFilters({
                      ticketed: value as EventManagementEventsTicketedFilter,
                    })
                  }
                  items={[...EVENT_MANAGEMENT_EVENTS_TICKETED_FILTER_ITEMS]}
                />
                <FilterSelect
                  label="Category"
                  value={filters.category}
                  onValueChange={(value) => applyFilters({ category: value })}
                  items={[
                    { value: "all", label: "All categories" },
                    {
                      value: UNCATEGORIZED_TICKETING_CATEGORY_VALUE,
                      label: "Uncategorized",
                    },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                />
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setColumnsOpen(true)}
            >
              <Columns3 className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </div>
        </div>
      ) : null}

      {seriesSummary ? (
        <StatCardsRow equal columns={3}>
          <StatCard
            fill
            tone="blue"
            layout="header"
            icon={Repeat}
            label="Recurrences"
            value={seriesSummary.remainingCount.toLocaleString("en-US")}
            hint={
              seriesSummary.remainingCount === seriesSummary.totalCount
                ? "Upcoming meetings"
                : `of ${seriesSummary.totalCount} total`
            }
          />
          <StatCard
            fill
            tone="violet"
            layout="header"
            icon={CalendarClock}
            label="Recurring schedule"
            value={seriesSummary.schedule}
            valueClassName="text-xl font-semibold tracking-tight"
            hint={seriesSummary.name}
          />
          <StatCard
            fill
            tone="teal"
            layout="header"
            icon={Clock}
            label="Recurring time"
            value={seriesSummary.time}
            valueClassName="text-xl font-semibold tracking-tight tabular-nums"
            hint="Each meeting"
          />
        </StatCardsRow>
      ) : null}

      {noEventsExist ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Archive className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">No events yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an event to start managing it here.
          </p>
        </Card>
      ) : filtersHideResults ? (
        <div className="rounded-lg border bg-card px-6 py-12 text-center">
          <h2 className="text-base font-semibold">
            {isRecurringTab
              ? "No recurring events match these filters."
              : "No events match these filters."}
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
                    {visible.has("event") ? <TableHead>Event</TableHead> : null}
                    {visible.has("department") ? (
                      <TableHead>Department</TableHead>
                    ) : null}
                    {visible.has("contact") ? (
                      <TableHead>Contact</TableHead>
                    ) : null}
                    {visible.has("phone") ? <TableHead>Phone</TableHead> : null}
                    {visible.has("email") ? <TableHead>Email</TableHead> : null}
                    {isRecurringTab ? <TableHead>Schedule</TableHead> : null}
                    {visible.has("date") ? (
                      <TableHead>{dateColumnLabel}</TableHead>
                    ) : null}
                    {visible.has("time") ? <TableHead>Time</TableHead> : null}
                    {visible.has("location") ? (
                      <TableHead>Location</TableHead>
                    ) : null}
                    {visible.has("space") ? <TableHead>Space</TableHead> : null}
                    {visible.has("status") ? <TableHead>Status</TableHead> : null}
                    {visible.has("category") ? (
                      <TableHead>Category</TableHead>
                    ) : null}
                    {visible.has("issued") ? (
                      <TableHead className="text-right">Issued</TableHead>
                    ) : null}
                    {visible.has("remaining") ? (
                      <TableHead className="text-right">Remaining</TableHead>
                    ) : null}
                    {visible.has("revenue") ? (
                      <TableHead className="text-right">Revenue</TableHead>
                    ) : null}
                    {canManage && visible.has("actions") ? (
                      <TableHead className="w-[1%] text-right">Actions</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isRecurringTab
                    ? seriesRows.map((series) => (
                        <EventRow
                          key={series.key}
                          event={series.event}
                          sales={salesByEventId.get(series.event.id)}
                          categories={categories}
                          canManage={canManage}
                          visible={visible}
                          schedule={series.schedule}
                          remainingHint={seriesRemainingHint(series)}
                        />
                      ))
                    : filtered.map((event) => (
                        <EventRow
                          key={event.id}
                          event={event}
                          sales={salesByEventId.get(event.id)}
                          categories={categories}
                          canManage={canManage}
                          visible={visible}
                        />
                      ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={columnsOpen} onOpenChange={setColumnsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose columns</DialogTitle>
            <DialogDescription>
              Check the columns you want to see in the Events table.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            {columnChoices.map((column) => {
              const locked =
                LOCKED_EVENT_MANAGEMENT_EVENTS_COLUMNS.includes(column.id)
              const checked = visible.has(column.id)
              return (
                <label
                  key={column.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    disabled={locked}
                    onCheckedChange={(value) =>
                      handleColumnToggle(column.id, value === true)
                    }
                  />
                  <span>{column.label}</span>
                </label>
              )
            })}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={resetColumns}>
              Reset
            </Button>
            <Button type="button" onClick={() => setColumnsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
