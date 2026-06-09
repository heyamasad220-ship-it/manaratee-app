"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  CheckCircle2,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Ticket,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
          changeError instanceof Error ? changeError.message : "Could not update status."
        )
      }
    })
  }

  return (
    <div className="space-y-1">
      <Select value={value} onValueChange={handleChange} disabled={disabled || isPending}>
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
          {(Object.keys(TICKETING_SALES_STATUS_LABELS) as TicketingSalesStatus[]).map(
            (status) => (
              <SelectItem key={status} value={status}>
                {TICKETING_SALES_STATUS_LABELS[status]}
              </SelectItem>
            )
          )}
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

export function TicketingOverviewTable({
  events,
  canManage,
}: {
  events: TicketedEventOverviewRow[]
  canManage: boolean
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <Ticket className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h3 className="text-lg font-semibold">No ticketed events yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable ticketing on an event in Event Management to start selling tickets.
        </p>
        <Button className="mt-4" asChild>
          <Link href="/event-management">Go to Event Management</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[280px]">Event</TableHead>
            <TableHead className="w-[170px]">Status</TableHead>
            <TableHead className="w-[90px] text-right">Issued</TableHead>
            <TableHead className="w-[110px] text-right">Remaining</TableHead>
            <TableHead className="w-[120px] text-right">Revenue</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const location = event.venueName || event.locationLabel || "Location TBD"
            const schedule = formatEventSchedule(event.startAt, event.endAt)
            const progressValue =
              event.ticketsCapacity && event.ticketsCapacity > 0
                ? Math.min(
                    Math.round((event.ticketsIssued / event.ticketsCapacity) * 100),
                    100
                  )
                : event.ticketsIssued > 0
                  ? 100
                  : 0

            return (
              <TableRow key={event.id}>
                <TableCell>
                  <div className="space-y-0.5">
                    <Link
                      href={`/event-management/${event.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {event.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{location}</p>
                    <p className="text-sm text-muted-foreground">{schedule}</p>
                  </div>
                </TableCell>
                <TableCell>
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
                      {event.ticketsRemaining == null ? "—" : event.ticketsRemaining}
                    </span>
                    <Progress value={100 - progressValue} className="h-2 opacity-40" />
                  </div>
                </TableCell>
                <TableCell className="align-top text-right font-medium">
                  {formatTicketPrice(event.revenueCents, event.currency)}
                </TableCell>
                <TableCell className="align-top">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/event-management/${event.id}/edit`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit event &amp; tickets
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/event-management/ticketing/orders?event=${event.id}`}>
                          View orders
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/event-management/${event.id}`}>
                          Event workspace
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
