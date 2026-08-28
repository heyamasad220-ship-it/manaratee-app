"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { FolderOpen, Settings2 } from "lucide-react"

import { TicketingEventCategoriesDialog } from "@/components/tickets/ticketing-event-categories-dialog"
import { TicketingEventSalesTable } from "@/components/tickets/ticketing-event-sales-table"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  filterTicketedEventsByCategory,
  filterTicketedEventsByWhen,
  TICKETING_EVENTS_CATEGORY_FILTER_ALL,
  type TicketingEventsWhenFilter,
} from "@/lib/tickets/ticketing-event-category-groups"
import {
  UNCATEGORIZED_TICKETING_CATEGORY_VALUE,
  type TicketingEventCategory,
} from "@/lib/tickets/ticketing-event-category-types"
import type { TicketedEventOverviewRow } from "@/lib/tickets/ticketing-overview-types"

export function TicketingEventsClient({
  events,
  categories,
  canManage,
}: {
  events: TicketedEventOverviewRow[]
  categories: TicketingEventCategory[]
  canManage: boolean
}) {
  const [whenFilter, setWhenFilter] = useState<TicketingEventsWhenFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState(
    TICKETING_EVENTS_CATEGORY_FILTER_ALL
  )
  const [manageOpen, setManageOpen] = useState(false)

  const visibleEvents = useMemo(() => {
    const byWhen = filterTicketedEventsByWhen(events, whenFilter)
    return filterTicketedEventsByCategory(byWhen, categoryFilter)
  }, [categoryFilter, events, whenFilter])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Events</h2>
          <p className="text-sm text-muted-foreground">
            Ticket sales and capacity. Filter by category, or change a row to
            recategorize it.
          </p>
        </div>
        {canManage ? (
          <Button variant="outline" onClick={() => setManageOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            Manage categories
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
        <div className="space-y-2">
          <Label>Show</Label>
          <Select
            value={whenFilter}
            onValueChange={(value) =>
              setWhenFilter(value as TicketingEventsWhenFilter)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="active">Active events</SelectItem>
              <SelectItem value="past">Past events</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TICKETING_EVENTS_CATEGORY_FILTER_ALL}>
                All categories
              </SelectItem>
              <SelectItem value={UNCATEGORIZED_TICKETING_CATEGORY_VALUE}>
                Uncategorized
              </SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <FolderOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No ticketed events</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Enable ticketing on an event, then assign it to a category here.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/event-management/events">Go to Events</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {visibleEvents.length.toLocaleString()} event
            {visibleEvents.length === 1 ? "" : "s"}
          </p>
          <TicketingEventSalesTable
            events={visibleEvents}
            canManage={canManage}
            categories={categories}
          />
        </div>
      )}

      <TicketingEventCategoriesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        categories={categories}
      />
    </div>
  )
}
