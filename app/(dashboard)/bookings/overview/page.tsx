"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  ClipboardList,
  CalendarCheck,
  Baby,
  Users,
  Truck,
  Ticket,
  Clock,
  AlertTriangle,
  ChevronRight,
  Download,
  Ban,
  Eye,
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
  MessageSquare,
} from "lucide-react"
import { InternalEventStatusBadge, type InternalEventStatus } from "@/lib/status-badges"
import { cn } from "@/lib/utils"

// Mock data for KPI cards (Internal Events)
const kpiData = {
  pendingRequests: 8,
  approvedEvents: 24,
  childcareRequired: 5,
  volunteersRequired: 12,
  vendorsRequired: 3,
  ticketedEvents: 7,
}

// Mock data for recent internal event requests
const recentRequests = [
  {
    id: "REQ-2024-001",
    eventName: "Youth Basketball Tournament",
    requestedBy: "Ahmed Hassan",
    requestedDate: "Mar 25, 2024",
    eventDate: "Apr 15, 2024",
    space: "Gymnasium",
    status: "Pending Review" as InternalEventStatus,
  },
  {
    id: "REQ-2024-002",
    eventName: "Sisters Halaqa",
    requestedBy: "Fatima Ali",
    requestedDate: "Mar 24, 2024",
    eventDate: "Apr 3, 2024",
    space: "Multi-Purpose Room",
    status: "Submitted" as InternalEventStatus,
  },
  {
    id: "REQ-2024-003",
    eventName: "Fundraising Gala",
    requestedBy: "Omar Sheikh",
    requestedDate: "Mar 23, 2024",
    eventDate: "May 10, 2024",
    space: "Main Hall",
    status: "Needs Changes" as InternalEventStatus,
  },
  {
    id: "REQ-2024-004",
    eventName: "Quran Competition",
    requestedBy: "Ibrahim Khan",
    requestedDate: "Mar 22, 2024",
    eventDate: "Apr 20, 2024",
    space: "Main Hall",
    status: "Approved" as InternalEventStatus,
  },
]

// Mock data for today's schedule
const todaysSchedule = [
  {
    id: "1",
    eventName: "Jummah Prayer",
    time: "1:00 PM - 2:30 PM",
    space: "Main Hall",
    status: "Scheduled" as InternalEventStatus,
    attendees: 450,
  },
  {
    id: "2",
    eventName: "Arabic Class - Beginners",
    time: "3:00 PM - 4:30 PM",
    space: "Classroom A",
    status: "Scheduled" as InternalEventStatus,
    attendees: 25,
  },
  {
    id: "3",
    eventName: "Youth Study Circle",
    time: "5:00 PM - 6:30 PM",
    space: "Multi-Purpose Room",
    status: "Scheduled" as InternalEventStatus,
    attendees: 35,
  },
  {
    id: "4",
    eventName: "Board Meeting",
    time: "7:00 PM - 9:00 PM",
    space: "Conference Room",
    status: "Scheduled" as InternalEventStatus,
    attendees: 12,
  },
]

// Mock data for operational alerts
const operationalAlerts = [
  {
    id: "1",
    type: "warning",
    message: "Youth Basketball Tournament needs 6 more volunteers",
    eventDate: "Apr 15, 2024",
    action: "Assign Volunteers",
  },
  {
    id: "2",
    type: "warning",
    message: "Fundraising Gala awaiting vendor confirmation for catering",
    eventDate: "May 10, 2024",
    action: "Contact Vendor",
  },
  {
    id: "3",
    type: "info",
    message: "Sisters Retreat childcare request pending assignment",
    eventDate: "Apr 8, 2024",
    action: "Assign Childcare",
  },
]

// Mock data for events needing action
const eventsNeedingAction = [
  {
    id: "1",
    eventName: "Community Iftar",
    eventDate: "Apr 5, 2024",
    actionRequired: "Confirm venue setup",
    daysUntil: 10,
    priority: "high",
  },
  {
    id: "2",
    eventName: "Youth Basketball Tournament",
    eventDate: "Apr 15, 2024",
    actionRequired: "Finalize volunteer schedule",
    daysUntil: 20,
    priority: "medium",
  },
  {
    id: "3",
    eventName: "Fundraising Gala",
    eventDate: "May 10, 2024",
    actionRequired: "Review vendor contracts",
    daysUntil: 45,
    priority: "low",
  },
]

// Mock data for venue rental requests
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

const mockVenueRequests: BookingRequest[] = [
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

export default function BookingsDashboardPage() {
  const [timePeriod, setTimePeriod] = useState("this-week")
  const [activeTab, setActiveTab] = useState<"internal" | "venue">("internal")
  const [venueRequests, setVenueRequests] = useState<BookingRequest[]>(mockVenueRequests)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount)
  }

  const filteredVenueRequests = venueRequests.filter((request) => {
    const matchesSearch = 
      request.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      request.customer.email.toLowerCase().includes(search.toLowerCase()) ||
      request.id.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || request.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const venuePendingCount = venueRequests.filter(r => r.status === "Pending").length
  const venueApprovedCount = venueRequests.filter(r => r.status === "Approved").length
  const venueOverdueCount = venueRequests.filter(r => r.paymentStatus === "Overdue").length

  const handleApprove = (id: string) => {
    setVenueRequests(prev => prev.map(r => r.id === id ? { ...r, status: "Approved" as const } : r))
    setShowDetailDialog(false)
  }

  const handleReject = (id: string) => {
    setVenueRequests(prev => prev.map(r => r.id === id ? { ...r, status: "Rejected" as const } : r))
    setShowDetailDialog(false)
  }

  return (
    <>
      <Header title="Bookings Dashboard" />
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        {/* Page Header with Tab Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor all booking requests, operations, and schedules
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <button
                onClick={() => setActiveTab("internal")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === "internal"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Internal Events
              </button>
              <button
                onClick={() => setActiveTab("venue")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === "venue"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Venue Rentals
              </button>
            </div>
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-[140px] bg-card">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Internal Events Tab */}
        {activeTab === "internal" && (
          <>
            {/* KPI Cards */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                      <ClipboardList className="h-5 w-5 text-amber-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-foreground">{kpiData.pendingRequests}</p>
                      <p className="text-xs text-muted-foreground truncate">Pending Requests</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                      <CalendarCheck className="h-5 w-5 text-emerald-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-foreground">{kpiData.approvedEvents}</p>
                      <p className="text-xs text-muted-foreground truncate">Approved Events</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-100">
                      <Baby className="h-5 w-5 text-pink-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-foreground">{kpiData.childcareRequired}</p>
                      <p className="text-xs text-muted-foreground truncate">Need Childcare</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                      <Users className="h-5 w-5 text-blue-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-foreground">{kpiData.volunteersRequired}</p>
                      <p className="text-xs text-muted-foreground truncate">Need Volunteers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                      <Truck className="h-5 w-5 text-orange-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-foreground">{kpiData.vendorsRequired}</p>
                      <p className="text-xs text-muted-foreground truncate">Need Vendors</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                      <Ticket className="h-5 w-5 text-violet-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-foreground">{kpiData.ticketedEvents}</p>
                      <p className="text-xs text-muted-foreground truncate">Ticketed Events</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button asChild className="h-9 sm:h-10">
                <Link href="/events/new">
                  <Eye className="mr-1.5 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Review Requests</span>
                  <span className="sm:hidden">Review</span>
                  <Badge variant="secondary" className="ml-1.5 sm:ml-2 bg-white/20">{kpiData.pendingRequests}</Badge>
                </Link>
              </Button>
              <Button variant="outline" className="h-9 sm:h-10">
                <Ban className="mr-1.5 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Block Space</span>
                <span className="sm:hidden">Block</span>
              </Button>
              <Button variant="outline" className="h-9 sm:h-10">
                <Baby className="mr-1.5 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Assign Childcare</span>
                <span className="sm:hidden">Childcare</span>
              </Button>
              <Button variant="outline" className="h-9 sm:h-10">
                <Users className="mr-1.5 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Open Volunteer Needs</span>
                <span className="sm:hidden">Volunteers</span>
              </Button>
              <Button variant="outline" className="h-9 sm:h-10">
                <Download className="mr-1.5 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Export Report</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              {/* Recent Event Requests */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Recent Event Requests</CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/events/new" className="text-xs">
                        View All
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">Event</TableHead>
                          <TableHead className="text-xs">Space</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentRequests.map((request) => (
                          <TableRow key={request.id} className="group">
                            <TableCell className="py-2.5">
                              <div>
                                <p className="font-medium text-sm">{request.eventName}</p>
                                <p className="text-xs text-muted-foreground">{request.requestedBy}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-sm">{request.space}</TableCell>
                            <TableCell className="py-2.5 text-sm">{request.eventDate}</TableCell>
                            <TableCell className="py-2.5">
                              <InternalEventStatusBadge status={request.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Today's Internal Schedule */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Today&apos;s Schedule</CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/events/external/calendar" className="text-xs">
                        View Calendar
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">Event</TableHead>
                          <TableHead className="text-xs">Time</TableHead>
                          <TableHead className="text-xs">Space</TableHead>
                          <TableHead className="text-xs text-right">Attendees</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {todaysSchedule.map((event) => (
                          <TableRow key={event.id} className="group">
                            <TableCell className="py-2.5">
                              <p className="font-medium text-sm">{event.eventName}</p>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-1.5 text-sm">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {event.time}
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-sm">{event.space}</TableCell>
                            <TableCell className="py-2.5 text-sm text-right">{event.attendees}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              {/* Operational Alerts */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Operational Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {operationalAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-lg border p-3",
                        alert.type === "warning" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Event: {alert.eventDate}</p>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs">
                        {alert.action}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Upcoming Events Needing Action */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Events Needing Action</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {eventsNeedingAction.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{event.eventName}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] shrink-0",
                              event.priority === "high" && "border-red-200 bg-red-50 text-red-700",
                              event.priority === "medium" && "border-amber-200 bg-amber-50 text-amber-700",
                              event.priority === "low" && "border-gray-200 bg-gray-50 text-gray-600"
                            )}
                          >
                            {event.daysUntil}d
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{event.actionRequired}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="shrink-0 h-8">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Venue Rentals Tab */}
        {activeTab === "venue" && (
          <>
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
                      <p className="text-2xl font-bold">{venuePendingCount}</p>
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
                      <p className="text-2xl font-bold">{venueApprovedCount}</p>
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
                      <p className="text-2xl font-bold">{venueOverdueCount}</p>
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
                      <p className="text-2xl font-bold">{formatCurrency(venueRequests.filter(r => r.status === "Pending").reduce((sum, r) => sum + r.estimatedTotal, 0))}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1">
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
                  <Button variant="outline" size="sm" className="h-10">
                    <Download className="mr-1.5 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Venue Requests Table */}
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
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVenueRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="h-32 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <Calendar className="h-8 w-8 text-muted-foreground/50" />
                              <p className="text-muted-foreground">No booking requests found</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredVenueRequests.map((request) => {
                          const StatusIcon = statusStyles[request.status].icon
                          return (
                            <TableRow 
                              key={request.id} 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => { setSelectedRequest(request); setShowDetailDialog(true); }}
                            >
                              <TableCell className="font-medium">{request.id}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{request.customer.name}</p>
                                  <p className="text-xs text-muted-foreground">{request.customer.email}</p>
                                </div>
                              </TableCell>
                              <TableCell>{request.venue}</TableCell>
                              <TableCell>{request.eventDate}</TableCell>
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
              </CardContent>
            </Card>
          </>
        )}

        {/* Detail Dialog for Venue Requests */}
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
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Type</span>
                      <span className="font-medium">{selectedRequest.customer.type}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Email</span>
                      <span className="font-medium">{selectedRequest.customer.email}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Phone</span>
                      <span className="font-medium">{selectedRequest.customer.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Event Details */}
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Event Details
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Venue</span>
                      <span className="font-medium">{selectedRequest.venue}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Event Type</span>
                      <span className="font-medium">{selectedRequest.eventType}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Date</span>
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
                      <span className="font-medium">{formatCurrency(selectedRequest.estimatedTotal)}</span>
                    </div>
                  </div>
                  {selectedRequest.specialRequests && (
                    <div className="mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground block mb-1">Special Requests</span>
                      <p className="text-sm">{selectedRequest.specialRequests}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              {selectedRequest?.status === "Pending" && (
                <>
                  <Button variant="outline" onClick={() => handleReject(selectedRequest.id)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button onClick={() => handleApprove(selectedRequest.id)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </>
              )}
              {selectedRequest?.status !== "Pending" && (
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                  Close
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
