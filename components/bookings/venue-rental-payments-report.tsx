"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import {
  matchesVenueRentalPaymentLedgerView,
  venueRentalPaymentLedgerStatusLabel,
  type VenueRentalPaymentLedgerSortKey,
  type VenueRentalPaymentLedgerStatus,
  type VenueRentalStaffNextActionKey,
} from "@/lib/bookings/venue-rental-payment-ledger"
import type { VenueRentalPaymentReportRow } from "@/lib/bookings/venue-rental-types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"

type VenueRentalPaymentsReportProps = {
  rows: VenueRentalPaymentReportRow[]
}

type SortState = {
  key: VenueRentalPaymentLedgerSortKey
  direction: "asc" | "desc"
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0)
}

function formatEventDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatEventTime(startAt: string | null, endAt: string | null) {
  if (!startAt) return null
  const start = new Date(startAt)
  const startLabel = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
  if (!endAt) return startLabel
  const end = new Date(endAt)
  const endLabel = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
  return `${startLabel} – ${endLabel}`
}

function paymentStatusBadgeVariant(
  status: VenueRentalPaymentLedgerStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "paid":
    case "complimentary":
    case "refunded":
      return "default"
    case "overdue":
    case "refund_due":
      return "destructive"
    case "partial":
      return "outline"
    default:
      return "secondary"
  }
}

const NEXT_ACTION_FILTER_OPTIONS: Array<{
  value: VenueRentalStaffNextActionKey | "all"
  label: string
}> = [
  { value: "all", label: "All" },
  { value: "add_charges", label: "Add Charges" },
  { value: "collect_payment", label: "Collect Payment" },
  { value: "collect_remaining", label: "Collect Remaining Balance" },
  { value: "review_overdue", label: "Review Overdue Balance" },
  { value: "send_reminder", label: "Send Payment Reminder" },
  { value: "process_refund", label: "Process Refund" },
  { value: "view_history", label: "View Payment History" },
  { value: "none", label: "No Action Needed" },
]

export function VenueRentalPaymentsReport({
  rows,
}: VenueRentalPaymentsReportProps) {
  const router = useRouter()
  const [customerFilterInput, setCustomerFilterInput] = useState("")
  const [customerFilter, setCustomerFilter] = useState("")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    VenueRentalPaymentLedgerStatus | "all"
  >("all")
  const [nextActionFilter, setNextActionFilter] = useState<
    VenueRentalStaffNextActionKey | "all"
  >("all")
  const [sort, setSort] = useState<SortState>({
    key: "event_date",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)

  const filteredRows = useMemo(() => {
    const query = customerFilter.trim().toLowerCase()

    const matched = rows.filter((row) => {
      const matchesFinancialView = matchesVenueRentalPaymentLedgerView(
        "financial",
        row.paymentStatus,
        {
          includeNoCharges: false,
          hasFinancialActivity: row.hasFinancialActivity,
        }
      )
      if (!matchesFinancialView) return false

      if (paymentStatusFilter !== "all" && row.paymentStatus !== paymentStatusFilter) {
        return false
      }

      if (nextActionFilter !== "all" && row.nextActionKey !== nextActionFilter) {
        return false
      }

      if (!query) return true

      return (
        row.customerName.toLowerCase().includes(query) ||
        (row.customerEmail || "").toLowerCase().includes(query) ||
        (row.customerPhone || "").toLowerCase().includes(query)
      )
    })

    const direction = sort.direction === "asc" ? 1 : -1
    return [...matched].sort((a, b) => {
      const compare = (left: number | string | null, right: number | string | null) => {
        if (left == null && right == null) return 0
        if (left == null) return 1
        if (right == null) return -1
        if (typeof left === "number" && typeof right === "number") {
          return (left - right) * direction
        }
        return String(left).localeCompare(String(right)) * direction
      }

      switch (sort.key) {
        case "total_charges":
          return compare(a.totalCharges, b.totalCharges)
        case "received":
          return compare(a.amountReceived, b.amountReceived)
        case "balance_due":
          return compare(a.balanceDue, b.balanceDue)
        case "due_date":
          return compare(
            a.paymentDueAt ? new Date(a.paymentDueAt).getTime() : null,
            b.paymentDueAt ? new Date(b.paymentDueAt).getTime() : null
          )
        case "customer":
          return compare(a.customerName.toLowerCase(), b.customerName.toLowerCase())
        case "event_date":
        default:
          return compare(
            a.eventStartAt ? new Date(a.eventStartAt).getTime() : null,
            b.eventStartAt ? new Date(b.eventStartAt).getTime() : null
          )
      }
    })
  }, [rows, customerFilter, paymentStatusFilter, nextActionFilter, sort])

  useEffect(() => {
    setPage(1)
  }, [customerFilter, paymentStatusFilter, nextActionFilter, sort])

  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filteredRows.length / pageSize) || 1)
  )
  const pagedRows = useMemo(
    () => slicePageItems(filteredRows, currentPage, pageSize),
    [filteredRows, currentPage, pageSize]
  )

  const totals = useMemo(() => {
    const now = Date.now()
    return filteredRows.reduce(
      (acc, row) => {
        acc.totalCharges += row.totalCharges
        acc.paymentsReceived += row.amountReceived
        if (row.balanceDue > 0) acc.outstandingBalance += row.balanceDue
        const dueMs = row.paymentDueAt ? new Date(row.paymentDueAt).getTime() : null
        if (row.balanceDue > 0 && dueMs != null && dueMs < now) {
          acc.pastDue += row.balanceDue
        }
        return acc
      },
      {
        totalCharges: 0,
        paymentsReceived: 0,
        outstandingBalance: 0,
        pastDue: 0,
      }
    )
  }, [filteredRows])

  function toggleSort(key: VenueRentalPaymentLedgerSortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "customer" ? "asc" : "desc" }
    )
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Payments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Financial ledger and receivables for venue rentals. Use Requests for
            approvals, scheduling, and rental details.
          </p>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total Charges"
            value={formatMoney(totals.totalCharges)}
          />
          <SummaryCard
            label="Payments Received"
            value={formatMoney(totals.paymentsReceived)}
          />
          <SummaryCard
            label="Outstanding Balance"
            value={formatMoney(totals.outstandingBalance)}
          />
          <SummaryCard label="Past Due" value={formatMoney(totals.pastDue)} />
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Customer"
                        active={Boolean(customerFilter.trim())}
                      >
                        {({ close }) => (
                          <Input
                            placeholder="Search name, email, or phone"
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
                    <TableHead>Event / Space</TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Event Date"
                        active={sort.key === "event_date"}
                        direction={sort.direction}
                        onClick={() => toggleSort("event_date")}
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        label="Total Charges"
                        active={sort.key === "total_charges"}
                        direction={sort.direction}
                        onClick={() => toggleSort("total_charges")}
                        align="right"
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        label="Received"
                        active={sort.key === "received"}
                        direction={sort.direction}
                        onClick={() => toggleSort("received")}
                        align="right"
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        label="Balance Due"
                        active={sort.key === "balance_due"}
                        direction={sort.direction}
                        onClick={() => toggleSort("balance_due")}
                        align="right"
                      />
                    </TableHead>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Payment Status"
                        active={paymentStatusFilter !== "all"}
                      >
                        {({ close }) => (
                          <Select
                            value={paymentStatusFilter}
                            onValueChange={(value) => {
                              setPaymentStatusFilter(
                                value as VenueRentalPaymentLedgerStatus | "all"
                              )
                              close()
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Filter status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="no_charges">No Charges</SelectItem>
                              <SelectItem value="complimentary">
                                Complimentary
                              </SelectItem>
                              <SelectItem value="unpaid">Unpaid</SelectItem>
                              <SelectItem value="partial">Partial</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                              <SelectItem value="refund_due">Refund Due</SelectItem>
                              <SelectItem value="refunded">Refunded</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Next Action"
                        active={nextActionFilter !== "all"}
                      >
                        {({ close }) => (
                          <Select
                            value={nextActionFilter}
                            onValueChange={(value) => {
                              setNextActionFilter(
                                value as VenueRentalStaffNextActionKey | "all"
                              )
                              close()
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Filter action" />
                            </SelectTrigger>
                            <SelectContent>
                              {NEXT_ACTION_FILTER_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-32 text-center text-muted-foreground"
                      >
                        No rentals match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedRows.map((row) => {
                      const timeLabel = formatEventTime(
                        row.eventStartAt,
                        row.eventEndAt
                      )
                      return (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(
                              `/bookings/rentals/${row.id}?tab=financial&from=payments`
                            )
                          }
                        >
                          <TableCell>
                            {row.customerPhone ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-left">
                                    <div className="font-medium">
                                      {row.customerName}
                                    </div>
                                    {row.customerEmail ? (
                                      <div className="text-xs text-muted-foreground">
                                        {row.customerEmail}
                                      </div>
                                    ) : null}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Phone: {row.customerPhone}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <div>
                                <div className="font-medium">{row.customerName}</div>
                                {row.customerEmail ? (
                                  <div className="text-xs text-muted-foreground">
                                    {row.customerEmail}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[220px] text-sm">
                            <div className="font-medium">
                              {row.eventTypeName || "Venue rental"}
                            </div>
                            <div className="text-muted-foreground">
                              {row.spaceName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {formatEventDate(row.eventStartAt)}
                            </div>
                            {timeLabel ? (
                              <div className="text-xs text-muted-foreground">
                                {timeLabel}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(row.totalCharges)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(row.amountReceived)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(row.balanceDue)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={paymentStatusBadgeVariant(row.paymentStatus)}
                            >
                              {venueRentalPaymentLedgerStatusLabel(row.paymentStatus)}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className="text-sm"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {row.nextActionHref && row.nextActionKey !== "none" ? (
                              <Link
                                href={row.nextActionHref}
                                className="font-medium text-primary hover:underline"
                              >
                                {row.nextActionLabel}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">
                                {row.nextActionLabel}
                              </span>
                            )}
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
                  entryLabel="rentals"
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
    </TooltipProvider>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string
  active: boolean
  direction: "asc" | "desc"
  onClick: () => void
  align?: "left" | "right"
}) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-medium hover:text-foreground ${
        align === "right" ? "w-full justify-end" : ""
      }`}
    >
      {label}
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  )
}
