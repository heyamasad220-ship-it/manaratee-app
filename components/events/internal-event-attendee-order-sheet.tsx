"use client"

import Link from "next/link"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import type { EventAttendeeListItem } from "@/lib/tickets/ticket-order-queries"
import { ticketOrderRemainingCents } from "@/lib/tickets/ticket-refund-math"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"
import { formatPhoneDisplay } from "@/lib/ui/format-phone"

function ticketStatusLabel(status: EventAttendeeListItem["status"]) {
  if (status === "checked_in") return "Checked in"
  if (status === "waitlisted") return "Waitlisted"
  if (status === "canceled") return "Canceled"
  if (status === "refunded") return "Refunded"
  return "Registered"
}

function orderStatusLabel(status: EventAttendeeListItem["orderStatus"]) {
  if (status === "completed") return "Completed"
  if (status === "pending") return "Payment pending"
  if (status === "canceled") return "Canceled"
  if (status === "refunded") return "Refunded"
  return "Partially refunded"
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatWhen(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function InternalEventAttendeeOrderSheet({
  open,
  onOpenChange,
  attendee,
  orderTickets,
  canManage = false,
  isPending = false,
  canRefund = false,
  canTransfer = false,
  canResend = false,
  canMarkPaid = false,
  lockOpen = false,
  onSelectTicket,
  onRefund,
  onTransfer,
  onResend,
  onMarkPaid,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  attendee: EventAttendeeListItem | null
  orderTickets: EventAttendeeListItem[]
  canManage?: boolean
  isPending?: boolean
  canRefund?: boolean
  canTransfer?: boolean
  canResend?: boolean
  canMarkPaid?: boolean
  lockOpen?: boolean
  onSelectTicket: (ticket: EventAttendeeListItem) => void
  onRefund: () => void
  onTransfer: () => void
  onResend: () => void
  onMarkPaid: () => void
}) {
  if (!attendee) return null

  const contactName = attendee.purchaserName || "Guest"
  const contactPhone = formatPhoneDisplay(attendee.purchaserPhone)
  const remainingCents = ticketOrderRemainingCents({
    status: attendee.orderStatus,
    totalCents: attendee.orderTotalCents,
    refundedAmountCents: attendee.orderRefundedCents,
  })
  const showActions =
    canManage && (canRefund || canTransfer || canResend || canMarkPaid)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
        onPointerDownOutside={(event) => {
          if (lockOpen) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (lockOpen) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (lockOpen) event.preventDefault()
        }}
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">Order {attendee.orderNumber}</SheetTitle>
          <SheetDescription className="sr-only">
            Order details and actions for {attendee.orderNumber}
          </SheetDescription>
          <Badge variant="outline" className="w-fit">
            {orderStatusLabel(attendee.orderStatus)}
          </Badge>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <div>
            <h3 className="mb-3 font-semibold text-foreground">Contact</h3>
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                  {initialsFor(contactName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                {attendee.contactId && attendee.purchaserName ? (
                  <Link
                    href={contactProfileHref(attendee.contactId)}
                    prefetch={false}
                    className="font-medium text-primary hover:underline"
                  >
                    {attendee.purchaserName}
                  </Link>
                ) : (
                  <p className="font-medium text-foreground">{contactName}</p>
                )}
                {attendee.purchaserEmail ? (
                  <p className="text-sm text-muted-foreground">
                    {attendee.purchaserEmail}
                  </p>
                ) : null}
                {contactPhone ? (
                  <p className="text-sm text-muted-foreground">{contactPhone}</p>
                ) : null}
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 font-semibold text-foreground">Order</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-sm font-medium text-foreground">
                  {formatTicketPrice(attendee.orderTotalCents, attendee.currency)}
                </span>
              </div>
              {attendee.orderRefundedCents > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Refunded</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatTicketPrice(
                      attendee.orderRefundedCents,
                      attendee.currency
                    )}
                  </span>
                </div>
              ) : null}
              {attendee.orderRefundedCents > 0 && remainingCents > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Remaining</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatTicketPrice(remainingCents, attendee.currency)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Tickets</span>
                <span className="text-sm text-foreground">{orderTickets.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Order date</span>
                <span className="text-sm text-foreground">
                  {formatWhen(attendee.orderCreatedAt || attendee.createdAt)}
                </span>
              </div>
              {attendee.paymentMethod ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Payment method</span>
                  <span className="text-sm text-foreground">
                    {attendee.paymentMethod}
                  </span>
                </div>
              ) : null}
              {attendee.paymentReference ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Payment reference</span>
                  <span className="break-all text-right text-sm font-medium text-foreground">
                    {attendee.paymentReference}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 font-semibold text-foreground">Tickets</h3>
            <div className="space-y-2">
              {orderTickets.map((ticket) => {
                const selected = ticket.id === attendee.id
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    className={`w-full rounded-md border px-3 py-2 text-left ${
                      selected ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => onSelectTicket(ticket)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {ticket.attendeeName || "Guest"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ticket.ticketTypeName}
                          {ticket.ticketCode ? ` · ${ticket.ticketCode}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">
                          {ticketStatusLabel(ticket.status)}
                        </Badge>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {ticket.ticketTypePriceCents === 0
                            ? "Free"
                            : formatTicketPrice(
                                ticket.ticketTypePriceCents,
                                ticket.currency
                              )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {showActions ? (
          <div className="mt-auto space-y-2 border-t border-border p-4">
            {canMarkPaid ? (
              <Button
                type="button"
                className="w-full"
                variant="outline"
                disabled={isPending}
                onClick={onMarkPaid}
              >
                Mark paid
              </Button>
            ) : null}
            {canRefund ? (
              <Button
                type="button"
                className="w-full"
                variant="outline"
                disabled={isPending}
                onClick={onRefund}
              >
                Refund
              </Button>
            ) : null}
            {canTransfer ? (
              <Button
                type="button"
                className="w-full"
                variant="outline"
                disabled={isPending}
                onClick={onTransfer}
              >
                Transfer
              </Button>
            ) : null}
            {canResend ? (
              <Button
                type="button"
                className="w-full"
                variant="outline"
                disabled={isPending}
                onClick={onResend}
              >
                Resend confirmation
              </Button>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
