"use client"

import { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { OrderStatusBadge } from "@/lib/status-badges"
import { OrderDetailPanel } from "./order-detail-panel"
import { GenerateReportModal } from "./generate-report-modal"
import { orders, type Order } from "@/lib/mock-data"

export function OrdersTable() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = orders.filter((order) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      order.id.toLowerCase().includes(q) ||
      order.customer.name.toLowerCase().includes(q) ||
      order.customer.email.toLowerCase().includes(q) ||
      order.transactionId.toLowerCase().includes(q)
    )
  })

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order)
    setDetailOpen(true)
  }

  return (
    <>
      {/* Search + Filters + Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Name, Email, Transaction ID, Ticket Code"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-card pl-9"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-[130px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="spring-gala">Spring Gala</SelectItem>
            <SelectItem value="tech-expo">Tech Expo 2026</SelectItem>
          </SelectContent>
        </Select>
        <Button className="gap-1.5">
          <span className="mr-0.5">+</span> New Ticket
        </Button>
        <Button variant="outline" className="gap-1.5">
          Export <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Table Header Row */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">All Tickets</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {filtered.length} tickets
          </span>
          <span className="text-sm text-foreground font-medium">253 tickets</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon-sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-medium text-muted-foreground">Ticket ID</TableHead>
              <TableHead className="font-medium text-muted-foreground">Customer</TableHead>
              <TableHead className="font-medium text-muted-foreground">Event</TableHead>
              <TableHead className="font-medium text-muted-foreground">
                Date <ChevronDown className="ml-1 inline h-3 w-3" />
              </TableHead>
              <TableHead className="text-right font-medium text-muted-foreground">Total</TableHead>
              <TableHead className="font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((order, idx) => (
              <TableRow
                key={`${order.id}-${idx}`}
                className="group cursor-pointer"
                onClick={() => handleRowClick(order)}
              >
                <TableCell className="font-medium text-primary">{order.id}</TableCell>
                <TableCell>
                  <div className="font-medium text-primary">{order.customer.name}</div>
                  <div className="text-xs text-muted-foreground">{order.customer.email}</div>
                </TableCell>
                <TableCell>
                  <div className="text-foreground">{order.event}</div>
                  <div className="text-xs text-muted-foreground">{order.paymentMethod}</div>
                </TableCell>
                <TableCell>
                  <div className="text-foreground">{order.orderDate}</div>
                  <div className="text-xs text-muted-foreground">{order.orderTime}</div>
                </TableCell>
                <TableCell className="text-right font-medium text-foreground">
                  ${order.total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell>
                  <button
                    suppressHydrationWarning
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Generate Report Button */}
      <div className="flex justify-end">
        <Button onClick={() => setReportOpen(true)} className="gap-1.5">
          Generate Report <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Side Panel */}
      <OrderDetailPanel
        order={selectedOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* Report Modal */}
      <GenerateReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </>
  )
}
