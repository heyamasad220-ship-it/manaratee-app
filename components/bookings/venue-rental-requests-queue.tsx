"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Users,
} from "lucide-react"

import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"
import { getVenueRentalCalendarColorClasses } from "@/lib/bookings/venue-rental-status"
import type {
  VenueRentalDashboardStats,
  VenueRentalQueueRow,
  VenueRentalStatus,
} from "@/lib/bookings/venue-rental-types"
import { VENUE_RENTAL_STATUSES } from "@/lib/bookings/venue-rental-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type VenueRentalRequestsQueueProps = {
  rows: VenueRentalQueueRow[]
  stats: VenueRentalDashboardStats
  canManage: boolean
  title?: string
  description?: string
  defaultStatusFilter?: "all" | "awaiting_approval" | "awaiting_payment"
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
  description = "Review venue rental requests from customers.",
  defaultStatusFilter = "all",
}: VenueRentalRequestsQueueProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter)

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const query = search.toLowerCase()
      const matchesSearch =
        row.customerName.toLowerCase().includes(query) ||
        (row.customerEmail || "").toLowerCase().includes(query) ||
        (row.customerPhone || "").toLowerCase().includes(query) ||
        row.shortId.toLowerCase().includes(query) ||
        row.spaces.some((space) => space.venueName.toLowerCase().includes(query))

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "awaiting_approval" &&
          row.status === VENUE_RENTAL_STATUSES.awaitingSupervisorApproval) ||
        (statusFilter === "awaiting_payment" && isAwaitingPaymentStatus(row.status))

      return matchesSearch && matchesStatus
    })
  }, [rows, search, statusFilter])

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting approval" value={stats.awaitingApprovalCount} icon={Clock} />
        <StatCard label="Awaiting payment" value={stats.awaitingPaymentCount} icon={CheckCircle2} />
        <StatCard label="Confirmed" value={stats.confirmedCount} icon={CheckCircle2} />
        <StatCard label="Conflicts" value={stats.conflictCount} icon={AlertTriangle} />
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search customer, venue, or request ID..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9 h-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-[180px]">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="awaiting_approval">Awaiting approval</SelectItem>
                  <SelectItem value="awaiting_payment">Awaiting payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Spaces</TableHead>
                  <TableHead>Add-ons</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Conflict</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No venue rental requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const colors = getVenueRentalCalendarColorClasses(row.calendarColor)
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.shortId}</div>
                          <div className="text-xs text-muted-foreground">{row.submittedAtLabel}</div>
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
                        <TableCell>
                          {row.addons.length ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Users className="h-3.5 w-3.5" />
                              {row.addons.map((addon) => addon.name).join(", ")}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`${colors.bg} ${colors.text}`}>
                            {row.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.hasConflict ? (
                            <Badge variant="secondary" className="bg-red-100 text-red-700">
                              Conflict
                            </Badge>
                          ) : (
                            "Clear"
                          )}
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
