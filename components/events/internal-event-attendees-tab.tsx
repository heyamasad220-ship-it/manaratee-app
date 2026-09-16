"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { setEventTicketCheckIn, promoteWaitlistedTicket, resendEventTicketConfirmation, completePendingEventTicketOrder, refundEventTicketOrder } from "@/lib/tickets/ticket-order-actions"
import type { EventAttendeeListItem } from "@/lib/tickets/ticket-order-queries"
import type { EventTicketType } from "@/lib/tickets/ticket-types"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"
import { InternalEventAttendeeOrderSheet } from "@/components/events/internal-event-attendee-order-sheet"
import { InternalEventAddAttendeeDialog } from "@/components/events/internal-event-add-attendee-dialog"
import { InternalEventTransferAttendeeDialog } from "@/components/events/internal-event-transfer-attendee-dialog"
import { InternalEventRefundDialog } from "@/components/events/internal-event-refund-dialog"
import { TicketCheckInScanner } from "@/components/tickets/ticket-check-in-scanner"
import { ticketOrderRemainingCents } from "@/lib/tickets/ticket-refund-math"
import { formatPhoneDisplay } from "@/lib/ui/format-phone"

function ticketStatusLabel(status: EventAttendeeListItem["status"]) {
  if (status === "checked_in") return "Checked in"
  if (status === "waitlisted") return "Waitlisted"
  if (status === "canceled") return "Canceled"
  if (status === "refunded") return "Refunded"
  return "Registered"
}

function formatWhen(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function attendeeOrderActions(row: EventAttendeeListItem, canManage: boolean) {
  const remainingCents = ticketOrderRemainingCents({
    status: row.orderStatus,
    totalCents: row.orderTotalCents,
    refundedAmountCents: row.orderRefundedCents,
  })
  return {
    canMarkPaid: canManage && row.orderStatus === "pending",
    canRefund:
      canManage &&
      (row.orderStatus === "completed" ||
        row.orderStatus === "partially_refunded") &&
      remainingCents > 0 &&
      row.status !== "refunded" &&
      row.status !== "canceled",
    canTransfer:
      canManage && row.status !== "canceled" && row.status !== "refunded",
    canResend:
      canManage &&
      row.status !== "canceled" &&
      row.status !== "refunded" &&
      Boolean(row.purchaserEmail || row.attendeeEmail),
  }
}

export function InternalEventAttendeesTab({
  eventId,
  attendees,
  ticketTypes: registrationOfferings = [],
  canManage = false,
  canCheckIn = false,
  waitlistEnabled = false,
}: {
  eventId: string
  attendees: EventAttendeeListItem[]
  ticketTypes?: EventTicketType[]
  canManage?: boolean
  canCheckIn?: boolean
  waitlistEnabled?: boolean
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState<EventAttendeeListItem | null>(null)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "active" | "all" | "checked_in" | "not_checked_in" | "canceled" | "waitlisted"
  >("active")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [refundTarget, setRefundTarget] = useState<EventAttendeeListItem | null>(null)
  const [orderTargetId, setOrderTargetId] = useState<string | null>(null)

  const ticketTypeFilterOptions = useMemo(() => {
    const names = new Set<string>()
    for (const row of attendees) {
      if (row.ticketTypeName) names.add(row.ticketTypeName)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [attendees])

  const counters = useMemo(() => {
    const registered = attendees.filter(
      (row) => row.status === "valid" || row.status === "checked_in"
    ).length
    const checkedIn = attendees.filter((row) => row.status === "checked_in").length
    const canceled = attendees.filter(
      (row) => row.status === "canceled" || row.status === "refunded"
    ).length
    return {
      registered,
      checkedIn,
      notCheckedIn: registered - checkedIn,
      canceled,
      waitlisted: attendees.filter((row) => row.status === "waitlisted").length,
    }
  }, [attendees])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return attendees.filter((row) => {
      if (statusFilter === "active") {
        if (row.status !== "valid" && row.status !== "checked_in") return false
      } else if (statusFilter === "checked_in") {
        if (row.status !== "checked_in") return false
      } else if (statusFilter === "not_checked_in") {
        if (row.status !== "valid") return false
      } else if (statusFilter === "canceled") {
        if (row.status !== "canceled" && row.status !== "refunded") return false
      } else if (statusFilter === "waitlisted") {
        if (row.status !== "waitlisted") return false
      }

      if (typeFilter !== "all" && row.ticketTypeName !== typeFilter) return false

      if (!q) return true
      const haystack = [
        row.attendeeName,
        row.attendeeEmail,
        row.purchaserName,
        row.purchaserEmail,
        row.purchaserPhone,
        row.ticketTypeName,
        row.ticketCode,
        row.orderNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [attendees, search, statusFilter, typeFilter])

  const orderTarget = useMemo(
    () => attendees.find((row) => row.id === orderTargetId) ?? null,
    [attendees, orderTargetId]
  )
  const orderTickets = useMemo(
    () =>
      orderTarget
        ? attendees.filter((row) => row.orderId === orderTarget.orderId)
        : [],
    [attendees, orderTarget]
  )
  const orderActions = orderTarget
    ? attendeeOrderActions(orderTarget, canManage)
    : null

  function handleResend(ticketId: string) {
    setError(null)
    setScanMessage(null)
    startTransition(async () => {
      const result = await resendEventTicketConfirmation({ ticketId })
      if (!result.success) {
        setError(result.error)
        return
      }
      if (!result.configured) {
        setError(
          "Transactional email is not configured, so the confirmation was not sent. Ask an administrator to connect the email provider, then try again."
        )
        return
      }
      if (!result.sent) {
        setError("Could not send the confirmation email.")
        return
      }
      setScanMessage("Confirmation email sent.")
    })
  }

  function handleMarkPaid(orderId: string) {
    setError(null)
    setScanMessage(null)
    startTransition(async () => {
      const result = await completePendingEventTicketOrder({ orderId })
      if (!result.success) {
        setError(result.error)
        return
      }
      setScanMessage("Order marked as paid.")
      router.refresh()
    })
  }

  function handleRefund(row: EventAttendeeListItem) {
    setError(null)
    setScanMessage(null)
    setRefundTarget(row)
  }

  function confirmRefund(amountCents: number) {
    const target = refundTarget
    if (!target) return
    const remaining = ticketOrderRemainingCents({
      status: target.orderStatus,
      totalCents: target.orderTotalCents,
      refundedAmountCents: target.orderRefundedCents,
    })
    setError(null)
    setScanMessage(null)
    startTransition(async () => {
      const result = await refundEventTicketOrder({
        orderId: target.orderId,
        amountCents,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setScanMessage(
        amountCents >= remaining
          ? "Order refunded. Tickets are no longer valid."
          : "Partial refund issued. Tickets remain valid."
      )
      setRefundTarget(null)
      router.refresh()
    })
  }

  function handlePromote(ticketId: string) {
    setError(null)
    startTransition(async () => {
      const result = await promoteWaitlistedTicket({ ticketId })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleCheckIn(ticketId: string, checkedIn: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await setEventTicketCheckIn({ ticketId, checkedIn })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Registered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{counters.registered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Checked in
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{counters.checkedIn}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Not checked in
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{counters.notCheckedIn}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Canceled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{counters.canceled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Waitlisted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{counters.waitlisted}</p>
          </CardContent>
        </Card>
      </div>

      {canCheckIn ? (
        <div className="shrink-0">
          <TicketCheckInScanner
            eventId={eventId}
            onCheckedIn={() => router.refresh()}
          />
        </div>
      ) : null}

      {scanMessage ? (
        <p className="shrink-0 text-sm text-emerald-700">{scanMessage}</p>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0 flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Orders
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              People attending from paid or free tickets.
              {waitlistEnabled
                ? " Waitlist is enabled — promote people manually from waitlisted orders when capacity opens."
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && registrationOfferings.length > 0 ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => setAddOpen(true)}
              >
                Add attendee
              </Button>
            ) : null}
            {canManage ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/event-management/reports/orders?event=${eventId}`}>
                  View orders
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
          <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              placeholder="Search name, email, ticket, order…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="lg:max-w-sm"
            />
            <Select
              value={statusFilter}
              onValueChange={(next) =>
                setStatusFilter(
                  next as
                    | "active"
                    | "all"
                    | "checked_in"
                    | "not_checked_in"
                    | "canceled"
                    | "waitlisted"
                )
              }
            >
              <SelectTrigger className="lg:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="checked_in">Checked in</SelectItem>
                <SelectItem value="not_checked_in">Not checked in</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                {waitlistEnabled ? (
                  <SelectItem value="waitlisted">Waitlisted</SelectItem>
                ) : null}
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="lg:w-[200px]">
                <SelectValue placeholder="Ticket type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ticketTypeFilterOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {filtered.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {attendees.length === 0
                ? "No orders yet. Orders and free tickets will appear here."
                : "No orders match your filters."}
            </p>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
              <Table containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-background [&_th]:bg-background">
                  <TableRow>
                    <TableHead>Attendee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Contact</TableHead>
                    {canManage || canCheckIn ? <TableHead className="w-[140px]" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const name = row.attendeeName || "Guest"
                    const purchaserPhone = formatPhoneDisplay(row.purchaserPhone)
                    const canToggleCheckIn =
                      canCheckIn &&
                      (row.status === "valid" || row.status === "checked_in")
                    const canPromote =
                      canManage && waitlistEnabled && row.status === "waitlisted"
                    const showRowActions = canToggleCheckIn || canPromote
                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setOrderTargetId(row.id)}
                      >
                        <TableCell>
                          <div className="font-medium">{name}</div>
                          {row.ticketCode ? (
                            <div className="text-xs text-muted-foreground">
                              {row.ticketCode}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>{row.ticketTypeName}</TableCell>
                        <TableCell>
                          {row.ticketTypePriceCents === 0
                            ? "Free"
                            : formatTicketPrice(
                                row.ticketTypePriceCents,
                                row.currency
                              )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {ticketStatusLabel(row.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatWhen(row.checkedInAt)}
                        </TableCell>
                        <TableCell>
                          {row.contactId && row.purchaserName ? (
                            <Link
                              href={contactProfileHref(row.contactId)}
                              prefetch={false}
                              className="font-medium text-primary hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {row.purchaserName}
                            </Link>
                          ) : (
                            <div className="font-medium">
                              {row.purchaserName || "—"}
                            </div>
                          )}
                          {row.purchaserEmail ? (
                            <div className="text-xs text-muted-foreground">
                              {row.purchaserEmail}
                            </div>
                          ) : null}
                          {purchaserPhone ? (
                            <div className="text-xs text-muted-foreground">
                              {purchaserPhone}
                            </div>
                          ) : null}
                        </TableCell>
                        {canManage || canCheckIn ? (
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            {showRowActions ? (
                              <div className="flex flex-wrap justify-end gap-2">
                                {canPromote ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={isPending}
                                    onClick={() => handlePromote(row.id)}
                                  >
                                    Promote
                                  </Button>
                                ) : null}
                                {canToggleCheckIn ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isPending}
                                    onClick={() =>
                                      handleCheckIn(
                                        row.id,
                                        row.status !== "checked_in"
                                      )
                                    }
                                  >
                                    {row.status === "checked_in"
                                      ? "Undo"
                                      : "Check in"}
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InternalEventAttendeeOrderSheet
        open={orderTarget != null}
        onOpenChange={(open) => {
          if (!open) setOrderTargetId(null)
        }}
        attendee={orderTarget}
        orderTickets={orderTickets}
        canManage={canManage}
        isPending={isPending}
        canRefund={orderActions?.canRefund ?? false}
        canTransfer={orderActions?.canTransfer ?? false}
        canResend={orderActions?.canResend ?? false}
        canMarkPaid={orderActions?.canMarkPaid ?? false}
        lockOpen={refundTarget != null || transferTarget != null}
        onSelectTicket={(ticket) => setOrderTargetId(ticket.id)}
        onRefund={() => {
          if (orderTarget) handleRefund(orderTarget)
        }}
        onTransfer={() => {
          if (orderTarget) setTransferTarget(orderTarget)
        }}
        onResend={() => {
          if (orderTarget) handleResend(orderTarget.id)
        }}
        onMarkPaid={() => {
          if (orderTarget) handleMarkPaid(orderTarget.orderId)
        }}
      />

      <InternalEventAddAttendeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        eventId={eventId}
        ticketTypes={registrationOfferings}
        waitlistEnabled={waitlistEnabled}
        onAdded={() => router.refresh()}
      />

      <InternalEventTransferAttendeeDialog
        open={transferTarget != null}
        onOpenChange={(open) => {
          if (!open) setTransferTarget(null)
        }}
        attendee={transferTarget}
        onTransferred={() => router.refresh()}
      />

      <InternalEventRefundDialog
        open={refundTarget != null}
        onOpenChange={(open) => {
          if (!open) setRefundTarget(null)
        }}
        orderNumber={refundTarget?.orderNumber || ""}
        totalCents={refundTarget?.orderTotalCents || 0}
        refundedCents={refundTarget?.orderRefundedCents || 0}
        currency={refundTarget?.currency || "USD"}
        pending={isPending}
        error={error}
        onConfirm={confirmRefund}
      />
    </div>
  )
}
