"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, MoreHorizontal, Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import {
  bulkCancelRefundOrders,
  bulkDeleteOrderPersonalData,
} from "@/lib/tickets/ticket-order-actions"
import {
  isTicketedEventPast,
  formatEventSchedule,
} from "@/lib/tickets/ticketing-overview-types"
import {
  type TicketOrderListItem,
  type TicketOrderStatus,
  type TicketedEventOption,
} from "@/lib/tickets/ticket-order-queries"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

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
  initialEventFilter = "active",
  canManage,
}: TicketingOrdersClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [eventFilter, setEventFilter] = useState(initialEventFilter)
  const [statusFilter, setStatusFilter] = useState<TicketOrderStatus | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedOrder, setSelectedOrder] = useState<TicketOrderListItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.id)),
    [orders, selectedIds]
  )
  const hasSelection = selectedIds.length > 0

  const activeEvents = useMemo(
    () => events.filter((event) => !isTicketedEventPast(event)),
    [events]
  )
  const pastEvents = useMemo(
    () => events.filter((event) => isTicketedEventPast(event)),
    [events]
  )

  const filtered = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()
    const activeEventIds = new Set(activeEvents.map((event) => event.id))
    const pastEventIds = new Set(pastEvents.map((event) => event.id))

    return orders.filter((order) => {
      if (eventFilter === "active" && !activeEventIds.has(order.eventId)) return false
      if (eventFilter === "past" && !pastEventIds.has(order.eventId)) return false
      if (
        eventFilter !== "all" &&
        eventFilter !== "active" &&
        eventFilter !== "past" &&
        order.eventId !== eventFilter
      ) {
        return false
      }
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
  }, [activeEvents, dateFrom, dateTo, eventFilter, orders, pastEvents, searchQuery, statusFilter])

  const allSelected =
    filtered.length > 0 && filtered.every((order) => selectedIds.includes(order.id))

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? filtered.map((order) => order.id) : [])
  }

  function toggleOne(orderId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, orderId] : current.filter((id) => id !== orderId)
    )
  }

  function handleExport() {
    if (!hasSelection) return
    exportOrdersCsv(selectedOrders)
  }

  function handleCancelRefund() {
    if (!hasSelection) return
    if (
      !window.confirm(
        `Cancel or refund ${selectedIds.length} order${selectedIds.length === 1 ? "" : "s"}? Paid Stripe orders are refunded on the organization’s Stripe account. Pay-at-event orders are marked refunded locally.`
      )
    ) {
      return
    }

    setActionError(null)
    startTransition(async () => {
      try {
        await bulkCancelRefundOrders(selectedIds)
        setSelectedIds([])
        router.refresh()
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Could not cancel or refund the selected orders."
        )
      }
    })
  }

  function handleDeletePersonalData() {
    if (!hasSelection) return

    if (
      !window.confirm(
        `Delete personal data for ${selectedIds.length} order${selectedIds.length === 1 ? "" : "s"}? Purchaser and attendee names and emails will be redacted.`
      )
    ) {
      return
    }

    startTransition(async () => {
      await bulkDeleteOrderPersonalData(selectedIds)
      setSelectedIds([])
      router.refresh()
    })
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

      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

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

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Events</Label>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Active events" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="active">Active events</SelectItem>
                  <SelectItem value="past">Past events</SelectItem>
                  {activeEvents.length > 0 ? (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Active events</SelectLabel>
                        {activeEvents.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {formatEventFilterLabel(event)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  ) : null}
                  {pastEvents.length > 0 ? (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Past events</SelectLabel>
                        {pastEvents.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {formatEventFilterLabel(event)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  ) : null}
                </SelectContent>
              </Select>
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
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length.toLocaleString()} order{filtered.length === 1 ? "" : "s"}
        </p>
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isPending}>
                Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                {hasSelection
                  ? `${selectedIds.length} order${selectedIds.length === 1 ? "" : "s"} selected`
                  : "No orders selected"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!hasSelection || isPending} onClick={handleExport}>
                Export
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasSelection || isPending}
                onClick={handleCancelRefund}
              >
                Cancel/refund
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasSelection || isPending}
                onClick={handleDeletePersonalData}
                className="text-destructive focus:text-destructive"
              >
                Delete personal data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

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
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 8 : 7}
                  className="py-12 text-center text-muted-foreground"
                >
                  {orders.length === 0
                    ? "No orders yet. Add a manual order or wait for ticket sales."
                    : "No orders match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => {
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
                    <TableCell className="font-medium text-primary">
                      {order.orderNumber}
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
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedOrder(order)
                              setDetailOpen(true)
                            }}
                          >
                            View details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

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
