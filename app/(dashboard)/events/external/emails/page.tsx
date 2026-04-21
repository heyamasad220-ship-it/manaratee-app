"use client"

import { useState } from "react"
import {
  Mail,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import Link from "next/link"

type EmailType = "Request Received" | "Booking Approved" | "Deposit Reminder" | "Deposit Received" | "Balance Reminder" | "Upcoming Event Reminder"
type DeliveryStatus = "Delivered" | "Pending" | "Failed" | "Bounced"

interface EmailLog {
  id: string
  bookingId: string
  customer: string
  customerEmail: string
  emailType: EmailType
  sentAt: string
  deliveryStatus: DeliveryStatus
  trigger: string
  subject: string
  previewText: string
  htmlContent: string
}

const emailLogs: EmailLog[] = [
  {
    id: "email-001",
    bookingId: "BK-2024-001",
    customer: "Sarah Johnson",
    customerEmail: "sarah.johnson@email.com",
    emailType: "Booking Approved",
    sentAt: "2024-03-20T14:30:00",
    deliveryStatus: "Delivered",
    trigger: "Admin approved booking",
    subject: "Your Venue Booking Has Been Approved!",
    previewText: "Great news! Your booking request for Grand Hall on April 15, 2024 has been approved.",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #10b981; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Booking Approved!</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>Dear Sarah Johnson,</p>
          <p>Great news! Your booking request for <strong>Grand Hall</strong> on <strong>April 15, 2024</strong> has been approved.</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Booking Details</h3>
            <p><strong>Venue:</strong> Grand Hall</p>
            <p><strong>Date:</strong> April 15, 2024</p>
            <p><strong>Time:</strong> 2:00 PM - 10:00 PM</p>
            <p><strong>Event Type:</strong> Wedding Reception</p>
          </div>
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #b45309;">Payment Required</h3>
            <p><strong>Deposit Amount:</strong> $1,650.00</p>
            <p><strong>Due Date:</strong> March 25, 2024</p>
            <a href="#" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Pay Deposit Now</a>
          </div>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>Venue Management Team</p>
        </div>
      </div>
    `,
  },
  {
    id: "email-002",
    bookingId: "BK-2024-002",
    customer: "Michael Chen",
    customerEmail: "michael.chen@company.com",
    emailType: "Deposit Reminder",
    sentAt: "2024-03-20T09:00:00",
    deliveryStatus: "Delivered",
    trigger: "Automated - 3 days before due",
    subject: "Reminder: Deposit Due in 3 Days",
    previewText: "This is a friendly reminder that your deposit payment of $1,200 is due on March 23, 2024.",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f59e0b; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payment Reminder</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>Dear Michael Chen,</p>
          <p>This is a friendly reminder that your deposit payment is due soon.</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Amount Due:</strong> $1,200.00</p>
            <p><strong>Due Date:</strong> March 23, 2024</p>
            <p><strong>Booking:</strong> Conference Room A - March 30, 2024</p>
          </div>
          <a href="#" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Pay Now</a>
        </div>
      </div>
    `,
  },
  {
    id: "email-003",
    bookingId: "BK-2024-003",
    customer: "Emily Rodriguez",
    customerEmail: "emily.r@gmail.com",
    emailType: "Request Received",
    sentAt: "2024-03-19T16:45:00",
    deliveryStatus: "Delivered",
    trigger: "Customer submitted request",
    subject: "We've Received Your Booking Request",
    previewText: "Thank you for your booking request. We'll review it and get back to you within 24-48 hours.",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #3b82f6; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Request Received</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>Dear Emily Rodriguez,</p>
          <p>Thank you for submitting your booking request. We've received it and our team will review it shortly.</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Request Details</h3>
            <p><strong>Venue:</strong> Garden Pavilion</p>
            <p><strong>Requested Date:</strong> May 20, 2024</p>
            <p><strong>Event Type:</strong> Birthday Party</p>
            <p><strong>Guests:</strong> 75</p>
          </div>
          <p>You'll receive an email notification once your request has been reviewed. This typically takes 24-48 hours.</p>
        </div>
      </div>
    `,
  },
  {
    id: "email-004",
    bookingId: "BK-2024-001",
    customer: "Sarah Johnson",
    customerEmail: "sarah.johnson@email.com",
    emailType: "Deposit Received",
    sentAt: "2024-03-21T11:20:00",
    deliveryStatus: "Delivered",
    trigger: "Payment confirmed",
    subject: "Payment Received - Thank You!",
    previewText: "We've received your deposit payment of $1,650. Your booking is now confirmed.",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #10b981; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payment Received</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>Dear Sarah Johnson,</p>
          <p>Thank you! We've received your deposit payment and your booking is now confirmed.</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Amount Paid:</strong> $1,650.00</p>
            <p><strong>Payment Method:</strong> Credit Card</p>
            <p><strong>Transaction ID:</strong> TXN-2024-78234</p>
          </div>
          <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Remaining Balance:</strong> $3,850.00</p>
            <p><strong>Due Date:</strong> April 10, 2024</p>
          </div>
        </div>
      </div>
    `,
  },
  {
    id: "email-005",
    bookingId: "BK-2024-004",
    customer: "David Williams",
    customerEmail: "d.williams@invalid-domain.xyz",
    emailType: "Booking Approved",
    sentAt: "2024-03-19T10:15:00",
    deliveryStatus: "Bounced",
    trigger: "Admin approved booking",
    subject: "Your Venue Booking Has Been Approved!",
    previewText: "Great news! Your booking request has been approved.",
    htmlContent: `<div>Email content...</div>`,
  },
  {
    id: "email-006",
    bookingId: "BK-2024-005",
    customer: "Jennifer Martinez",
    customerEmail: "jen.martinez@email.com",
    emailType: "Balance Reminder",
    sentAt: "2024-03-20T08:00:00",
    deliveryStatus: "Delivered",
    trigger: "Automated - 7 days before event",
    subject: "Reminder: Balance Due Before Your Event",
    previewText: "Your event is coming up! Please ensure your remaining balance is paid.",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f59e0b; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Balance Reminder</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>Dear Jennifer Martinez,</p>
          <p>Your event is just 7 days away! Please ensure your remaining balance is paid before the event date.</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Remaining Balance:</strong> $2,400.00</p>
            <p><strong>Event Date:</strong> March 27, 2024</p>
          </div>
          <a href="#" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Pay Balance</a>
        </div>
      </div>
    `,
  },
  {
    id: "email-007",
    bookingId: "BK-2024-006",
    customer: "Robert Taylor",
    customerEmail: "r.taylor@business.com",
    emailType: "Upcoming Event Reminder",
    sentAt: "2024-03-20T07:00:00",
    deliveryStatus: "Delivered",
    trigger: "Automated - 2 days before event",
    subject: "Your Event is in 2 Days!",
    previewText: "Just a reminder that your event at Grand Hall is coming up on March 22, 2024.",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #8b5cf6; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Event Reminder</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>Dear Robert Taylor,</p>
          <p>Your event is just 2 days away! Here's a quick reminder of the details.</p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Event Details</h3>
            <p><strong>Venue:</strong> Grand Hall</p>
            <p><strong>Date:</strong> March 22, 2024</p>
            <p><strong>Time:</strong> 6:00 PM - 11:00 PM</p>
            <p><strong>Setup Access:</strong> 4:00 PM</p>
          </div>
          <p>Please contact us if you have any last-minute questions or changes.</p>
        </div>
      </div>
    `,
  },
  {
    id: "email-008",
    bookingId: "BK-2024-007",
    customer: "Amanda Lee",
    customerEmail: "amanda.lee@email.com",
    emailType: "Request Received",
    sentAt: "2024-03-20T15:30:00",
    deliveryStatus: "Pending",
    trigger: "Customer submitted request",
    subject: "We've Received Your Booking Request",
    previewText: "Thank you for your booking request.",
    htmlContent: `<div>Email content...</div>`,
  },
  {
    id: "email-009",
    bookingId: "BK-2024-008",
    customer: "James Wilson",
    customerEmail: "j.wilson@company.org",
    emailType: "Deposit Reminder",
    sentAt: "2024-03-18T09:00:00",
    deliveryStatus: "Failed",
    trigger: "Automated - 3 days before due",
    subject: "Reminder: Deposit Due in 3 Days",
    previewText: "This is a friendly reminder about your deposit payment.",
    htmlContent: `<div>Email content...</div>`,
  },
  {
    id: "email-010",
    bookingId: "BK-2024-009",
    customer: "Lisa Brown",
    customerEmail: "lisa.brown@gmail.com",
    emailType: "Booking Approved",
    sentAt: "2024-03-17T14:00:00",
    deliveryStatus: "Delivered",
    trigger: "Admin approved booking",
    subject: "Your Venue Booking Has Been Approved!",
    previewText: "Great news! Your booking has been approved.",
    htmlContent: `<div>Email content...</div>`,
  },
]

const emailTypes: EmailType[] = [
  "Request Received",
  "Booking Approved",
  "Deposit Reminder",
  "Deposit Received",
  "Balance Reminder",
  "Upcoming Event Reminder",
]

const deliveryStatuses: DeliveryStatus[] = ["Delivered", "Pending", "Failed", "Bounced"]

export default function EmailHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [emailTypeFilter, setEmailTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState({ from: "", to: "" })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const getStatusBadge = (status: DeliveryStatus) => {
    switch (status) {
      case "Delivered":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Delivered
          </span>
        )
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        )
      case "Failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        )
      case "Bounced":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
            <AlertCircle className="h-3 w-3" />
            Bounced
          </span>
        )
    }
  }

  const getEmailTypeBadge = (type: EmailType) => {
    const colors: Record<EmailType, string> = {
      "Request Received": "bg-blue-100 text-blue-700",
      "Booking Approved": "bg-emerald-100 text-emerald-700",
      "Deposit Reminder": "bg-amber-100 text-amber-700",
      "Deposit Received": "bg-green-100 text-green-700",
      "Balance Reminder": "bg-orange-100 text-orange-700",
      "Upcoming Event Reminder": "bg-purple-100 text-purple-700",
    }
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type]}`}>
        {type}
      </span>
    )
  }

  // Filter emails
  const filteredEmails = emailLogs.filter((email) => {
    const matchesSearch =
      searchQuery === "" ||
      email.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.bookingId.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesType = emailTypeFilter === "all" || email.emailType === emailTypeFilter
    const matchesStatus = statusFilter === "all" || email.deliveryStatus === statusFilter

    const emailDate = new Date(email.sentAt)
    const matchesDateFrom = !dateRange.from || emailDate >= new Date(dateRange.from)
    const matchesDateTo = !dateRange.to || emailDate <= new Date(dateRange.to + "T23:59:59")

    return matchesSearch && matchesType && matchesStatus && matchesDateFrom && matchesDateTo
  })

  // Pagination
  const totalPages = Math.ceil(filteredEmails.length / itemsPerPage)
  const paginatedEmails = filteredEmails.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Stats
  const totalDelivered = emailLogs.filter((e) => e.deliveryStatus === "Delivered").length
  const totalPending = emailLogs.filter((e) => e.deliveryStatus === "Pending").length
  const totalFailed = emailLogs.filter((e) => e.deliveryStatus === "Failed" || e.deliveryStatus === "Bounced").length

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Email History</h1>
            <p className="text-muted-foreground">
              View all automated emails sent to customers
            </p>
          </div>
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{emailLogs.length}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{totalDelivered}</div>
              <p className="text-xs text-muted-foreground">{Math.round((totalDelivered / emailLogs.length) * 100)}% success rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{totalPending}</div>
              <p className="text-xs text-muted-foreground">Awaiting delivery</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed / Bounced</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalFailed}</div>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer, email, or booking ID..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {(emailTypeFilter !== "all" || statusFilter !== "all" || dateRange.from || dateRange.to) && (
                    <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {[emailTypeFilter !== "all", statusFilter !== "all", dateRange.from || dateRange.to].filter(Boolean).length}
                    </span>
                  )}
                </Button>
              </div>

              {showFilters && (
                <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <Label>Email Type</Label>
                    <Select value={emailTypeFilter} onValueChange={setEmailTypeFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {emailTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Delivery Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {deliveryStatuses.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>From Date</Label>
                    <Input
                      type="date"
                      value={dateRange.from}
                      onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>To Date</Label>
                    <Input
                      type="date"
                      value={dateRange.to}
                      onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Email Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email Type</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Mail className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No emails found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEmails.map((email) => (
                    <TableRow key={email.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEmail(email)}>
                      <TableCell>
                        <Link
                          href={`/events/external/requests/${email.bookingId}`}
                          className="font-medium text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {email.bookingId}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{email.customer}</p>
                          <p className="text-xs text-muted-foreground">{email.customerEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getEmailTypeBadge(email.emailType)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(email.sentAt)}
                      </TableCell>
                      <TableCell>{getStatusBadge(email.deliveryStatus)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {email.trigger}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedEmail(email)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredEmails.length)} of {filteredEmails.length} emails
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Email Preview Sheet */}
      <Sheet open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Email Preview</SheetTitle>
            <SheetDescription>
              View the email content sent to the customer
            </SheetDescription>
          </SheetHeader>
          {selectedEmail && (
            <div className="flex flex-col gap-6 py-6">
              {/* Email Metadata */}
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(selectedEmail.deliveryStatus)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Type</span>
                  {getEmailTypeBadge(selectedEmail.emailType)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sent At</span>
                  <span className="text-sm font-medium">{formatDateTime(selectedEmail.sentAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Booking</span>
                  <Link
                    href={`/events/external/requests/${selectedEmail.bookingId}`}
                    className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    {selectedEmail.bookingId}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Trigger</span>
                  <span className="text-sm">{selectedEmail.trigger}</span>
                </div>
              </div>

              {/* Recipient */}
              <div className="flex flex-col gap-2">
                <Label className="text-muted-foreground">To</Label>
                <div className="rounded-lg border p-3">
                  <p className="font-medium">{selectedEmail.customer}</p>
                  <p className="text-sm text-muted-foreground">{selectedEmail.customerEmail}</p>
                </div>
              </div>

              {/* Subject */}
              <div className="flex flex-col gap-2">
                <Label className="text-muted-foreground">Subject</Label>
                <div className="rounded-lg border p-3">
                  <p className="font-medium">{selectedEmail.subject}</p>
                </div>
              </div>

              {/* Preview Text */}
              <div className="flex flex-col gap-2">
                <Label className="text-muted-foreground">Preview Text</Label>
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">{selectedEmail.previewText}</p>
                </div>
              </div>

              {/* Email Content Preview */}
              <div className="flex flex-col gap-2">
                <Label className="text-muted-foreground">Email Content</Label>
                <div className="rounded-lg border bg-white overflow-hidden">
                  <div
                    className="p-4"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.htmlContent }}
                  />
                </div>
              </div>

              {/* Actions */}
              {(selectedEmail.deliveryStatus === "Failed" || selectedEmail.deliveryStatus === "Bounced") && (
                <div className="flex gap-2">
                  <Button className="flex-1">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Send
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
