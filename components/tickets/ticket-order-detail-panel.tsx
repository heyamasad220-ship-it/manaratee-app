"use client"

import { useEffect, useState, useTransition } from "react"
import { Copy, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  getOrderTickets,
  updateTicketOrderStatus,
} from "@/lib/tickets/ticket-order-actions"
import type { TicketOrderListItem, TicketOrderStatus } from "@/lib/tickets/ticket-order-queries"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

function ticketOrderStatusLabel(status: TicketOrderStatus) {
  if (status === "completed") return "Completed"
  if (status === "pending") return "Pending"
  if (status === "canceled") return "Canceled"
  if (status === "refunded") return "Refunded"
  return "Partially refunded"
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
  const [status, setStatus] = useState<TicketOrderStatus>("pending")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || !order) {
      setTickets([])
      return
    }

    setStatus(order.status)
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

  function handleStatusSave(nextStatus: TicketOrderStatus) {
    setStatus(nextStatus)
    startTransition(async () => {
      await updateTicketOrderStatus(order!.id, nextStatus)
      onUpdated()
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
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
              <div className="space-y-2">
                <Label>Order status</Label>
                {canManage ? (
                  <Select value={status} onValueChange={handleStatusSave} disabled={isPending}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                      <SelectItem value="partially_refunded">Partially refunded</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline">{ticketOrderStatusLabel(order.status)}</Badge>
                )}
              </div>
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
                      <p className="font-mono text-xs text-muted-foreground">
                        {ticket.ticketCode}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {ticket.status.replace(/_/g, " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
