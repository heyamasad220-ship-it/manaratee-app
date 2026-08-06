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

const emailLogs: EmailLog[] = []

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
        <div className="flex flex-wrap gap-4 [&>*]:w-fit">
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
              <p className="text-xs text-muted-foreground">{emailLogs.length ? Math.round((totalDelivered / emailLogs.length) * 100) : 0}% success rate</p>
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
