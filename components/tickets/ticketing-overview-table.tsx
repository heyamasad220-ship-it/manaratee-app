"use client"

import Link from "next/link"
import { useMemo } from "react"
import { CalendarCheck, CalendarDays, DollarSign, Ticket } from "lucide-react"

import { TicketingEventSalesTable } from "@/components/tickets/ticketing-event-sales-table"
import { Button } from "@/components/ui/button"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { filterTicketedEventsByWhen } from "@/lib/tickets/ticketing-event-category-groups"
import {
  summarizeTicketedEventsOverview,
  type TicketedEventOverviewRow,
} from "@/lib/tickets/ticketing-overview-types"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

export function TicketingOverviewTable({
  events,
  canManage,
}: {
  events: TicketedEventOverviewRow[]
  canManage: boolean
}) {
  const summary = useMemo(() => summarizeTicketedEventsOverview(events), [events])
  const activeEvents = useMemo(
    () => filterTicketedEventsByWhen(events, "active"),
    [events]
  )

  if (events.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <Ticket className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="text-lg font-semibold">No ticketed events yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable ticketing on an event in Event Management to start selling
          tickets.
        </p>
        <Button className="mt-4" asChild>
          <Link href="/event-management/events">Go to Events</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <StatCardsRow equal columns={4}>
        <StatCard
          label="Total events"
          value={summary.totalEvents.toLocaleString()}
          icon={CalendarDays}
          hint={`${summary.pastEvents.toLocaleString()} past`}
          layout="compact"
          fill
          tone="slate"
        />
        <StatCard
          label="Active events"
          value={summary.activeEvents.toLocaleString()}
          icon={CalendarCheck}
          hint="Upcoming or in progress"
          layout="compact"
          fill
          tone="emerald"
        />
        <StatCard
          label="Tickets issued"
          value={summary.ticketsIssued.toLocaleString()}
          icon={Ticket}
          hint="All ticketed events"
          layout="compact"
          fill
          tone="violet"
        />
        <StatCard
          label="Revenue"
          value={formatTicketPrice(summary.revenueCents, summary.currency)}
          icon={DollarSign}
          hint="Completed ticket sales"
          layout="compact"
          fill
          tone="blue"
        />
      </StatCardsRow>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Active events</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/event-management/ticketing/events">View all events</Link>
          </Button>
        </div>
        {activeEvents.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
            No active ticketed events.{" "}
            <Link
              href="/event-management/ticketing/events"
              className="font-medium text-primary hover:underline"
            >
              View all events
            </Link>
          </div>
        ) : (
          <TicketingEventSalesTable events={activeEvents} canManage={canManage} />
        )}
      </div>
    </div>
  )
}
