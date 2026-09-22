"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { CreateTicketOrderDialog } from "@/components/tickets/create-ticket-order-dialog"
import { TicketOrderDetailPanel } from "@/components/tickets/ticket-order-detail-panel"
import { formatEventSchedule } from "@/lib/tickets/ticketing-overview-types"
import {
  type TicketOrderListItem,
  type TicketOrderStatus,
  type TicketedEventOption,
} from "@/lib/tickets/ticket-order-queries"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"
import {
  clampPage,
  getListPageCount,
  getListPageRange,
  getVisiblePageNumbers,
  slicePageItems,
} from "@/lib/ui/list-pagination"
import { cn } from "@/lib/utils"

const ORDERS_PAGE_SIZE = 50

function ticketOrderStatusLabel(status: TicketOrderStatus) {
  if (status === "completed") return "Completed"
  if (status === "pending") return "Pending"
  if (status === "canceled") return "Canceled"
  if (status === "refunded") return "Refunded"
  return "Partially refunded"
}

function ticketOrderStatusClass(status: TicketOrderStatus) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700 border-emerald-200"
  if (status === "pending") return "bg-amber-100 text-amber-700 border-amber-200"
  if (status === "canceled") return "bg-red-100 text-red-700 border-red-200"
  return "bg-violet-100 text-violet-700 border-violet-200"
}

function formatOrderDateTime(value: string) {
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

function formatEventDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatEventFilterLabel(event: TicketedEventOption) {
  return `${formatEventSchedule(event.startAt, event.endAt)}: ${event.name}`
}

function parseInitialSelectedEventIds(
  value: string | undefined,
  events: TicketedEventOption[]
) {
  if (!value || value === "all" || value === "active" || value === "past") {
    return []
  }
  const known = new Set(events.map((event) => event.id))
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => known.has(id))
}

function eventFilterLabel(
  selectedIds: string[],
  events: TicketedEventOption[]
) {
  if (selectedIds.length === 0) return "All events"
  if (selectedIds.length === 1) {
    const selected = events.find((event) => event.id === selectedIds[0])
    return selected ? formatEventFilterLabel(selected) : "1 event"
  }
  return `${selectedIds.length} events`
}

function exportOrdersCsv(orders: TicketOrderListItem[]) {
  if (orders.length === 0) return

  const rows = orders.map((order) => ({
    order_id: order.orderNumber,
    status: ticketOrderStatusLabel(order.status),
    purchaser_name: order.purchaserName ?? "",
    purchaser_email: order.purchaserEmail,
    order_date: formatOrderDateTime(order.createdAt),
    event: order.eventName,
    venue: order.eventVenueName ?? "",
    value: formatTicketPrice(order.totalCents, order.currency),
    payment_method: order.paymentMethod ?? "",
    payment_reference: order.paymentReference ?? "",
    ticket_count: order.ticketCount,
    ticket_codes: order.ticketCodes.join("; "),
  }))

  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header as keyof typeof row])).join(",")),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = `ticket-orders-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()

  URL.revokeObjectURL(url)
}

type TicketingOrdersClientProps = {
  orders: TicketOrderListItem[]
  events: TicketedEventOption[]
  initialEventFilter?: string
  canManage: boolean
}

export function TicketingOrdersClient({
  orders,
  events,
  initialEventFilter,
  canManage,
}: TicketingOrdersClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>(() =>
    parseInitialSelectedEventIds(initialEventFilter, events)
  )
  const [statusFilter, setStatusFilter] = useState<TicketOrderStatus | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedOrder, setSelectedOrder] = useState<TicketOrderListItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [eventsOpen, setEventsOpen] = useState(false)

  useEffect(() => {
    if (!selectedOrder) return
    const next = orders.find((order) => order.id === selectedOrder.id)
    if (next && next !== selectedOrder) setSelectedOrder(next)
  }, [orders, selectedOrder])

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.id)),
    [orders, selectedIds]
  )
  const hasSelection = selectedIds.length > 0

  const filtered = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()
    const eventIds = new Set(selectedEventIds)

    return orders.filter((order) => {
      if (eventIds.size > 0 && !eventIds.has(order.eventId)) return false
      if (statusFilter !== "all" && order.status !== statusFilter) return false

      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00`)
        if (new Date(order.createdAt) < from) return false
      }

      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59.999`)
        if (new Date(order.createdAt) > to) return false
      }

      if (!search) return true

      return (
        order.orderNumber.toLowerCase().includes(search) ||
        order.purchaserName?.toLowerCase().includes(search) ||
        order.purchaserEmail.toLowerCase().includes(search) ||
        order.paymentReference?.toLowerCase().includes(search) ||
        order.eventName.toLowerCase().includes(search) ||
        order.ticketCodes.some((code) => code.toLowerCase().includes(search))
      )
    })
  }, [dateFrom, dateTo, orders, searchQuery, selectedEventIds, statusFilter])

  const totalPages = getListPageCount(filtered.length, ORDERS_PAGE_SIZE)
  const currentPage = clampPage(page, totalPages)
  const pageItems = slicePageItems(filtered, currentPage, ORDERS_PAGE_SIZE)
  const range = getListPageRange(currentPage, ORDERS_PAGE_SIZE, filtered.length)
  const pageNumbers = getVisiblePageNumbers(currentPage, totalPages)

  useEffect(() => {
    setPage(1)
  }, [searchQuery, selectedEventIds, statusFilter, dateFrom, dateTo])

  const allSelected =
    pageItems.length > 0 && pageItems.every((order) => selectedIds.includes(order.id))

  function toggleAll(checked: boolean) {
    const pageIds = pageItems.map((order) => order.id)
    if (!checked) {
      setSelectedIds((current) => current.filter((id) => !pageIds.includes(id)))
      return
    }
    setSelectedIds((current) => [...new Set([...current, ...pageIds])])
  }

  function toggleEvent(eventId: string, checked: boolean) {
    setSelectedEventIds((current) =>
      checked ? [...current, eventId] : current.filter((id) => id !== eventId)
    )
  }

  function toggleOne(orderId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, orderId] : current.filter((id) => id !== orderId)
    )
  }

  function handleExport() {
    exportOrdersCsv(hasSelection ? selectedOrders : filtered)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Manage orders</h2>
          <p className="text-sm text-muted-foreground">
            Search, filter, and manually add ticket orders.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add new order
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, email, transaction ID, or ticket code"
              className="pl-9"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label>Events</Label>
              <Popover open={eventsOpen} onOpenChange={setEventsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={eventsOpen}
                    className={cn(
                      "h-10 w-full justify-between font-normal",
                      selectedEventIds.length === 0 && "text-muted-foreground"
                    )}
                  >
                    <span className="truncate">
                      {eventFilterLabel(selectedEventIds, events)}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[min(36rem,calc(100vw-2rem))] p-0"
                  align="start"
                >
                  {selectedEventIds.length > 0 ? (
                    <div className="flex items-center justify-between border-b px-3 py-2">
                      <p className="text-sm text-muted-foreground">
                        {selectedEventIds.length} selected
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setSelectedEventIds([])}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : null}
                  <div className="max-h-80 overflow-y-auto p-2">
                    {events.length === 0 ? (
                      <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No ticketed events.
                      </p>
                    ) : (
                      events.map((event) => {
                        const checked = selectedEventIds.includes(event.id)
                        return (
                          <label
                            key={event.id}
                            className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted"
                          >
                            <Checkbox
                              className="mt-0.5"
                              checked={checked}
                              onCheckedChange={(next) =>
                                toggleEvent(event.id, next === true)
                              }
                            />
                            <span className="text-sm leading-5">
                              {formatEventFilterLabel(event)}
                            </span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-date-from">Order date from</Label>
              <Input
                id="order-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-date-to">Order date to</Label>
              <Input
                id="order-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Order status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as TicketOrderStatus | "all")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All orders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All orders</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="partially_refunded">Partially refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canManage ? (
              <div className="space-y-2">
                <Label>Actions</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Actions
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      disabled={filtered.length === 0}
                      onClick={handleExport}
                    >
                      Export
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length === 0
          ? "0 orders"
          : `Showing ${range.start.toLocaleString()}–${range.end.toLocaleString()} of ${filtered.length.toLocaleString()} order${filtered.length === 1 ? "" : "s"}`}
        {hasSelection ? ` · ${selectedIds.length} selected` : ""}
      </p>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {canManage ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                </TableHead>
              ) : null}
              <TableHead>Order ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Date/Time</TableHead>
              <TableHead className="min-w-[240px]">Event</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 7 : 6}
                  className="py-12 text-center text-muted-foreground"
                >
                  {orders.length === 0
                    ? "No orders yet. Add a manual order or wait for ticket sales."
                    : "No orders match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((order) => {
                const eventDate = formatEventDate(order.eventStartAt)
                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedOrder(order)
                      setDetailOpen(true)
                    }}
                  >
                    {canManage ? (
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(order.id)}
                          onCheckedChange={(checked) =>
                            toggleOne(order.id, checked === true)
                          }
                        />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedOrder(order)
                          setDetailOpen(true)
                        }}
                      >
                        {order.orderNumber}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ticketOrderStatusClass(order.status)}
                      >
                        {ticketOrderStatusLabel(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.purchaserName || "Guest"}</TableCell>
                    <TableCell>{formatOrderDateTime(order.createdAt)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{order.eventName}</div>
                      {order.eventVenueName ? (
                        <div className="text-sm text-muted-foreground">
                          {order.eventVenueName}
                        </div>
                      ) : null}
                      {eventDate ? (
                        <div className="text-sm text-muted-foreground">{eventDate}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatTicketPrice(order.totalCents, order.currency)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            {pageNumbers.map((pageNumber) => (
              <Button
                key={pageNumber}
                type="button"
                variant={pageNumber === currentPage ? "outline" : "ghost"}
                size="sm"
                className="min-w-9"
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <CreateTicketOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        events={events}
        onCreated={() => router.refresh()}
      />

      <TicketOrderDetailPanel
        order={selectedOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canManage={canManage}
        onUpdated={() => router.refresh()}
      />
    </div>
  )
}
