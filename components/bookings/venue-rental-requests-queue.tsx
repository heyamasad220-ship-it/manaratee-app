"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Clock,
  DollarSign,
  MoreHorizontal,
  Plus,
} from "lucide-react"

import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"
import {
  getVenueRentalStatusBadgeClasses,
  isVenueRentalReviewable,
} from "@/lib/bookings/venue-rental-status"
import type {
  VenueRentalDashboardStats,
  VenueRentalQueueRow,
  VenueRentalStatus,
} from "@/lib/bookings/venue-rental-types"
import { VENUE_RENTAL_STATUSES } from "@/lib/bookings/venue-rental-types"
import {
  approveVenueRentalRequest,
  markVenueRentalPending,
} from "@/lib/bookings/venue-rental-actions"
import {
  VenueRentalCreateDialog,
  type VenueRentalCreateEventTypeOption,
  type VenueRentalCreateVenueOption,
} from "@/components/bookings/venue-rental-create-dialog"
import type { RoomSetupStyle } from "@/lib/setup-styles/setup-style-types"
import type { RentalAddonCatalogItem } from "@/lib/bookings/venue-rental-types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

function isConfirmedRequestStatus(status: VenueRentalStatus): boolean {
  return (
    status === VENUE_RENTAL_STATUSES.confirmed ||
    status === VENUE_RENTAL_STATUSES.depositPaid ||
    status === VENUE_RENTAL_STATUSES.securityDepositPaid
  )
}

function isPendingRequestStatus(status: VenueRentalStatus): boolean {
  return (
    status === VENUE_RENTAL_STATUSES.pending ||
    status === VENUE_RENTAL_STATUSES.awaitingSupervisorApproval
  )
}

function isCancelledRequestStatus(status: VenueRentalStatus): boolean {
  return (
    status === VENUE_RENTAL_STATUSES.cancelledBeforePayment ||
    status === VENUE_RENTAL_STATUSES.cancelledAfterPayment
  )
}

/** Post-intake statuses hidden from the working All queue (handled on Payments / history). */
function isHistoryRequestStatus(status: VenueRentalStatus): boolean {
  return (
    isConfirmedRequestStatus(status) ||
    status === VENUE_RENTAL_STATUSES.completed ||
    isCancelledRequestStatus(status) ||
    status === VENUE_RENTAL_STATUSES.declined
  )
}

function matchesStatusFilter(
  status: VenueRentalStatus,
  statusFilter: StatusFilter
): boolean {
  if (statusFilter === "all") return true
  if (statusFilter === "submitted") {
    return status === VENUE_RENTAL_STATUSES.submitted
  }
  if (statusFilter === "pending") return isPendingRequestStatus(status)
  if (statusFilter === "approved") {
    return status === VENUE_RENTAL_STATUSES.approvedPendingPayment
  }
  if (statusFilter === "confirmed") return isConfirmedRequestStatus(status)
  if (statusFilter === "completed") {
    return status === VENUE_RENTAL_STATUSES.completed
  }
  if (statusFilter === "cancelled") return isCancelledRequestStatus(status)
  if (statusFilter === "declined") {
    return status === VENUE_RENTAL_STATUSES.declined
  }
  return false
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
  const [isPending, startTransition] = useTransition()
  const [customerFilterInput, setCustomerFilterInput] = useState("")
  const [customerFilter, setCustomerFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(defaultStatusFilter)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const [createOpen, setCreateOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [approveRow, setApproveRow] = useState<VenueRentalQueueRow | null>(null)
  const [depositAmount, setDepositAmount] = useState("0")
  const [remainingBalanceAmount, setRemainingBalanceAmount] = useState("0")

  const [pendingRow, setPendingRow] = useState<VenueRentalQueueRow | null>(null)

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

  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filteredRows.length / pageSize) || 1)
  )
  const pagedRows = useMemo(
    () => slicePageItems(filteredRows, currentPage, pageSize),
    [filteredRows, currentPage, pageSize]
  )

  function runAction(action: () => Promise<void>, onDone?: () => void) {
    setActionError(null)
    startTransition(async () => {
      try {
        await action()
        onDone?.()
        router.refresh()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Action failed.")
      }
    })
  }

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

      {actionError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
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
                  <TableHead>Date / Spaces</TableHead>
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
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
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
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No venue rental requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map((row) => {
                    const colors = getVenueRentalStatusBadgeClasses(row.status)
                    const canReview = canManage && isVenueRentalReviewable(row.status)
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
                              {row.customerPhone}
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
                                {formatVenueRentalTimeRange(space.startAt, space.endAt)}
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
                          <Badge variant="secondary" className={`${colors.bg} ${colors.text}`}>
                            {row.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          {canReview ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={isPending}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Request actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setDepositAmount("0")
                                    setRemainingBalanceAmount("0")
                                    setApproveRow(row)
                                  }}
                                >
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setPendingRow(row)}>
                                  Pending
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
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

      <Dialog
        open={Boolean(approveRow)}
        onOpenChange={(open) => {
          if (!open) setApproveRow(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve request</DialogTitle>
            <DialogDescription>
              {approveRow
                ? `Approve ${approveRow.customerName}'s request and request deposit payment.`
                : "Approve this venue rental request."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="queue-deposit">Deposit</Label>
              <Input
                id="queue-deposit"
                type="number"
                min={0}
                step="0.01"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="queue-remaining">Remaining balance</Label>
              <Input
                id="queue-remaining"
                type="number"
                min={0}
                step="0.01"
                value={remainingBalanceAmount}
                onChange={(event) => setRemainingBalanceAmount(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setApproveRow(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending || !approveRow}
              onClick={() => {
                if (!approveRow) return
                const rentalId = approveRow.id
                runAction(
                  async () => {
                    await approveVenueRentalRequest({
                      venueRentalId: rentalId,
                      depositAmount: Number(depositAmount || 0),
                      remainingBalanceAmount:
                        Number(remainingBalanceAmount || 0) || undefined,
                    })
                  },
                  () => setApproveRow(null)
                )
              }}
            >
              {isPending ? "Approving…" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingRow)}
        onOpenChange={(open) => {
          if (!open) setPendingRow(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as pending?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRow
                ? `Move ${pendingRow.customerName}'s request to Pending while you wait for more details.`
                : "Mark this request as pending."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || !pendingRow}
              onClick={(event) => {
                event.preventDefault()
                if (!pendingRow) return
                const rentalId = pendingRow.id
                runAction(
                  async () => {
                    await markVenueRentalPending({ venueRentalId: rentalId })
                  },
                  () => setPendingRow(null)
                )
              }}
            >
              {isPending ? "Saving…" : "Mark pending"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
