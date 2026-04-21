"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/lib/status-badges"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Clock,
  Search,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Building2,
  User,
  Phone,
  Mail,
  DollarSign,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MessageSquare,
  Ban,
  Users,
} from "lucide-react"

interface BookingRequest {
  id: string
  customer: {
    name: string
    email: string
    phone: string
    type: "Individual" | "Organization"
  }
  venue: string
  eventType: string
  eventDate: string
  startTime: string
  endTime: string
  expectedGuests: number
  submittedAt: string
  status: "Pending" | "Approved" | "Rejected" | "Cancelled"
  paymentStatus: "Not Invoiced" | "Invoice Sent" | "Deposit Paid" | "Fully Paid" | "Overdue"
  estimatedTotal: number
  notes?: string
  specialRequests?: string
}

const mockRequests: BookingRequest[] = [
  {
    id: "REQ-001",
    customer: { name: "Emily Chen", email: "emily.chen@email.com", phone: "(555) 123-4567", type: "Individual" },
    venue: "Main Hall",
    eventType: "Wedding",
    eventDate: "Jun 15, 2026",
    startTime: "4:00 PM",
    endTime: "11:00 PM",
    expectedGuests: 300,
    submittedAt: "Mar 20, 2026 10:30 AM",
    status: "Pending",
    paymentStatus: "Not Invoiced",
    estimatedTotal: 4500,
    specialRequests: "Need space for live band setup. Prefer round tables.",
  },
  {
    id: "REQ-002",
    customer: { name: "Corporate Plus LLC", email: "events@corporateplus.com", phone: "(555) 234-5678", type: "Organization" },
    venue: "Conference Room A",
    eventType: "Workshop",
    eventDate: "Apr 10, 2026",
    startTime: "9:00 AM",
    endTime: "5:00 PM",
    expectedGuests: 40,
    submittedAt: "Mar 21, 2026 2:15 PM",
    status: "Pending",
    paymentStatus: "Not Invoiced",
    estimatedTotal: 800,
    notes: "Returning customer - 3rd booking this year",
  },
  {
    id: "REQ-003",
    customer: { name: "Fatima Ali", email: "fatima.ali@email.com", phone: "(555) 345-6789", type: "Individual" },
    venue: "Garden Pavilion",
    eventType: "Baby Shower",
    eventDate: "May 5, 2026",
    startTime: "2:00 PM",
    endTime: "6:00 PM",
    expectedGuests: 50,
    submittedAt: "Mar 22, 2026 9:45 AM",
    status: "Pending",
    paymentStatus: "Not Invoiced",
    estimatedTotal: 1200,
    specialRequests: "Pink and gold decorations theme. Need high chairs for kids.",
  },
  {
    id: "REQ-004",
    customer: { name: "Tech Innovations Inc", email: "admin@techinnovations.com", phone: "(555) 456-7890", type: "Organization" },
    venue: "Main Hall",
    eventType: "Conference",
    eventDate: "May 20, 2026",
    startTime: "8:00 AM",
    endTime: "6:00 PM",
    expectedGuests: 400,
    submittedAt: "Mar 18, 2026 11:20 AM",
    status: "Approved",
    paymentStatus: "Deposit Paid",
    estimatedTotal: 5500,
  },
  {
    id: "REQ-005",
    customer: { name: "James Thompson", email: "james.t@email.com", phone: "(555) 567-8901", type: "Individual" },
    venue: "Banquet Room",
    eventType: "Birthday Party",
    eventDate: "Apr 25, 2026",
    startTime: "6:00 PM",
    endTime: "10:00 PM",
    expectedGuests: 80,
    submittedAt: "Mar 15, 2026 3:30 PM",
    status: "Approved",
    paymentStatus: "Fully Paid",
    estimatedTotal: 2200,
  },
  {
    id: "REQ-006",
    customer: { name: "Sarah Johnson", email: "sarah.j@email.com", phone: "(555) 678-9012", type: "Individual" },
    venue: "Garden Pavilion",
    eventType: "Engagement Party",
    eventDate: "Apr 5, 2026",
    startTime: "3:00 PM",
    endTime: "8:00 PM",
    expectedGuests: 75,
    submittedAt: "Mar 10, 2026 4:00 PM",
    status: "Rejected",
    paymentStatus: "Not Invoiced",
    estimatedTotal: 1500,
    notes: "Venue unavailable - conflicting booking",
  },
  {
    id: "REQ-007",
    customer: { name: "Michael Brown", email: "michael.b@email.com", phone: "(555) 789-0123", type: "Individual" },
    venue: "Conference Room A",
    eventType: "Meeting",
    eventDate: "Mar 28, 2026",
    startTime: "10:00 AM",
    endTime: "12:00 PM",
    expectedGuests: 15,
    submittedAt: "Mar 12, 2026 8:00 AM",
    status: "Cancelled",
    paymentStatus: "Not Invoiced",
    estimatedTotal: 200,
    notes: "Customer cancelled due to schedule change",
  },
  {
    id: "REQ-008",
    customer: { name: "Aisha Rahman", email: "aisha.r@email.com", phone: "(555) 890-1234", type: "Individual" },
    venue: "Main Hall",
    eventType: "Wedding",
    eventDate: "Jul 20, 2026",
    startTime: "5:00 PM",
    endTime: "11:00 PM",
    expectedGuests: 350,
    submittedAt: "Mar 23, 2026 1:00 PM",
    status: "Approved",
    paymentStatus: "Invoice Sent",
    estimatedTotal: 5000,
    specialRequests: "Halal catering required. Separate sections for men and women.",
  },
  {
    id: "REQ-009",
    customer: { name: "Summit Events Co", email: "booking@summitevents.com", phone: "(555) 901-2345", type: "Organization" },
    venue: "Banquet Room",
    eventType: "Seminar",
    eventDate: "Apr 18, 2026",
    startTime: "9:00 AM",
    endTime: "4:00 PM",
    expectedGuests: 100,
    submittedAt: "Mar 19, 2026 10:15 AM",
    status: "Approved",
    paymentStatus: "Overdue",
    estimatedTotal: 1800,
    notes: "Payment reminder sent on Mar 25",
  },
  {
    id: "REQ-010",
    customer: { name: "David Lee", email: "david.lee@email.com", phone: "(555) 012-3456", type: "Individual" },
    venue: "Garden Pavilion",
    eventType: "Private Dinner",
    eventDate: "Apr 30, 2026",
    startTime: "7:00 PM",
    endTime: "10:00 PM",
    expectedGuests: 30,
    submittedAt: "Mar 24, 2026 6:30 PM",
    status: "Pending",
    paymentStatus: "Not Invoiced",
    estimatedTotal: 900,
  },
]

const statusStyles: Record<string, { className: string; icon: typeof CheckCircle2 }> = {
  Pending: { className: "bg-amber-100 text-amber-700", icon: Clock },
  Approved: { className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  Rejected: { className: "bg-red-100 text-red-700", icon: XCircle },
  Cancelled: { className: "bg-gray-100 text-gray-600", icon: Ban },
}

const paymentStatusStyles: Record<string, string> = {
  "Not Invoiced": "bg-gray-100 text-gray-600",
  "Invoice Sent": "bg-blue-100 text-blue-700",
  "Deposit Paid": "bg-cyan-100 text-cyan-700",
  "Fully Paid": "bg-emerald-100 text-emerald-700",
  "Overdue": "bg-red-100 text-red-700",
}

const ITEMS_PER_PAGE = 8

export default function BookingRequestsPage() {
  const [requests, setRequests] = useState<BookingRequest[]>(mockRequests)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [venueFilter, setVenueFilter] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showChangesDialog, setShowChangesDialog] = useState(false)
  const [changesMessage, setChangesMessage] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount)
  }

  const filteredRequests = requests.filter((request) => {
    const matchesSearch = 
      request.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      request.customer.email.toLowerCase().includes(search.toLowerCase()) ||
      request.id.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || request.status === statusFilter
    const matchesVenue = venueFilter === "all" || request.venue === venueFilter
    const matchesPayment = paymentFilter === "all" || request.paymentStatus === paymentFilter
    return matchesSearch && matchesStatus && matchesVenue && matchesPayment
  })

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE)
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const pendingCount = requests.filter(r => r.status === "Pending").length
  const approvedCount = requests.filter(r => r.status === "Approved").length
  const overdueCount = requests.filter(r => r.paymentStatus === "Overdue").length

  const handleApprove = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "Approved" as const } : r))
    setShowDetailDialog(false)
  }

  const handleReject = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "Rejected" as const } : r))
    setShowDetailDialog(false)
  }

  const handleCancel = (id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "Cancelled" as const } : r))
    setShowDetailDialog(false)
  }

  const handleRequestChanges = () => {
    if (selectedRequest && changesMessage) {
      // In a real app, this would send an email to the customer
      setShowChangesDialog(false)
      setChangesMessage("")
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedRequests.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(paginatedRequests.map(r => r.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const venues = [...new Set(requests.map(r => r.venue))]

  return (
    <>
      <Header title="Booking Requests" />
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
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
                  <p className="text-2xl font-bold">{approvedCount}</p>
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
                  <p className="text-2xl font-bold">{overdueCount}</p>
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
                  <p className="text-2xl font-bold">{formatCurrency(requests.filter(r => r.status === "Pending").reduce((sum, r) => sum + r.estimatedTotal, 0))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:gap-4">
              {/* Search - Full width on mobile */}
              <div className="w-full">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
              </div>

              {/* Filter Grid - 2 cols on mobile, row on desktop */}
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
                {/* Status Filter */}
                <div className="w-full sm:w-[140px]">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Venue Filter */}
                <div className="w-full sm:w-[160px]">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Venue</Label>
                  <Select value={venueFilter} onValueChange={setVenueFilter}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="All Venues" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Venues</SelectItem>
                      {venues.map((venue) => (
                        <SelectItem key={venue} value={venue}>{venue}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Status Filter */}
                <div className="w-full sm:w-[140px]">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Payment</Label>
                  <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Payments</SelectItem>
                      <SelectItem value="Not Invoiced">Not Invoiced</SelectItem>
                      <SelectItem value="Invoice Sent">Invoice Sent</SelectItem>
                      <SelectItem value="Deposit Paid">Deposit Paid</SelectItem>
                      <SelectItem value="Fully Paid">Fully Paid</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div className="w-full sm:w-[140px]">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">From</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10" />
                </div>
              </div>

              {/* Actions Row */}
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-2">
                  {selectedIds.length > 0 && (
                    <Button variant="outline" size="sm" className="h-9">
                      Bulk Actions ({selectedIds.length})
                    </Button>
                  )}
                </div>
                <Button variant="outline" size="sm" className="h-9">
                  <Download className="mr-1.5 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto -mx-px">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[44px] pl-3 sm:pl-4">
                      <Checkbox 
                        checked={selectedIds.length === paginatedRequests.length && paginatedRequests.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Request ID</TableHead>
                    <TableHead className="min-w-[160px]">Customer</TableHead>
                    <TableHead className="whitespace-nowrap">Venue</TableHead>
                    <TableHead className="whitespace-nowrap">Event Date</TableHead>
                    <TableHead className="whitespace-nowrap">Time</TableHead>
                    <TableHead className="whitespace-nowrap">Type</TableHead>
                    <TableHead className="whitespace-nowrap">Guests</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Payment</TableHead>
                    <TableHead className="whitespace-nowrap">Submitted</TableHead>
                    <TableHead className="w-[60px] pr-3 sm:pr-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Calendar className="h-8 w-8 text-muted-foreground/50" />
                          <p className="text-muted-foreground">No booking requests found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRequests.map((request) => {
                      const StatusIcon = statusStyles[request.status].icon
                      return (
                        <TableRow 
                          key={request.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => { setSelectedRequest(request); setShowDetailDialog(true); }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedIds.includes(request.id)}
                              onCheckedChange={() => toggleSelect(request.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{request.id}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.customer.name}</p>
                              <p className="text-xs text-muted-foreground">{request.customer.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{request.venue}</TableCell>
                          <TableCell>{request.eventDate}</TableCell>
                          <TableCell className="text-sm">
                            {request.startTime} - {request.endTime}
                          </TableCell>
                          <TableCell>{request.eventType}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              {request.expectedGuests}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={statusStyles[request.status].className}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={paymentStatusStyles[request.paymentStatus]}>
                              {request.paymentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {request.submittedAt.split(" ").slice(0, 3).join(" ")}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedRequest(request); setShowDetailDialog(true); }}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                {request.status === "Pending" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleApprove(request.id)}>
                                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleReject(request.id)}>
                                      <XCircle className="mr-2 h-4 w-4 text-red-600" />
                                      Reject
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setSelectedRequest(request); setShowChangesDialog(true); }}>
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                      Request Changes
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {(request.status === "Pending" || request.status === "Approved") && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleCancel(request.id)} className="text-red-600">
                                      <Ban className="mr-2 h-4 w-4" />
                                      Mark as Cancelled
                                    </DropdownMenuItem>
                                  </>
                                )}
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

            {/* Pagination */}
            {filteredRequests.length > 0 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} results
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        className="w-8"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Booking Request {selectedRequest?.id}</DialogTitle>
              <DialogDescription>Review and process this booking request</DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="flex flex-col gap-6 py-4 max-h-[60vh] overflow-y-auto">
                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const StatusIcon = statusStyles[selectedRequest.status].icon
                    return (
                      <Badge variant="secondary" className={statusStyles[selectedRequest.status].className}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {selectedRequest.status}
                      </Badge>
                    )
                  })()}
                  <Badge variant="secondary" className={paymentStatusStyles[selectedRequest.paymentStatus]}>
                    {selectedRequest.paymentStatus}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Submitted {selectedRequest.submittedAt}</span>
                </div>

                {/* Customer Info */}
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" /> Customer Information
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Name</span>
                      <span className="font-medium">{selectedRequest.customer.name}</span>
                      <Badge variant="outline" className="w-fit mt-1">{selectedRequest.customer.type}</Badge>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {selectedRequest.customer.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {selectedRequest.customer.phone}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Event Details */}
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Event Details
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Venue</span>
                      <span className="font-medium flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {selectedRequest.venue}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Event Type</span>
                      <span className="font-medium">{selectedRequest.eventType}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Event Date</span>
                      <span className="font-medium">{selectedRequest.eventDate}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Time</span>
                      <span className="font-medium">{selectedRequest.startTime} - {selectedRequest.endTime}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Expected Guests</span>
                      <span className="font-medium">{selectedRequest.expectedGuests}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Estimated Total</span>
                      <span className="font-medium text-lg text-emerald-600">{formatCurrency(selectedRequest.estimatedTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Special Requests */}
                {selectedRequest.specialRequests && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Special Requests
                    </h4>
                    <p className="text-sm">{selectedRequest.specialRequests}</p>
                  </div>
                )}

                {/* Notes */}
                {selectedRequest.notes && (
                  <div className="rounded-lg bg-blue-50 p-4">
                    <h4 className="text-sm font-semibold mb-2 text-blue-700">Admin Notes</h4>
                    <p className="text-sm text-blue-700">{selectedRequest.notes}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
              {selectedRequest?.status === "Pending" && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => { setShowDetailDialog(false); setShowChangesDialog(true); }}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Request Changes
                  </Button>
                  <Button 
                    variant="outline" 
                    className="text-red-600 hover:text-red-700" 
                    onClick={() => handleReject(selectedRequest.id)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button onClick={() => handleApprove(selectedRequest.id)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </>
              )}
              {(selectedRequest?.status === "Pending" || selectedRequest?.status === "Approved") && (
                <Button 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700" 
                  onClick={() => handleCancel(selectedRequest.id)}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel Booking
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request Changes Dialog */}
        <Dialog open={showChangesDialog} onOpenChange={setShowChangesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Changes</DialogTitle>
              <DialogDescription>
                Send a message to {selectedRequest?.customer.name} requesting changes to their booking.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="changes-message">Message to Customer</Label>
              <Textarea
                id="changes-message"
                value={changesMessage}
                onChange={(e) => setChangesMessage(e.target.value)}
                placeholder="Please describe what changes are needed for this booking request..."
                rows={4}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowChangesDialog(false); setChangesMessage(""); }}>
                Cancel
              </Button>
              <Button onClick={handleRequestChanges} disabled={!changesMessage.trim()}>
                Send Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
