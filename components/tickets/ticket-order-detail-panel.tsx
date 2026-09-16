"use client"

import { useEffect, useState, useTransition } from "react"
import { Copy, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { TicketOrderCancelRefundDialog } from "@/components/tickets/ticket-order-cancel-refund-dialog"
import {
  getOrderTickets,
  refundEventTicketOrder,
} from "@/lib/tickets/ticket-order-actions"
import { ticketOrderRemainingCents } from "@/lib/tickets/ticket-refund-math"
import type { TicketOrderListItem, TicketOrderStatus } from "@/lib/tickets/ticket-order-queries"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

function ticketOrderStatusLabel(status: TicketOrderStatus) {
  if (status === "completed") return "Completed"
  if (status === "pending") return "Pending"
  if (status === "canceled") return "Canceled"
  if (status === "refunded") return "Refunded"
  return "Partially refunded"
}

function ticketSeatStatusLabel(status: string) {
  if (status === "checked_in") return "Checked in"
  if (status === "waitlisted") return "Waitlisted"
  if (status === "canceled") return "Canceled"
  if (status === "refunded") return "Refunded"
  return "Valid"
}

export function TicketOrderDetailPanel({
  order,
  open,
  onOpenChange,
  canManage,
  onUpdated,
}: {
  order: TicketOrderListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canManage: boolean
  onUpdated: () => void
}) {
  const [tickets, setTickets] = useState<
    Awaited<ReturnType<typeof getOrderTickets>>
  >([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || !order) {
      setTickets([])
      setCancelOpen(false)
      setActionError(null)
      return
    }

    setLoadingTickets(true)

    void getOrderTickets(order.id)
      .then(setTickets)
      .finally(() => setLoadingTickets(false))
  }, [open, order])

  if (!order) return null

  const displayName = order.purchaserName || "Guest"
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const remainingCents = ticketOrderRemainingCents({
    status: order.status,
    totalCents: order.totalCents,
    refundedAmountCents: order.refundedAmountCents,
  })
  const canCancelOrRefund =
    canManage &&
    order.status !== "canceled" &&
    order.status !== "refunded" &&
    (tickets.some(
      (ticket) =>
        ticket.status === "valid" ||
        ticket.status === "checked_in" ||
        ticket.status === "waitlisted"
    ) ||
      remainingCents > 0)

  function handleConfirmCancel(input: {
    ticketIds: string[]
    amountCents: number
    note: string
    notifyCustomer: boolean
  }) {
    setActionError(null)
    startTransition(async () => {
      const result = await refundEventTicketOrder({
        orderId: order!.id,
        ticketIds: input.ticketIds,
        amountCents: input.amountCents,
        note: input.note,
        notifyCustomer: input.notifyCustomer,
      })
      if (!result.success) {
        setActionError(result.error)
        return
      }
      setCancelOpen(false)
      onUpdated()
      const refreshed = await getOrderTickets(order!.id)
      setTickets(refreshed)
    })
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md"
          onPointerDownOutside={(event) => {
            if (cancelOpen) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (cancelOpen) event.preventDefault()
          }}
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-lg">Order {order.orderNumber}</SheetTitle>
            <SheetDescription className="sr-only">
              Order details for {order.orderNumber}
            </SheetDescription>
            <div className="flex items-center gap-3 pt-1">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{displayName}</p>
                <p className="text-sm text-muted-foreground">{order.purchaserEmail}</p>
              </div>
            </div>
          </SheetHeader>

          <div className="px-4 pb-6">
            <div className="py-4">
              <h3 className="mb-3 font-semibold text-foreground">Order info</h3>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Event</span>
                  <span className="text-right font-medium">{order.eventName}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">
                    {formatTicketPrice(order.totalCents, order.currency)}
                  </span>
                </div>
                {order.refundedAmountCents > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Refunded</span>
                    <span className="font-medium">
                      {formatTicketPrice(order.refundedAmountCents, order.currency)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline">{ticketOrderStatusLabel(order.status)}</Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Order date</span>
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                </div>
                {order.paymentReference ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Transaction ID</span>
                    <span className="flex items-center gap-1 font-medium">
                      {order.paymentReference}
                      <button type="button" className="rounded p-0.5 text-muted-foreground">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                ) : null}
                {order.paymentMethod ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Payment method</span>
                    <span>{order.paymentMethod}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <Separator />

            <div className="py-4">
              <h3 className="mb-3 font-semibold text-foreground">Tickets</h3>
              {loadingTickets ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tickets...
                </div>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets on this order.</p>
              ) : (
                <ul className="space-y-2">
                  {tickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{ticket.ticketTypeName}</p>
                        {ticket.attendeeName ? (
                          <p className="text-xs text-muted-foreground">
                            {ticket.attendeeName}
                          </p>
                        ) : null}
                        <p className="font-mono text-xs text-muted-foreground">
                          {ticket.ticketCode}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {ticketSeatStatusLabel(ticket.status)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canCancelOrRefund ? (
              <Button
                className="w-full"
                variant="outline"
                disabled={isPending || loadingTickets}
                onClick={() => {
                  setActionError(null)
                  setCancelOpen(true)
                }}
              >
                Cancel or refund
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <TicketOrderCancelRefundDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        orderNumber={order.orderNumber}
        orderStatus={order.status}
        totalCents={order.totalCents}
        refundedCents={order.refundedAmountCents}
        currency={order.currency}
        tickets={tickets}
        pending={isPending}
        error={actionError}
        onConfirm={handleConfirmCancel}
      />
    </>
  )
}
