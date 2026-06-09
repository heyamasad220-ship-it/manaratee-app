"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Eye,
  MoreHorizontal,
  Search,
  User,
  Users,
  XCircle,
} from "lucide-react"

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { updateVenueBookingStatus } from "@/lib/bookings/venue-booking-actions"
import type {
  VenueBookingDashboardRow,
  VenueBookingDashboardStats,
} from "@/lib/bookings/venue-booking-types"

const statusStyles: Record<
  string,
  { className: string; icon: typeof CheckCircle2 }
> = {
  Pending: { className: "bg-amber-100 text-amber-700", icon: Clock },
  Approved: { className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  Confirmed: { className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  Rejected: { className: "bg-red-100 text-red-700", icon: XCircle },
  Cancelled: { className: "bg-gray-100 text-gray-600", icon: Ban },
}

const paymentStatusStyles: Record<string, string> = {
  "Not Invoiced": "bg-gray-100 text-gray-600",
  "Invoice Sent": "bg-blue-100 text-blue-700",
  "Deposit Paid": "bg-cyan-100 text-cyan-700",
  "Fully Paid": "bg-emerald-100 text-emerald-700",
  Overdue: "bg-red-100 text-red-700",
}

type VenueRentalsDashboardProps = {
  initialRows: VenueBookingDashboardRow[]
  initialStats: VenueBookingDashboardStats
  canManage: boolean
}

export function VenueRentalsDashboard({
  initialRows,
  initialStats,
  canManage,
}: VenueRentalsDashboardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedRequest, setSelectedRequest] =
    useState<VenueBookingDashboardRow | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredRows = useMemo(() => {
    return initialRows.filter((request) => {
      const query = search.toLowerCase()
      const matchesSearch =
        request.customer.name.toLowerCase().includes(query) ||
        (request.customer.email || "").toLowerCase().includes(query) ||
        request.shortId.toLowerCase().includes(query) ||
        request.venueName.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === "all" || request.statusLabel === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [initialRows, search, statusFilter])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount)

  function handleStatusUpdate(
    id: string,
    status: "approved" | "rejected" | "cancelled"
  ) {
    setError(null)

    startTransition(async () => {
      try {
        await updateVenueBookingStatus(id, status)
        setShowDetailDialog(false)
        router.refresh()
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to update booking"
        )
      }
    })
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor customer venue rental requests and payments
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 sm:gap-4 [&>*]:w-fit">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold">{initialStats.pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold">{initialStats.approvedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overdue Payments</p>
                  <p className="text-2xl font-bold">{initialStats.overdueCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Revenue</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(initialStats.pendingRevenue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, venue, or ID..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-[140px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Status
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="h-10" disabled>
                <Download className="mr-1.5 h-4 w-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Request ID</TableHead>
                    <TableHead className="min-w-[160px]">Customer</TableHead>
                    <TableHead className="whitespace-nowrap">Venue</TableHead>
                    <TableHead className="whitespace-nowrap">Event Date</TableHead>
                    <TableHead className="whitespace-nowrap">Type</TableHead>
                    <TableHead className="whitespace-nowrap">Guests</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Payment</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Calendar className="h-8 w-8 text-muted-foreground/50" />
                          <p className="text-muted-foreground">
                            No booking requests found
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((request) => {
                      const statusStyle =
                        statusStyles[request.statusLabel] || statusStyles.Pending
                      const StatusIcon = statusStyle.icon

                      return (
                        <TableRow
                          key={request.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setSelectedRequest(request)
                            setShowDetailDialog(true)
                          }}
                        >
                          <TableCell className="font-medium">{request.shortId}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.customer.name}</p>
                              {request.customer.email ? (
                                <p className="text-xs text-muted-foreground">
                                  {request.customer.email}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{request.venueName}</TableCell>
                          <TableCell>{request.eventDateLabel}</TableCell>
                          <TableCell>{request.eventType}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              {request.expectedGuests}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={statusStyle.className}
                            >
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {request.statusLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                paymentStatusStyles[request.paymentStatus] ||
                                paymentStatusStyles["Not Invoiced"]
                              }
                            >
                              {request.paymentStatus}
                            </Badge>
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
                                    setSelectedRequest(request)
                                    setShowDetailDialog(true)
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                {canManage && request.status === "pending_review" ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      disabled={isPending}
                                      onClick={() =>
                                        handleStatusUpdate(request.id, "approved")
                                      }
                                    >
                                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={isPending}
                                      onClick={() =>
                                        handleStatusUpdate(request.id, "rejected")
                                      }
                                    >
                                      <XCircle className="mr-2 h-4 w-4 text-red-600" />
                                      Reject
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
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
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Booking Request {selectedRequest?.shortId}</DialogTitle>
            <DialogDescription>
              Review and process this venue rental request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest ? (
            <div className="flex flex-col gap-6 py-4 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const statusStyle =
                    statusStyles[selectedRequest.statusLabel] ||
                    statusStyles.Pending
                  const StatusIcon = statusStyle.icon

                  return (
                    <Badge variant="secondary" className={statusStyle.className}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {selectedRequest.statusLabel}
                    </Badge>
                  )
                })()}
                <Badge
                  variant="secondary"
                  className={
                    paymentStatusStyles[selectedRequest.paymentStatus] ||
                    paymentStatusStyles["Not Invoiced"]
                  }
                >
                  {selectedRequest.paymentStatus}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Submitted {selectedRequest.submittedAtLabel}
                </span>
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" /> Customer Information
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Name</span>
                    <span className="font-medium">
                      {selectedRequest.customer.name}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Email</span>
                    <span className="font-medium">
                      {selectedRequest.customer.email || "Not provided"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Event Details
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Venue</span>
                    <span className="font-medium">{selectedRequest.venueName}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Event Type</span>
                    <span className="font-medium">{selectedRequest.eventType}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {selectedRequest.eventDateLabel}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Time</span>
                    <span className="font-medium">{selectedRequest.timeLabel}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      Expected Guests
                    </span>
                    <span className="font-medium">
                      {selectedRequest.expectedGuests}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      Estimated Total
                    </span>
                    <span className="font-medium">
                      {formatCurrency(selectedRequest.estimatedTotal)}
                    </span>
                  </div>
                </div>
                {selectedRequest.notes ? (
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-xs text-muted-foreground block mb-1">
                      Notes
                    </span>
                    <p className="text-sm">{selectedRequest.notes}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            {canManage && selectedRequest?.status === "pending_review" ? (
              <>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    handleStatusUpdate(selectedRequest.id, "rejected")
                  }
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() =>
                    handleStatusUpdate(selectedRequest.id, "approved")
                  }
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
