"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Building2,
  Calendar,
  DollarSign,
  Clock,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
  AlertTriangle,
  CalendarX,
  FileText,
  CreditCard,
  Ban,
  Download,
} from "lucide-react"
import Link from "next/link"

// Mock data
const stats = {
  pendingRequests: 8,
  approvedBookings: 24,
  depositPending: 5,
  upcomingEvents: 12,
  overdueBalances: 3,
  overdueAmount: 4850,
}

const recentRequests = [
  { id: "REQ-015", customer: "Emily Chen", email: "emily@example.com", venue: "Grand Hall", eventType: "Wedding", requestDate: "Mar 22, 2026", eventDate: "Jun 15, 2026", guestCount: 200, status: "Pending Review" },
  { id: "REQ-014", customer: "Corporate Plus LLC", email: "events@corpplus.com", venue: "Conference Room A", eventType: "Workshop", requestDate: "Mar 21, 2026", eventDate: "Apr 10, 2026", guestCount: 50, status: "Pending Review" },
  { id: "REQ-013", customer: "Fatima Ali", email: "fatima@email.com", venue: "Garden Pavilion", eventType: "Baby Shower", requestDate: "Mar 20, 2026", eventDate: "May 5, 2026", guestCount: 35, status: "Pending Review" },
  { id: "REQ-012", customer: "Tech Solutions Inc", email: "bookings@techsol.com", venue: "Grand Hall", eventType: "Conference", requestDate: "Mar 19, 2026", eventDate: "Apr 18, 2026", guestCount: 150, status: "Approved" },
  { id: "REQ-011", customer: "John Smith", email: "john.smith@email.com", venue: "Banquet Room", eventType: "Birthday Party", requestDate: "Mar 18, 2026", eventDate: "Apr 2, 2026", guestCount: 75, status: "Deposit Paid" },
]

const todaySchedule = [
  { id: "EVT-001", time: "9:00 AM - 12:00 PM", venue: "Conference Room A", customer: "Acme Corp", eventType: "Team Meeting", status: "In Progress" },
  { id: "EVT-002", time: "2:00 PM - 6:00 PM", venue: "Grand Hall", customer: "Sarah Johnson", eventType: "Wedding Reception", status: "Upcoming" },
  { id: "EVT-003", time: "3:00 PM - 5:00 PM", venue: "Garden Pavilion", customer: "Local Non-Profit", eventType: "Fundraiser", status: "Upcoming" },
  { id: "EVT-004", time: "6:00 PM - 10:00 PM", venue: "Banquet Room", customer: "Martinez Family", eventType: "Anniversary Dinner", status: "Upcoming" },
]

const paymentAlerts = [
  { id: "PAY-001", customer: "Tech Solutions Inc", venue: "Grand Hall", eventDate: "Apr 18, 2026", type: "Deposit Due", amount: 2250, dueDate: "Mar 25, 2026", daysOverdue: 0 },
  { id: "PAY-002", customer: "Wedding Dreams LLC", venue: "Grand Hall", eventDate: "Apr 5, 2026", type: "Balance Overdue", amount: 2800, dueDate: "Mar 20, 2026", daysOverdue: 4 },
  { id: "PAY-003", customer: "Community Center", venue: "Banquet Room", eventDate: "Mar 28, 2026", type: "Balance Overdue", amount: 1200, dueDate: "Mar 14, 2026", daysOverdue: 10 },
  { id: "PAY-004", customer: "Ahmed Hassan", venue: "Conference Room A", eventDate: "Apr 2, 2026", type: "Deposit Due", amount: 400, dueDate: "Mar 26, 2026", daysOverdue: 0 },
  { id: "PAY-005", customer: "Johnson Family", venue: "Garden Pavilion", eventDate: "Mar 30, 2026", type: "Balance Overdue", amount: 850, dueDate: "Mar 16, 2026", daysOverdue: 8 },
]

type BookingStatus = "Pending Review" | "Approved" | "Rejected" | "Deposit Pending" | "Deposit Paid" | "Fully Paid" | "Cancelled"

const statusStyles: Record<BookingStatus, { className: string; icon: typeof CheckCircle2 }> = {
  "Pending Review": { className: "bg-amber-100 text-amber-700", icon: Clock },
  "Approved": { className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  "Rejected": { className: "bg-red-100 text-red-700", icon: XCircle },
  "Deposit Pending": { className: "bg-orange-100 text-orange-700", icon: AlertCircle },
  "Deposit Paid": { className: "bg-blue-100 text-blue-700", icon: DollarSign },
  "Fully Paid": { className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  "Cancelled": { className: "bg-gray-100 text-gray-700", icon: Ban },
}

const scheduleStatusStyles: Record<string, string> = {
  "In Progress": "bg-emerald-100 text-emerald-700",
  "Upcoming": "bg-blue-100 text-blue-700",
  "Completed": "bg-gray-100 text-gray-700",
}

export default function VenueRentalDashboardPage() {
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const style = statusStyles[status as BookingStatus]
    if (!style) return <Badge variant="secondary">{status}</Badge>
    const StatusIcon = style.icon
    return (
      <Badge variant="secondary" className={style.className}>
        <StatusIcon className="mr-1 h-3 w-3" />
        {status}
      </Badge>
    )
  }

  return (
    <>
      <Header title="Venue Rentals Dashboard" />
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        {/* KPI Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pending Requests</p>
                  <p className="text-2xl font-bold text-foreground">{stats.pendingRequests}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              <p className="mt-1 text-xs text-amber-600">3 need urgent review</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Approved Bookings</p>
                  <p className="text-2xl font-bold text-foreground">{stats.approvedBookings}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                <span>+8 this month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Deposit Pending</p>
                  <p className="text-2xl font-bold text-foreground">{stats.depositPending}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
              </div>
              <p className="mt-1 text-xs text-orange-600">2 due this week</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Upcoming Events</p>
                  <p className="text-2xl font-bold text-foreground">{stats.upcomingEvents}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <p className="mt-1 text-xs text-blue-600">4 events today</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Overdue Balances</p>
                  <p className="text-2xl font-bold text-foreground">{stats.overdueBalances}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <p className="mt-1 text-xs text-red-600">{formatCurrency(stats.overdueAmount)} total</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button asChild className="h-9 sm:h-10">
            <Link href="/events/external/requests">
              <Clock className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Review Requests</span>
              <span className="sm:hidden">Requests</span>
              <Badge variant="secondary" className="ml-1.5 sm:ml-2 bg-white/20">{stats.pendingRequests}</Badge>
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setShowBlockDialog(true)} className="h-9 sm:h-10">
            <CalendarX className="mr-1.5 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Block Calendar Slot</span>
            <span className="sm:hidden">Block</span>
          </Button>
          <Button variant="outline" onClick={() => setShowPaymentDialog(true)} className="h-9 sm:h-10">
            <CreditCard className="mr-1.5 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Record Payment</span>
            <span className="sm:hidden">Payment</span>
          </Button>
          <Button variant="outline" className="h-9 sm:h-10">
            <Download className="mr-1.5 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export Report</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Recent Booking Requests */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">Recent Booking Requests</CardTitle>
                <CardDescription>Latest requests requiring action</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/events/external/requests" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Event Date</TableHead>
                    <TableHead>Guests</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{request.customer}</p>
                          <p className="text-xs text-muted-foreground">{request.eventType}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{request.venue}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{request.eventDate}</TableCell>
                      <TableCell className="text-sm">{request.guestCount}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {request.status === "Pending Review" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                              <XCircle className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Today's Schedule */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Today's Schedule</CardTitle>
                  <CardDescription>Mar 24, 2026</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/events/external/calendar">
                    <Calendar className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {todaySchedule.map((event) => (
                  <div key={event.id} className="flex flex-col gap-1.5 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-primary">{event.time}</span>
                      <Badge variant="secondary" className={scheduleStatusStyles[event.status]}>
                        {event.status}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm">{event.customer}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      <span>{event.venue}</span>
                      <span className="text-muted-foreground/50">•</span>
                      <span>{event.eventType}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Payment Alerts</CardTitle>
              <CardDescription>Deposits due and overdue balances</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/events/external/payments" className="gap-1">
                View All Payments <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Event Date</TableHead>
                  <TableHead>Alert Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentAlerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-medium text-sm">{alert.customer}</TableCell>
                    <TableCell className="text-sm">{alert.venue}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{alert.eventDate}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={alert.type === "Balance Overdue" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}
                      >
                        {alert.type === "Balance Overdue" && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {alert.type === "Deposit Due" && <Clock className="mr-1 h-3 w-3" />}
                        {alert.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{formatCurrency(alert.amount)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{alert.dueDate}</span>
                        {alert.daysOverdue > 0 && (
                          <span className="text-xs text-red-600">{alert.daysOverdue} days overdue</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          Send Reminder
                        </Button>
                        <Button size="sm" className="h-7 text-xs" onClick={() => setShowPaymentDialog(true)}>
                          Record
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Block Calendar Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Calendar Slot</DialogTitle>
            <DialogDescription>Block a time slot to prevent bookings</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-venue">Venue</Label>
              <Select>
                <SelectTrigger id="block-venue">
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grand-hall">Grand Hall</SelectItem>
                  <SelectItem value="conference-a">Conference Room A</SelectItem>
                  <SelectItem value="garden">Garden Pavilion</SelectItem>
                  <SelectItem value="banquet">Banquet Room</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="block-date">Date</Label>
                <Input id="block-date" type="date" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="block-time">Time Slot</Label>
                <Select>
                  <SelectTrigger id="block-time">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (9AM - 12PM)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (1PM - 5PM)</SelectItem>
                    <SelectItem value="evening">Evening (6PM - 10PM)</SelectItem>
                    <SelectItem value="full">Full Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-reason">Reason</Label>
              <Textarea id="block-reason" placeholder="e.g., Maintenance, Private event, etc." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>Cancel</Button>
            <Button onClick={() => setShowBlockDialog(false)}>Block Slot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Manual Payment</DialogTitle>
            <DialogDescription>Record a payment received outside the system</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-booking">Booking</Label>
              <Select>
                <SelectTrigger id="payment-booking">
                  <SelectValue placeholder="Select booking" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bk-001">Tech Solutions Inc - Grand Hall (Apr 18)</SelectItem>
                  <SelectItem value="bk-002">Wedding Dreams LLC - Grand Hall (Apr 5)</SelectItem>
                  <SelectItem value="bk-003">Community Center - Banquet Room (Mar 28)</SelectItem>
                  <SelectItem value="bk-004">Ahmed Hassan - Conference Room A (Apr 2)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-amount">Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input id="payment-amount" type="number" className="pl-7" placeholder="0.00" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-type">Payment Type</Label>
                <Select>
                  <SelectTrigger id="payment-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="partial">Partial Payment</SelectItem>
                    <SelectItem value="final">Final Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select>
                  <SelectTrigger id="payment-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="zelle">Zelle</SelectItem>
                    <SelectItem value="venmo">Venmo</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-date">Payment Date</Label>
                <Input id="payment-date" type="date" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-ref">Reference Number (Optional)</Label>
              <Input id="payment-ref" placeholder="Check #, transaction ID, etc." />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-notes">Notes (Optional)</Label>
              <Textarea id="payment-notes" placeholder="Additional payment details..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={() => setShowPaymentDialog(false)}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
