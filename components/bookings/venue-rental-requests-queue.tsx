"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  MoreHorizontal,
} from "lucide-react"

import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"
import { getVenueRentalStatusBadgeClasses } from "@/lib/bookings/venue-rental-status"
import type {
  VenueRentalDashboardStats,
  VenueRentalQueueRow,
  VenueRentalStatus,
} from "@/lib/bookings/venue-rental-types"
import { VENUE_RENTAL_STATUSES } from "@/lib/bookings/venue-rental-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ListPagination } from "@/components/ui/list-pagination"
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
  | "awaiting_approval"
  | "awaiting_payment"
  | "confirmed"
  | "completed"

type VenueRentalRequestsQueueProps = {
  rows: VenueRentalQueueRow[]
  stats: VenueRentalDashboardStats
  canManage: boolean
  title?: string
  defaultStatusFilter?: StatusFilter
}

function isAwaitingPaymentStatus(status: VenueRentalStatus): boolean {
  return (
    status === VENUE_RENTAL_STATUSES.approvedPendingPayment ||
    status === VENUE_RENTAL_STATUSES.depositPaid ||
    status === VENUE_RENTAL_STATUSES.securityDepositPaid
  )
}

export function VenueRentalRequestsQueue({
  rows,
  stats,
  canManage,
  title = "Requests",
  defaultStatusFilter = "all",
}: VenueRentalRequestsQueueProps) {
  const [customerFilterInput, setCustomerFilterInput] = useState("")
  const [customerFilter, setCustomerFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(defaultStatusFilter)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const query = customerFilter.toLowerCase()
      const matchesCustomer =
        !query ||
        row.customerName.toLowerCase().includes(query) ||
        (row.customerEmail || "").toLowerCase().includes(query) ||
        (row.customerPhone || "").toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "awaiting_approval" &&
          (row.status === VENUE_RENTAL_STATUSES.awaitingSupervisorApproval ||
            row.status === VENUE_RENTAL_STATUSES.submitted)) ||
        (statusFilter === "awaiting_payment" && isAwaitingPaymentStatus(row.status)) ||
        (statusFilter === "confirmed" &&
          row.status === VENUE_RENTAL_STATUSES.confirmed) ||
        (statusFilter === "completed" &&
          row.status === VENUE_RENTAL_STATUSES.completed)

      return matchesCustomer && matchesStatus
    })
  }, [rows, customerFilter, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [customerFilter, statusFilter])

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
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Awaiting approval" value={stats.awaitingApprovalCount} icon={Clock} />
          <StatCard label="Awaiting payment" value={stats.awaitingPaymentCount} icon={CheckCircle2} />
          <StatCard label="Confirmed" value={stats.confirmedCount} icon={CheckCircle2} />
          <StatCard label="Conflicts" value={stats.conflictCount} icon={AlertTriangle} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Customer"
                      active={Boolean(customerFilter.trim())}
                    >
                      {({ close }) => (
                        <Input
                          placeholder="Search by name, email, or phone"
                          value={customerFilterInput}
                          onChange={(event) => {
                            setCustomerFilterInput(event.target.value)
                            setCustomerFilter(event.target.value)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              setCustomerFilter(customerFilterInput)
                              close()
                            }
                          }}
                        />
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead>Spaces</TableHead>
                  <TableHead>Event type</TableHead>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Status"
                      active={statusFilter !== "all"}
                    >
                      {({ close }) => (
                        <Select
                          value={statusFilter}
                          onValueChange={(value) => {
                            setStatusFilter(value as StatusFilter)
                            close()
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="awaiting_approval">
                              Awaiting approval
                            </SelectItem>
                            <SelectItem value="awaiting_payment">
                              Awaiting payment
                            </SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No venue rental requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map((row) => {
                    const colors = getVenueRentalStatusBadgeClasses(row.status)
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="text-sm font-medium">{row.submittedAtLabel}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.customerName}</div>
                          {row.customerEmail ? (
                            <div className="text-xs text-muted-foreground">
                              {row.customerEmail}
                            </div>
                          ) : null}
                          {row.customerPhone ? (
                            <div className="text-xs text-muted-foreground">
                              {row.customerPhone}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          {row.spaces.map((space) => (
                            <div key={`${space.venueId}-${space.startAt}`} className="text-sm">
                              <span className="font-medium">{space.venueName}</span>
                              <div className="text-xs text-muted-foreground">
                                {formatVenueRentalTimeRange(space.startAt, space.endAt)}
                              </div>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="max-w-[200px] text-sm">
                          {row.eventTypeName || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`${colors.bg} ${colors.text}`}>
                            {row.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">
                                  {canManage ? "Request actions" : "View request"}
                                </span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/bookings/rentals/${row.id}`}>
                                  {canManage ? "Review" : "View"}
                                </Link>
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
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Calendar
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
