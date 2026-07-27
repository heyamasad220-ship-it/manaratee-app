"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  DollarSign,
} from "lucide-react"

import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"
import type {
  VenueRentalPaymentReportRow,
  VenueRentalQueueRow,
} from "@/lib/bookings/venue-rental-types"
import { VENUE_RENTAL_STATUSES } from "@/lib/bookings/venue-rental-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** Confirmed bookings only (legacy deposit statuses map to confirmed). */
const CONFIRMED_STATUSES = new Set([
  VENUE_RENTAL_STATUSES.confirmed,
  VENUE_RENTAL_STATUSES.depositPaid,
  VENUE_RENTAL_STATUSES.securityDepositPaid,
])

const MS_DAY = 24 * 60 * 60 * 1000

function earliestStartMs(row: VenueRentalQueueRow) {
  if (!row.spaces.length) return Number.POSITIVE_INFINITY
  return Math.min(...row.spaces.map((space) => new Date(space.startAt).getTime()))
}

export function getUpcomingConfirmedVenueRentalRows(
  rows: VenueRentalQueueRow[],
  nowMs = Date.now()
) {
  return rows
    .filter((row) => {
      if (!CONFIRMED_STATUSES.has(row.status)) return false
      const start = earliestStartMs(row)
      return Number.isFinite(start) && start >= nowMs
    })
    .sort((a, b) => earliestStartMs(a) - earliestStartMs(b))
}

/** @deprecated Use getUpcomingConfirmedVenueRentalRows */
export function getUpcomingVenueRentalRows(
  rows: VenueRentalQueueRow[],
  nowMs = Date.now()
) {
  return getUpcomingConfirmedVenueRentalRows(rows, nowMs)
}

function countInWindow(
  rows: VenueRentalQueueRow[],
  nowMs: number,
  windowMs: number
) {
  const end = nowMs + windowMs
  return rows.filter((row) => {
    const start = earliestStartMs(row)
    return start >= nowMs && start < end
  }).length
}

type VenueRentalUpcomingDashboardProps = {
  rows: VenueRentalQueueRow[]
  paymentRows?: VenueRentalPaymentReportRow[]
  canManage: boolean
}

export function VenueRentalUpcomingDashboard({
  rows,
  paymentRows = [],
  canManage,
}: VenueRentalUpcomingDashboardProps) {
  const nowMs = useMemo(() => Date.now(), [])
  const upcoming = useMemo(
    () => getUpcomingConfirmedVenueRentalRows(rows, nowMs),
    [rows, nowMs]
  )

  const paymentById = useMemo(() => {
    const map = new Map<string, VenueRentalPaymentReportRow>()
    for (const payment of paymentRows) {
      map.set(payment.id, payment)
    }
    return map
  }, [paymentRows])

  const stats = useMemo(() => {
    const thisWeek = countInWindow(upcoming, nowMs, 7 * MS_DAY)
    const next30Days = countInWindow(upcoming, nowMs, 30 * MS_DAY)
    let balanceDueCount = 0
    let balanceDueTotal = 0
    for (const row of upcoming) {
      const payment = paymentById.get(row.id)
      if (payment && payment.remainingDue > 0) {
        balanceDueCount += 1
        balanceDueTotal += payment.remainingDue
      }
    }
    return {
      upcomingCount: upcoming.length,
      thisWeek,
      next30Days,
      balanceDueCount,
      balanceDueTotal,
    }
  }, [upcoming, nowMs, paymentById])

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirmed upcoming venue rentals. Open Requests for submissions and
            awaiting payment.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/bookings/requests">
            View all requests
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <StatCardsRow equal>
        <StatCard
          fill
          label="Upcoming confirmed"
          value={stats.upcomingCount}
          icon={CalendarCheck2}
          tone="emerald"
          hint="Deposit paid · on the calendar"
        />
        <StatCard
          fill
          label="This week"
          value={stats.thisWeek}
          icon={CalendarDays}
          tone="sky"
          hint="Next 7 days"
        />
        <StatCard
          fill
          label="Next 30 days"
          value={stats.next30Days}
          icon={CalendarClock}
          tone="blue"
          hint="Confirmed starts"
        />
        <StatCard
          fill
          label="Balance due"
          value={stats.balanceDueCount}
          icon={DollarSign}
          tone={stats.balanceDueCount > 0 ? "amber" : "slate"}
          hint={
            stats.balanceDueCount > 0
              ? `${new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(stats.balanceDueTotal)} remaining`
              : "No remaining balances"
          }
        />
      </StatCardsRow>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Spaces</TableHead>
                  <TableHead>Event type</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <CalendarCheck2 className="h-8 w-8 text-muted-foreground/60" />
                        <p>No confirmed upcoming venue rentals.</p>
                        <Button variant="link" className="h-auto p-0" asChild>
                          <Link href="/bookings/requests">View all requests</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  upcoming.map((row) => {
                    const primary = row.spaces[0]
                    const payment = paymentById.get(row.id)
                    const remainingDue = payment?.remainingDue ?? 0
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          {primary ? (
                            <div className="text-sm">
                              <div className="font-medium">
                                {formatVenueRentalTimeRange(
                                  primary.startAt,
                                  primary.endAt
                                )}
                              </div>
                              {row.spaces.length > 1 ? (
                                <div className="text-xs text-muted-foreground">
                                  +{row.spaces.length - 1} more space
                                  {row.spaces.length - 1 === 1 ? "" : "s"}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.customerName}</div>
                          {row.customerEmail ? (
                            <div className="text-xs text-muted-foreground">
                              {row.customerEmail}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          {row.spaces.map((space) => (
                            <div
                              key={`${space.venueId}-${space.startAt}`}
                              className="text-sm font-medium"
                            >
                              {space.venueName}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.eventTypeName || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {remainingDue > 0
                            ? new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: "USD",
                              }).format(remainingDue)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/bookings/rentals/${row.id}`}>
                              {canManage ? "Open" : "View"}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
