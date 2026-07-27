"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ArrowRight, CalendarDays } from "lucide-react"

import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"
import { getVenueRentalStatusBadgeClasses } from "@/lib/bookings/venue-rental-status"
import type { VenueRentalQueueRow } from "@/lib/bookings/venue-rental-types"
import { VENUE_RENTAL_STATUSES } from "@/lib/bookings/venue-rental-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const UPCOMING_STATUSES = new Set([
  VENUE_RENTAL_STATUSES.submitted,
  VENUE_RENTAL_STATUSES.awaitingSupervisorApproval,
  VENUE_RENTAL_STATUSES.approvedPendingPayment,
  VENUE_RENTAL_STATUSES.depositPaid,
  VENUE_RENTAL_STATUSES.securityDepositPaid,
  VENUE_RENTAL_STATUSES.confirmed,
])

function earliestStartMs(row: VenueRentalQueueRow) {
  if (!row.spaces.length) return Number.POSITIVE_INFINITY
  return Math.min(...row.spaces.map((space) => new Date(space.startAt).getTime()))
}

export function getUpcomingVenueRentalRows(
  rows: VenueRentalQueueRow[],
  nowMs = Date.now()
) {
  return rows
    .filter((row) => {
      if (!UPCOMING_STATUSES.has(row.status)) return false
      const start = earliestStartMs(row)
      return Number.isFinite(start) && start >= nowMs
    })
    .sort((a, b) => earliestStartMs(a) - earliestStartMs(b))
}

type VenueRentalUpcomingDashboardProps = {
  rows: VenueRentalQueueRow[]
  canManage: boolean
}

export function VenueRentalUpcomingDashboard({
  rows,
  canManage,
}: VenueRentalUpcomingDashboardProps) {
  const upcoming = useMemo(() => getUpcomingVenueRentalRows(rows), [rows])

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upcoming venue rentals on the calendar. Review the full queue on Requests.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/bookings/requests">
            View all requests
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Spaces</TableHead>
                  <TableHead>Event type</TableHead>
                  <TableHead>Status</TableHead>
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
                        <CalendarDays className="h-8 w-8 text-muted-foreground/60" />
                        <p>No upcoming venue rentals.</p>
                        <Button variant="link" className="h-auto p-0" asChild>
                          <Link href="/bookings/requests">View all requests</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  upcoming.map((row) => {
                    const colors = getVenueRentalStatusBadgeClasses(row.status)
                    const primary = row.spaces[0]
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
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`${colors.bg} ${colors.text}`}
                          >
                            {row.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/bookings/rentals/${row.id}`}>
                              {canManage ? "Review" : "View"}
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
