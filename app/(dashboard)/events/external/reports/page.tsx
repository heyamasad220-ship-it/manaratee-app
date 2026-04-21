"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  Download,
  FileText,
  FileSpreadsheet,
  Building2,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Filter,
  ChevronDown,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data
const bookingsByMonth = [
  { month: "Jan", bookings: 18, approved: 15, cancelled: 3 },
  { month: "Feb", bookings: 24, approved: 21, cancelled: 3 },
  { month: "Mar", bookings: 32, approved: 28, cancelled: 4 },
  { month: "Apr", bookings: 28, approved: 25, cancelled: 3 },
  { month: "May", bookings: 35, approved: 31, cancelled: 4 },
  { month: "Jun", bookings: 42, approved: 38, cancelled: 4 },
]

const revenueByMonth = [
  { month: "Jan", revenue: 12500, collected: 10800, outstanding: 1700 },
  { month: "Feb", revenue: 18200, collected: 16500, outstanding: 1700 },
  { month: "Mar", revenue: 24800, collected: 21200, outstanding: 3600 },
  { month: "Apr", revenue: 21500, collected: 19800, outstanding: 1700 },
  { month: "May", revenue: 28900, collected: 25400, outstanding: 3500 },
  { month: "Jun", revenue: 35600, collected: 31200, outstanding: 4400 },
]

const bookingsByVenue = [
  { name: "Grand Hall", value: 45, color: "#0ea5e9" },
  { name: "Garden Pavilion", value: 38, color: "#22c55e" },
  { name: "Conference Center", value: 32, color: "#f59e0b" },
  { name: "Rooftop Terrace", value: 24, color: "#8b5cf6" },
]

const bookingsByEventType = [
  { name: "Wedding", value: 35, color: "#ec4899" },
  { name: "Corporate", value: 42, color: "#3b82f6" },
  { name: "Birthday", value: 28, color: "#f97316" },
  { name: "Conference", value: 22, color: "#06b6d4" },
  { name: "Other", value: 12, color: "#6b7280" },
]

const detailedReportData = [
  { id: "BK-001", customer: "Sarah Johnson", venue: "Grand Hall", eventDate: "2026-03-15", eventType: "Wedding", guests: 150, total: 5500, paid: 5500, status: "Approved", paymentStatus: "Fully Paid" },
  { id: "BK-002", customer: "Tech Corp Inc.", venue: "Conference Center", eventDate: "2026-03-18", eventType: "Corporate", guests: 80, total: 3200, paid: 1600, status: "Approved", paymentStatus: "Deposit Paid" },
  { id: "BK-003", customer: "Michael Chen", venue: "Garden Pavilion", eventDate: "2026-03-20", eventType: "Birthday", guests: 60, total: 2800, paid: 840, status: "Pending", paymentStatus: "Deposit Pending" },
  { id: "BK-004", customer: "Emily Davis", venue: "Rooftop Terrace", eventDate: "2026-03-22", eventType: "Corporate", guests: 45, total: 2200, paid: 2200, status: "Approved", paymentStatus: "Fully Paid" },
  { id: "BK-005", customer: "James Wilson", venue: "Grand Hall", eventDate: "2026-03-25", eventType: "Wedding", guests: 200, total: 6800, paid: 0, status: "Cancelled", paymentStatus: "Refunded" },
  { id: "BK-006", customer: "Local Nonprofit", venue: "Conference Center", eventDate: "2026-03-28", eventType: "Conference", guests: 100, total: 1800, paid: 540, status: "Approved", paymentStatus: "Deposit Paid" },
  { id: "BK-007", customer: "Amanda Brown", venue: "Garden Pavilion", eventDate: "2026-04-01", eventType: "Birthday", guests: 40, total: 1900, paid: 1900, status: "Approved", paymentStatus: "Fully Paid" },
  { id: "BK-008", customer: "StartUp Labs", venue: "Rooftop Terrace", eventDate: "2026-04-05", eventType: "Corporate", guests: 30, total: 1500, paid: 450, status: "Pending", paymentStatus: "Deposit Pending" },
]

const venues = ["All Venues", "Grand Hall", "Garden Pavilion", "Conference Center", "Rooftop Terrace"]
const bookingStatuses = ["All Statuses", "Pending", "Approved", "Cancelled"]
const paymentStatuses = ["All Payment Status", "Deposit Pending", "Deposit Paid", "Fully Paid", "Refunded"]

export default function VenueRentalsReportsPage() {
  const [dateRange, setDateRange] = useState("90d")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [venueFilter, setVenueFilter] = useState("All Venues")
  const [statusFilter, setStatusFilter] = useState("All Statuses")
  const [paymentFilter, setPaymentFilter] = useState("All Payment Status")
  const [showFilters, setShowFilters] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Approved</Badge>
      case "Pending":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>
      case "Cancelled":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "Fully Paid":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Fully Paid</Badge>
      case "Deposit Paid":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Deposit Paid</Badge>
      case "Deposit Pending":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Deposit Pending</Badge>
      case "Refunded":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Refunded</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Summary calculations
  const totalBookings = 179
  const approvedBookings = 158
  const cancelledBookings = 21
  const revenueCollected = 124900
  const outstandingBalances = 16600
  const venueUtilization = 72

  return (
    <>
<Header title="Venue Rental Reports" />
  <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        {/* Header Actions */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Analytics & Reports</h2>
            <p className="text-sm text-muted-foreground">Track bookings, revenue, and venue performance</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {(venueFilter !== "All Venues" || statusFilter !== "All Statuses" || paymentFilter !== "All Payment Status") && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {[venueFilter !== "All Venues", statusFilter !== "All Statuses", paymentFilter !== "All Payment Status"].filter(Boolean).length}
                </span>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileText className="mr-2 h-4 w-4" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="flex flex-col gap-2">
                  <Label>Date Range</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                      <SelectItem value="1y">Last year</SelectItem>
                      <SelectItem value="custom">Custom range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {dateRange === "custom" && (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>End Date</Label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </>
                )}
                <div className="flex flex-col gap-2">
                  <Label>Venue</Label>
                  <Select value={venueFilter} onValueChange={setVenueFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.map((venue) => (
                        <SelectItem key={venue} value={venue}>{venue}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Booking Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bookingStatuses.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Payment Status</Label>
                  <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentStatuses.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setVenueFilter("All Venues")
                    setStatusFilter("All Statuses")
                    setPaymentFilter("All Payment Status")
                    setDateRange("90d")
                    setStartDate("")
                    setEndDate("")
                  }}
                >
                  Clear Filters
                </Button>
                <Button size="sm">Apply Filters</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBookings}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-emerald-600">+12%</span> from last period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved Bookings</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{approvedBookings}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((approvedBookings / totalBookings) * 100)}% approval rate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cancelled Bookings</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{cancelledBookings}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((cancelledBookings / totalBookings) * 100)}% cancellation rate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Collected</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(revenueCollected)}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-emerald-600">+18%</span> from last period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balances</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(outstandingBalances)}</div>
              <p className="text-xs text-muted-foreground">
                Across 12 bookings
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Venue Utilization</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{venueUtilization}%</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-emerald-600">+5%</span> from last period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {/* Bookings by Month */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bookings by Month</CardTitle>
              <CardDescription>Monthly booking trends (approved vs cancelled)</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  approved: { label: "Approved", color: "hsl(var(--chart-1))" },
                  cancelled: { label: "Cancelled", color: "hsl(var(--chart-2))" },
                }}
                className="h-[280px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bookingsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="approved" fill="#22c55e" radius={[4, 4, 0, 0]} name="Approved" />
                    <Bar dataKey="cancelled" fill="#ef4444" radius={[4, 4, 0, 0]} name="Cancelled" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Revenue by Month */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue by Month</CardTitle>
              <CardDescription>Monthly revenue (collected vs outstanding)</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  collected: { label: "Collected", color: "hsl(var(--chart-1))" },
                  outstanding: { label: "Outstanding", color: "hsl(var(--chart-3))" },
                }}
                className="h-[280px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${(value / 1000)}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="collected" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e" }} name="Collected" />
                    <Line type="monotone" dataKey="outstanding" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b" }} name="Outstanding" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Bookings by Venue */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bookings by Venue</CardTitle>
              <CardDescription>Distribution of bookings across venues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <ChartContainer
                  config={{
                    value: { label: "Bookings" },
                  }}
                  className="h-[200px] w-[200px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bookingsByVenue}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {bookingsByVenue.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="flex flex-col gap-2">
                  {bookingsByVenue.map((venue) => (
                    <div key={venue.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: venue.color }} />
                      <span className="text-muted-foreground">{venue.name}</span>
                      <span className="ml-auto font-medium">{venue.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bookings by Event Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bookings by Event Type</CardTitle>
              <CardDescription>Distribution of bookings by event category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <ChartContainer
                  config={{
                    value: { label: "Bookings" },
                  }}
                  className="h-[200px] w-[200px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bookingsByEventType}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {bookingsByEventType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="flex flex-col gap-2">
                  {bookingsByEventType.map((type) => (
                    <div key={type.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color }} />
                      <span className="text-muted-foreground">{type.name}</span>
                      <span className="ml-auto font-medium">{type.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Report Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Detailed Booking Report</CardTitle>
                <CardDescription>Complete list of all bookings in the selected period</CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                Showing {detailedReportData.length} of {detailedReportData.length} bookings
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Event Date</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Guests</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedReportData.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium text-primary">{booking.id}</TableCell>
                      <TableCell>{booking.customer}</TableCell>
                      <TableCell>{booking.venue}</TableCell>
                      <TableCell>{formatDate(booking.eventDate)}</TableCell>
                      <TableCell>{booking.eventType}</TableCell>
                      <TableCell>{booking.guests}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(booking.total)}</TableCell>
                      <TableCell className={cn("font-medium", booking.paid === booking.total ? "text-emerald-600" : "")}>
                        {formatCurrency(booking.paid)}
                      </TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell>{getPaymentStatusBadge(booking.paymentStatus)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
