"use client"

import { Copy, ChevronRight } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { TicketOrderListItem } from "@/lib/tickets/ticket-order-queries"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

interface OrderDetailPanelProps {
  order: TicketOrderListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ticketOrderStatusLabel(status: TicketOrderListItem["status"]) {
  if (status === "completed") return "Completed"
  if (status === "pending") return "Pending"
  if (status === "canceled") return "Canceled"
  if (status === "refunded") return "Refunded"
  return "Partially refunded"
}

export function OrderDetailPanel({ order, open, onOpenChange }: OrderDetailPanelProps) {
  if (!order) return null

  const displayName = order.purchaserName || "Guest"
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

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

        <div className="px-4">
          <div className="py-4">
            <h3 className="mb-3 font-semibold text-foreground">Order info</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Event</span>
                <span className="text-sm font-medium text-foreground">{order.eventName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tickets</span>
                <span className="text-sm text-foreground">{order.ticketCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-sm font-medium text-foreground">
                  {formatTicketPrice(order.totalCents, order.currency)}
                </span>
              </div>
              {order.refundedAmountCents > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Refunded</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatTicketPrice(order.refundedAmountCents, order.currency)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline">{ticketOrderStatusLabel(order.status)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Order date</span>
                <span className="text-sm text-foreground">
                  {new Date(order.createdAt).toLocaleString()}
                </span>
              </div>
              {order.paymentReference ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment reference</span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    {order.paymentReference}
                    <button
                      suppressHydrationWarning
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              ) : null}
              {order.paymentMethod ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment method</span>
                  <span className="text-sm text-foreground">{order.paymentMethod}</span>
                </div>
              ) : null}
            </div>
          </div>

          <Separator />

          <div className="py-4 text-sm text-muted-foreground">
            Staff can issue full or partial refunds from the event Orders tab.
          </div>
        </div>

        <div className="mt-auto border-t border-border p-4">
          <Button className="w-full gap-1.5" disabled>
            Generate Report
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
