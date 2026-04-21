"use client"

import { Copy, Pencil, RotateCcw, MoreHorizontal, CheckCircle2, ChevronRight } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { OrderStatusBadge } from "@/lib/status-badges"
import type { Order } from "@/lib/mock-data"

interface OrderDetailPanelProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrderDetailPanel({ order, open, onOpenChange }: OrderDetailPanelProps) {
  if (!order) return null

  const initials = order.customer.name
    .split(" ")
    .map((n) => n[0])
    .join("")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">Order ID {order.id}</SheetTitle>
          <SheetDescription className="sr-only">Order details for {order.id}</SheetDescription>
          <div className="flex items-center gap-3 pt-1">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{order.customer.name}</p>
              <p className="text-sm text-muted-foreground">{order.customer.email}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="px-4">
          {/* Action Buttons */}
          <div className="flex items-center gap-2 pb-4">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Edit Details
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Refund Order
            </Button>
            <Button variant="outline" size="icon-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>

          <Separator />

          {/* Order Info */}
          <div className="py-4">
            <h3 className="mb-3 font-semibold text-foreground">Order Info</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Transaction ID</span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {order.transactionId}
                  <button suppressHydrationWarning className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Order Status</span>
                <span className="flex items-center gap-1.5">
                  <OrderStatusBadge status={order.status} />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Order Date</span>
                <span className="text-sm text-foreground">
                  {order.orderDate}, {order.orderTime}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment Method</span>
                <span className="flex items-center gap-1.5 text-sm text-foreground">
                  {order.paymentMethod}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-sm text-muted-foreground">Billing Address</span>
                <span className="text-right text-sm text-foreground">
                  <div>{order.billingAddress.street}</div>
                  <div>
                    {order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.zip}
                  </div>
                  <div>{order.billingAddress.country}</div>
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Order Activity */}
          <div className="py-4">
            <h3 className="mb-3 font-semibold text-foreground">Order Activity</h3>
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Payment. Today at {order.orderTime}
                </p>
                <p className="text-xs text-muted-foreground">
                  Partive {order.paymentMethod} ending in 9578
                </p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </div>

          <Separator />

          {/* Status Checkboxes */}
          <div className="flex flex-col gap-3 py-4">
            {["Completed", "Pending", "Canceled", "Refunded / Partially Refunded", "Incomplete"].map(
              (status) => (
                <label key={status} className="flex items-center gap-3">
                  <Checkbox />
                  <span className="text-sm text-foreground">{status}</span>
                </label>
              )
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-border p-4">
          <Button className="w-full gap-1.5">
            Generate Report
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
