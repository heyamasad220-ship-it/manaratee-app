"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Clock,
  DollarSign,
  Plus,
} from "lucide-react"

import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"
import { getVenueRentalStatusBadgeClasses } from "@/lib/bookings/venue-rental-status"
import type {
  VenueRentalDashboardStats,
  VenueRentalQueueRow,
  VenueRentalStatus,
} from "@/lib/bookings/venue-rental-types"
import { VENUE_RENTAL_STATUSES } from "@/lib/bookings/venue-rental-types"
import {
  VenueRentalCreateDialog,
  type VenueRentalCreateEventTypeOption,
  type VenueRentalCreateVenueOption,
} from "@/components/bookings/venue-rental-create-dialog"
import type { RoomSetupStyle } from "@/lib/setup-styles/setup-style-types"
import type { RentalAddonCatalogItem } from "@/lib/bookings/venue-rental-types"
import { PhoneText } from "@/components/ui/phone-text"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ListPagination } from "@/components/ui/list-pagination"
import { StatCard } from "@/components/ui/stat-card"
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
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"
import { STAFF_MAIN_CONTENT_STICKY_TOP_CLASS } from "@/lib/layout/staff-dashboard-chrome"
import { cn } from "@/lib/utils"

type StatusFilter =
  | "all"
  | "submitted"
  | "pending"
  | "approved"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "declined"

type VenueRentalRequestsQueueProps = {
  rows: VenueRentalQueueRow[]
  stats: VenueRentalDashboardStats
  canManage: boolean
  title?: string
  defaultStatusFilter?: StatusFilter
  venues?: VenueRentalCreateVenueOption[]
  eventTypes?: VenueRentalCreateEventTypeOption[]
  setupStyles?: RoomSetupStyle[]
  addons?: RentalAddonCatalogItem[]
}

function isPendingRequestStatus(status: VenueRentalStatus): boolean {
  return (
    status === VENUE_RENTAL_STATUSES.pending ||
    status === VENUE_RENTAL_STATUSES.awaitingSupervisorApproval
  )
}

function isHistoryRequestStatus(status: VenueRentalStatus): boolean {
  return (
    status === VENUE_RENTAL_STATUSES.confirmed ||
    status === VENUE_RENTAL_STATUSES.depositPaid ||
    status === VENUE_RENTAL_STATUSES.securityDepositPaid ||
    status === VENUE_RENTAL_STATUSES.completed ||
    status === VENUE_RENTAL_STATUSES.cancelledBeforePayment ||
    status === VENUE_RENTAL_STATUSES.cancelledAfterPayment ||
    status === VENUE_RENTAL_STATUSES.declined ||
    status === VENUE_RENTAL_STATUSES.holdExpired ||
    status === VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval ||
    status === VENUE_RENTAL_STATUSES.securityDepositRefunded ||
    status === VENUE_RENTAL_STATUSES.closed
  )
}

function matchesStatusFilter(
  status: VenueRentalStatus,
  statusFilter: StatusFilter
): boolean {
  if (statusFilter === "all") return true
  if (statusFilter === "submitted") return status === VENUE_RENTAL_STATUSES.submitted
  if (statusFilter === "pending") return isPendingRequestStatus(status)
  if (statusFilter === "approved") {
    return status === VENUE_RENTAL_STATUSES.approvedPendingPayment
  }
  if (statusFilter === "confirmed") {
    return (
      status === VENUE_RENTAL_STATUSES.confirmed ||
      status === VENUE_RENTAL_STATUSES.depositPaid ||
      status === VENUE_RENTAL_STATUSES.securityDepositPaid
    )
  }
  if (statusFilter === "completed") return status === VENUE_RENTAL_STATUSES.completed
  if (statusFilter === "cancelled") {
    return (
      status === VENUE_RENTAL_STATUSES.cancelledBeforePayment ||
      status === VENUE_RENTAL_STATUSES.cancelledAfterPayment
    )
  }
  if (statusFilter === "declined") return status === VENUE_RENTAL_STATUSES.declined
  return true
}

export function VenueRentalRequestsQueue({
  rows,
  stats,
  canManage,
  title = "Requests",
  defaultStatusFilter = "all",
  venues = [],
  eventTypes = [],
  setupStyles = [],
  addons = [],
}: VenueRentalRequestsQueueProps) {
  const router = useRouter()
  const [customerFilterInput, setCustomerFilterInput] = useState("")
  const [customerFilter, setCustomerFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(defaultStatusFilter)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const [createOpen, setCreateOpen] = useState(false)

  const filteredRows = useMemo(() => {
    const showHistory =
      statusFilter === "confirmed" ||
      statusFilter === "completed" ||
      statusFilter === "cancelled" ||
      statusFilter === "declined"

    return rows.filter((row) => {
      const query = customerFilter.toLowerCase()
      const matchesCustomer =
        !query ||
        row.customerName.toLowerCase().includes(query) ||
        (row.customerEmail || "").toLowerCase().includes(query) ||
        (row.customerPhone || "").toLowerCase().includes(query)

      if (!matchesCustomer || !matchesStatusFilter(row.status, statusFilter)) {
        return false
      }

      // Default / active views: keep Confirmed (Payments), Completed, Cancelled,
      // and Declined out of the working queue. Use Status → those for history.
      if (!showHistory && isHistoryRequestStatus(row.status)) {
        return false
      }

      return true
    })
  }, [rows, customerFilter, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [customerFilter, statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(
      () => setCustomerFilter(customerFilterInput.trim()),
      250
    )
    return () => window.clearTimeout(timer)
  }, [customerFilterInput])

  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filteredRows.length / pageSize) || 1)
  )
  const pagedRows = useMemo(
    () => slicePageItems(filteredRows, currentPage, pageSize),
    [filteredRows, currentPage, pageSize]
  )

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div
        className={cn(
          "sticky z-30 -mx-4 space-y-4 border-b border-border bg-background px-4 pb-4 sm:-mx-6 sm:space-y-6 sm:px-6",
          STAFF_MAIN_CONTENT_STICKY_TOP_CLASS
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {canManage ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Rental Request
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          <StatCard
            layout="header"
            fill
            tone="amber"
            label="Submitted"
            value={stats.awaitingApprovalCount}
            icon={Clock}
          />
          <StatCard
            layout="header"
            fill
            tone="sky"
            label="Approved"
            value={stats.awaitingPaymentCount}
            icon={DollarSign}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Customer"
                      active={Boolean(customerFilter)}
                      onClear={() => {
                        setCustomerFilterInput("")
                        setCustomerFilter("")
                      }}
                    >
                      <Input
                        value={customerFilterInput}
                        onChange={(event) =>
                          setCustomerFilterInput(event.target.value)
                        }
                        placeholder="Search name, email, phone"
                        className="h-8"
                      />
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead>Date / Spaces</TableHead>
                  <TableHead>Event type</TableHead>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Status"
                      active={statusFilter !== "all"}
                      onClear={() => setStatusFilter("all")}
                    >
                      <Select
                        value={statusFilter}
                        onValueChange={(value) =>
                          setStatusFilter(value as StatusFilter)
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableColumnHeaderFilter>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No venue rental requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map((row) => {
                    const colors = getVenueRentalStatusBadgeClasses(row.status)
                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(`/bookings/rentals/${row.id}?from=requests`)
                        }
                      >
                        <TableCell>
                          <div className="font-medium">{row.customerName}</div>
                          {row.customerEmail ? (
                            <div className="text-xs text-muted-foreground">
                              {row.customerEmail}
                            </div>
                          ) : null}
                          {row.customerPhone ? (
                            <div className="text-xs text-muted-foreground">
                              <PhoneText value={row.customerPhone} empty="" />
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          {row.spaces.map((space) => (
                            <div
                              key={`${space.venueId}-${space.startAt}`}
                              className="py-0.5 text-sm"
                            >
                              <div className="font-medium">
                                {formatVenueRentalTimeRange(
                                  space.startAt,
                                  space.endAt
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {space.venueName}
                              </div>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="max-w-[200px] text-sm">
                          {row.eventTypeName || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`${colors.bg} ${colors.text}`}
                          >
                            {row.statusLabel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filteredRows.length > 0 ? (
            <div className="border-t border-border px-3 py-3 sm:px-4">
              <ListPagination
                page={currentPage}
                pageSize={pageSize}
                total={filteredRows.length}
                entryLabel="requests"
                onPageChange={setPage}
                onPageSizeChange={(next) => {
                  setPageSize(next)
                  setPage(1)
                }}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canManage ? (
        <VenueRentalCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          venues={venues}
          eventTypes={eventTypes}
          setupStyles={setupStyles}
          addons={addons}
        />
      ) : null}
    </div>
  )
}
