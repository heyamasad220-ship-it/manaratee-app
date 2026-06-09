"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, MoreHorizontal, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { OrderDetailPanel } from "./order-detail-panel"
import { GenerateReportModal } from "./generate-report-modal"
import type {
  TicketOrderListItem,
  TicketedEventOption,
} from "@/lib/tickets/ticket-order-queries"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

function ticketOrderStatusLabel(status: TicketOrderListItem["status"]) {
  if (status === "completed") return "Completed"
  if (status === "pending") return "Pending"
  if (status === "canceled") return "Canceled"
  if (status === "refunded") return "Refunded"
  return "Partially refunded"
}

function ticketOrderStatusClass(status: TicketOrderListItem["status"]) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700 border-emerald-200"
  if (status === "pending") return "bg-amber-100 text-amber-700 border-amber-200"
  if (status === "canceled") return "bg-red-100 text-red-700 border-red-200"
  return "bg-violet-100 text-violet-700 border-violet-200"
}

function formatOrderDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: "—", time: "" }
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  }
}

export function OrdersTable({
  orders,
  events,
}: {
  orders: TicketOrderListItem[]
  events: TicketedEventOption[]
}) {
  const [selectedOrder, setSelectedOrder] = useState<TicketOrderListItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [eventFilter, setEventFilter] = useState("all")

  const filtered = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()
    return orders.filter((order) => {
      if (eventFilter !== "all" && order.eventId !== eventFilter) return false
      if (!search) return true
      return (
        order.orderNumber.toLowerCase().includes(search) ||
        order.purchaserName?.toLowerCase().includes(search) ||
        order.purchaserEmail.toLowerCase().includes(search) ||
        order.paymentReference?.toLowerCase().includes(search) ||
        order.eventName.toLowerCase().includes(search)
      )
    })
  }, [eventFilter, orders, searchQuery])

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Name, email, order number, or payment reference"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="bg-card pl-9"
          />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[220px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ticketed events</SelectItem>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-1.5" disabled>
          Export <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">All orders</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{filtered.length} orders</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon-sm" disabled>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-medium text-muted-foreground">Order</TableHead>
              <TableHead className="font-medium text-muted-foreground">Customer</TableHead>
              <TableHead className="font-medium text-muted-foreground">Event</TableHead>
              <TableHead className="font-medium text-muted-foreground">Date</TableHead>
              <TableHead className="text-right font-medium text-muted-foreground">Total</TableHead>
              <TableHead className="font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {orders.length === 0
                    ? "No ticket orders yet. Enable ticketing on an event and start selling tickets."
                    : "No orders match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => {
                const formatted = formatOrderDate(order.createdAt)
                return (
                  <TableRow
                    key={order.id}
                    className="group cursor-pointer"
                    onClick={() => {
                      setSelectedOrder(order)
                      setDetailOpen(true)
                    }}
                  >
                    <TableCell className="font-medium text-primary">{order.orderNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium text-primary">
                        {order.purchaserName || "Guest"}
                      </div>
                      <div className="text-xs text-muted-foreground">{order.purchaserEmail}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-foreground">{order.eventName}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.ticketCount} ticket{order.ticketCount === 1 ? "" : "s"}
                        {order.paymentMethod ? ` · ${order.paymentMethod}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-foreground">{formatted.date}</div>
                      <div className="text-xs text-muted-foreground">{formatted.time}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {formatTicketPrice(order.totalCents, order.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${ticketOrderStatusClass(order.status)}`}
                      >
                        {ticketOrderStatusLabel(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        suppressHydrationWarning
                        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {events.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Ticketed events are managed in{" "}
          <Link href="/event-management" className="text-primary hover:underline">
            Event Management
          </Link>
          .
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={() => setReportOpen(true)} className="gap-1.5" disabled={orders.length === 0}>
          Generate Report <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <OrderDetailPanel order={selectedOrder} open={detailOpen} onOpenChange={setDetailOpen} />
      <GenerateReportModal open={reportOpen} onOpenChange={setReportOpen} />
    </>
  )
}
