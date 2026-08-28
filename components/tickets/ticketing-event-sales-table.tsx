"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"

import { Progress } from "@/components/ui/progress"
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
import { cn } from "@/lib/utils"
import { setTicketedEventCategory } from "@/lib/tickets/ticketing-event-category-actions"
import {
  UNCATEGORIZED_TICKETING_CATEGORY_VALUE,
  type TicketingEventCategory,
} from "@/lib/tickets/ticketing-event-category-types"
import { updateEventTicketingSalesStatus } from "@/lib/tickets/ticket-order-actions"
import {
  formatEventSchedule,
  type TicketedEventOverviewRow,
} from "@/lib/tickets/ticketing-overview-types"
import {
  TICKETING_SALES_STATUS_LABELS,
  formatTicketPrice,
  type TicketingSalesStatus,
} from "@/lib/tickets/ticket-types"

function salesStatusClass(status: TicketingSalesStatus) {
  if (status === "published") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }
  if (status === "sales_closed") {
    return "border-slate-200 bg-slate-50 text-slate-700"
  }
  return "border-amber-200 bg-amber-50 text-amber-700"
}

function EventSalesStatusSelect({
  eventId,
  value,
  disabled,
}: {
  eventId: string
  value: TicketingSalesStatus
  disabled?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(next: TicketingSalesStatus) {
    setError(null)
    startTransition(async () => {
      try {
        await updateEventTicketingSalesStatus(eventId, next)
        router.refresh()
      } catch (changeError) {
        setError(
          changeError instanceof Error
            ? changeError.message
            : "Could not update status."
        )
      }
    })
  }

  return (
    <div className="space-y-1">
      <Select
        value={value}
        onValueChange={handleChange}
        disabled={disabled || isPending}
      >
        <SelectTrigger
          className={cn(
            "h-8 w-[150px] border text-xs font-medium",
            salesStatusClass(value)
          )}
        >
          <div className="flex items-center gap-1.5">
            {value === "published" ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : null}
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {(
            Object.keys(TICKETING_SALES_STATUS_LABELS) as TicketingSalesStatus[]
          ).map((status) => (
            <SelectItem key={status} value={status}>
              {TICKETING_SALES_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

function EventCategorySelect({
  eventId,
  value,
  categories,
  disabled,
}: {
  eventId: string
  value: string | null
  categories: TicketingEventCategory[]
  disabled?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleChange(next: string) {
    setError(null)
    startTransition(async () => {
      try {
        await setTicketedEventCategory(
          eventId,
          next === UNCATEGORIZED_TICKETING_CATEGORY_VALUE ? null : next
        )
        router.refresh()
      } catch (changeError) {
        setError(
          changeError instanceof Error
            ? changeError.message
            : "Could not update category."
        )
      }
    })
  }

  return (
    <div className="space-y-1">
      <Select
        value={value || UNCATEGORIZED_TICKETING_CATEGORY_VALUE}
        onValueChange={handleChange}
        disabled={disabled || isPending}
      >
        <SelectTrigger className="h-8 w-[180px]">
          <SelectValue placeholder="Uncategorized" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNCATEGORIZED_TICKETING_CATEGORY_VALUE}>
            Uncategorized
          </SelectItem>
          {categories
            .filter((category) => category.is_active || category.id === value)
            .map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function TicketingEventSalesTable({
  events,
  canManage,
  categories,
  emptyMessage = "No events match these filters.",
}: {
  events: TicketedEventOverviewRow[]
  canManage: boolean
  categories?: TicketingEventCategory[]
  emptyMessage?: string
}) {
  const showCategory = Boolean(categories)
  const columnCount = showCategory ? 6 : 5

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[22%]">Event</TableHead>
            {showCategory ? (
              <TableHead className="w-[16%]">Category</TableHead>
            ) : null}
            <TableHead className="w-[14%]">Status</TableHead>
            <TableHead className="w-[16%] text-right">Issued</TableHead>
            <TableHead className="w-[16%] text-right">Remaining</TableHead>
            <TableHead className="w-[16%] text-right">Revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="py-10 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            events.map((event) => {
              const location =
                event.venueName || event.locationLabel || "Location TBD"
              const schedule = formatEventSchedule(event.startAt, event.endAt)
              const progressValue =
                event.ticketsCapacity && event.ticketsCapacity > 0
                  ? Math.min(
                      Math.round(
                        (event.ticketsIssued / event.ticketsCapacity) * 100
                      ),
                      100
                    )
                  : event.ticketsIssued > 0
                    ? 100
                    : 0

              return (
                <TableRow key={event.id}>
                  <TableCell className="align-top whitespace-normal">
                    <div className="min-w-0 space-y-0.5">
                      <Link
                        href={`/event-management/${event.id}`}
                        className="font-medium break-words text-primary hover:underline"
                      >
                        {event.name}
                      </Link>
                      <p className="text-sm break-words text-muted-foreground">
                        {location}
                      </p>
                      <p className="text-sm break-words text-muted-foreground">
                        {schedule}
                      </p>
                    </div>
                  </TableCell>
                  {showCategory && categories ? (
                    <TableCell className="align-top">
                      <EventCategorySelect
                        eventId={event.id}
                        value={event.ticketingCategoryId}
                        categories={categories}
                        disabled={!canManage}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="align-top">
                    <EventSalesStatusSelect
                      eventId={event.id}
                      value={event.salesStatus}
                      disabled={!canManage}
                    />
                  </TableCell>
                  <TableCell className="align-top text-right font-medium">
                    <div className="space-y-2">
                      <span>{event.ticketsIssued}</span>
                      <Progress value={progressValue} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-right font-medium">
                    <div className="space-y-2">
                      <span>
                        {event.ticketsRemaining == null
                          ? "—"
                          : event.ticketsRemaining}
                      </span>
                      <Progress
                        value={100 - progressValue}
                        className="h-2 opacity-40"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-right font-medium">
                    {formatTicketPrice(event.revenueCents, event.currency)}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
