"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DepositStatusBadge, BalanceStatusBadge, type DepositStatus, type BalanceStatus } from "@/lib/status-badges"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DollarSign,
  Search,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Send,
  CreditCard,
  Building,
  Receipt,
  TrendingUp,
  Calendar,
  ExternalLink,
  History,
  Filter,
  X,
} from "lucide-react"

interface BookingPayment {
  id: string
  bookingId: string
  customer: string
  customerEmail: string
  venue: string
  eventDate: string
  totalAmount: number
  depositAmount: number
  paidToDate: number
  balanceDue: number
  depositStatus: "Pending" | "Paid" | "Overdue" | "Waived"
  balanceStatus: "Pending" | "Paid" | "Overdue" | "Partial" | "N/A"
  paymentMethod: "Credit Card" | "Bank Transfer" | "Check" | "Cash" | "Multiple"
  depositDueDate: string
  balanceDueDate: string
}

interface PaymentHistoryItem {
  id: string
  date: string
  type: "Deposit" | "Balance" | "Partial"
  amount: number
  method: string
  reference: string
  status: "Completed" | "Pending" | "Failed"
}

const mockBookingPayments: BookingPayment[] = []

const mockPaymentHistory: PaymentHistoryItem[] = []

const venues = ["All Venues", "Grand Hall", "Garden Pavilion", "Conference Room A", "Conference Room B", "Banquet Room"]

export default function VenuePaymentsPage() {
  const [payments] = useState<BookingPayment[]>(mockBookingPayments)
  const [search, setSearch] = useState("")
  const [venueFilter, setVenueFilter] = useState("All Venues")
  const [depositStatusFilter, setDepositStatusFilter] = useState("all")
  const [balanceStatusFilter, setBalanceStatusFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  
  const [selectedPayment, setSelectedPayment] = useState<BookingPayment | null>(null)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [showRecordPaymentDialog, setShowRecordPaymentDialog] = useState(false)
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  
const [recordPaymentForm, setRecordPaymentForm] = useState({
  paymentType: "",
  amount: "",
  method: "",
  date: new Date().toISOString().split("T")[0],
  reference: "",
  notes: "",
})

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch = 
      payment.customer.toLowerCase().includes(search.toLowerCase()) ||
      payment.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      payment.bookingId.toLowerCase().includes(search.toLowerCase())
    const matchesVenue = venueFilter === "All Venues" || payment.venue === venueFilter
    const matchesDepositStatus = depositStatusFilter === "all" || payment.depositStatus.toLowerCase() === depositStatusFilter.toLowerCase()
    const matchesBalanceStatus = balanceStatusFilter === "all" || payment.balanceStatus.toLowerCase() === balanceStatusFilter.toLowerCase()
    const matchesMethod = methodFilter === "all" || payment.paymentMethod.toLowerCase().includes(methodFilter.toLowerCase())
    
    let matchesDate = true
    if (dateFrom) {
      matchesDate = matchesDate && payment.eventDate >= dateFrom
    }
    if (dateTo) {
      matchesDate = matchesDate && payment.eventDate <= dateTo
    }
    
    return matchesSearch && matchesVenue && matchesDepositStatus && matchesBalanceStatus && matchesMethod && matchesDate
  })

  // Summary calculations
  const depositsDue = payments.filter(p => p.depositStatus === "Pending" || p.depositStatus === "Overdue").reduce((sum, p) => sum + p.depositAmount - (p.depositStatus === "Paid" ? p.depositAmount : 0), 0)
  const balancesDue = payments.filter(p => p.balanceStatus === "Pending" || p.balanceStatus === "Partial" || p.balanceStatus === "Overdue").reduce((sum, p) => sum + p.balanceDue, 0)
  const overduePayments = payments.filter(p => p.depositStatus === "Overdue" || p.balanceStatus === "Overdue").reduce((sum, p) => {
    let overdue = 0
    if (p.depositStatus === "Overdue") overdue += p.depositAmount
    if (p.balanceStatus === "Overdue") overdue += p.balanceDue
    return sum + overdue
  }, 0)
  const revenueThisMonth = payments.reduce((sum, p) => sum + p.paidToDate, 0)

  const getDepositStatusBadge = (status: BookingPayment["depositStatus"]) => {
    switch (status) {
      case "Paid":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Paid</Badge>
      case "Pending":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>
      case "Overdue":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Overdue</Badge>
      case "Waived":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Waived</Badge>
    }
  }

  const getBalanceStatusBadge = (status: BookingPayment["balanceStatus"]) => {
    switch (status) {
      case "Paid":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Paid</Badge>
      case "Pending":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>
      case "Overdue":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Overdue</Badge>
      case "Partial":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Partial</Badge>
      case "N/A":
        return <Badge variant="secondary">N/A</Badge>
    }
  }

  const clearFilters = () => {
    setVenueFilter("All Venues")
    setDepositStatusFilter("all")
    setBalanceStatusFilter("all")
    setMethodFilter("all")
    setDateFrom("")
    setDateTo("")
  }

  const hasActiveFilters = venueFilter !== "All Venues" || depositStatusFilter !== "all" || balanceStatusFilter !== "all" || methodFilter !== "all" || dateFrom || dateTo

  return (
    <>
      <Header title="Payments" />
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        {/* Summary Cards */}
        <div className="flex flex-wrap gap-3 sm:gap-4 [&>*]:w-fit">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Deposits Due</p>
                  <p className="text-2xl font-bold">{formatCurrency(depositsDue)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {payments.filter(p => p.depositStatus === "Pending").length} deposits awaiting
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Balances Due</p>
                  <p className="text-2xl font-bold">{formatCurrency(balancesDue)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {payments.filter(p => p.balanceStatus === "Pending" || p.balanceStatus === "Partial").length} balances pending
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue Payments</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(overduePayments)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="mt-2 text-xs text-red-600">
                {payments.filter(p => p.depositStatus === "Overdue" || p.balanceStatus === "Overdue").length} payments overdue
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue This Month</p>
                  <p className="text-2xl font-bold">{formatCurrency(revenueThisMonth)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                {payments.filter(p => p.balanceStatus === "Paid").length} fully paid
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2 sm:gap-3">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
              <Button 
                variant={showFilters ? "secondary" : "outline"} 
                onClick={() => setShowFilters(!showFilters)}
                className="h-10 shrink-0"
              >
                <Filter className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && (
                  <Badge className="ml-1 sm:ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs">
                    !
                  </Badge>
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1 sm:flex-none">
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">Venue</Label>
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
                      <Label className="text-xs text-muted-foreground">Deposit Status</Label>
                      <Select value={depositStatusFilter} onValueChange={setDepositStatusFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">Balance Status</Label>
                      <Select value={balanceStatusFilter} onValueChange={setBalanceStatusFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">Payment Method</Label>
                      <Select value={methodFilter} onValueChange={setMethodFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Methods</SelectItem>
                          <SelectItem value="credit">Credit Card</SelectItem>
                          <SelectItem value="bank">Bank Transfer</SelectItem>
                          <SelectItem value="check">Check</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">Event Date Range</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="text-sm"
                        />
                        <span className="text-muted-foreground">-</span>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  {hasActiveFilters && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="mr-2 h-4 w-4" />
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Payments Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Event Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Deposit</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Deposit Status</TableHead>
                    <TableHead>Balance Status</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="py-12 text-center">
                        <Receipt className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground">No payments found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <Link 
                            href={`/events/external/requests/${payment.bookingId}`}
                            className="font-mono text-sm text-primary hover:underline"
                          >
                            {payment.bookingId}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payment.customer}</p>
                            <p className="text-xs text-muted-foreground">{payment.customerEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>{payment.venue}</TableCell>
                        <TableCell>{formatDate(payment.eventDate)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(payment.totalAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(payment.depositAmount)}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-medium">{formatCurrency(payment.paidToDate)}</TableCell>
                        <TableCell className={`text-right font-medium ${payment.balanceDue > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                          {formatCurrency(payment.balanceDue)}
                        </TableCell>
                        <TableCell>{getDepositStatusBadge(payment.depositStatus)}</TableCell>
                        <TableCell>{getBalanceStatusBadge(payment.balanceStatus)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            {payment.paymentMethod === "Credit Card" && <CreditCard className="h-4 w-4 text-muted-foreground" />}
                            {payment.paymentMethod === "Bank Transfer" && <Building className="h-4 w-4 text-muted-foreground" />}
                            <span>{payment.paymentMethod}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedPayment(payment); setShowHistoryDialog(true); }}>
                                <History className="mr-2 h-4 w-4" />
                                View Payment History
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedPayment(payment); setShowRecordPaymentDialog(true); }}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Record Manual Payment
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedPayment(payment); setShowReminderDialog(true); }}>
                                <Send className="mr-2 h-4 w-4" />
                                Send Reminder
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link href={`/events/external/requests/${payment.bookingId}`}>
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  View Booking
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredPayments.length} of {payments.length} bookings
        </div>
      </div>

      {/* Payment History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              {selectedPayment?.customer} - {selectedPayment?.bookingId}
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="flex flex-col gap-4 py-4">
              {/* Summary */}
              <div className="grid gap-3 sm:grid-cols-3 rounded-lg bg-muted/50 p-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedPayment.totalAmount)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(selectedPayment.paidToDate)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className={`text-lg font-bold ${selectedPayment.balanceDue > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {formatCurrency(selectedPayment.balanceDue)}
                  </p>
                </div>
              </div>

              {/* History List */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">Transactions</h4>
                <div className="flex flex-col gap-2">
                  {mockPaymentHistory.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No data yet.</p>
                  ) : (
                    mockPaymentHistory.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{item.type} Payment</p>
                            <p className="text-xs text-muted-foreground">{item.date} - {item.method}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-emerald-600">{formatCurrency(item.amount)}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.reference}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {selectedPayment.balanceDue > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-dashed p-3 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                          <Clock className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Balance Due</p>
                          <p className="text-xs text-muted-foreground">Due {formatDate(selectedPayment.balanceDueDate)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-amber-600">{formatCurrency(selectedPayment.balanceDue)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>Close</Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download Statement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showRecordPaymentDialog} onOpenChange={setShowRecordPaymentDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Manual Payment</DialogTitle>
            <DialogDescription>
              Record a payment received for this booking
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="flex flex-col gap-5 py-4">
              {/* Booking Summary */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="text-sm font-semibold mb-3">Booking Summary</h4>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Booking ID</span>
                    <span className="font-medium">{selectedPayment.bookingId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium">{selectedPayment.customer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Venue</span>
                    <span className="font-medium">{selectedPayment.venue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event Date</span>
                    <span className="font-medium">{formatDate(selectedPayment.eventDate)}</span>
                  </div>
                </div>
              </div>

              {/* Current Totals */}
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                <h4 className="text-sm font-semibold mb-3">Payment Status</h4>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="font-semibold">{formatCurrency(selectedPayment.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid So Far</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(selectedPayment.paidToDate)}</span>
                  </div>
                  <div className="border-t pt-2 mt-1 flex justify-between">
                    <span className="font-medium">Remaining Balance</span>
                    <span className="font-bold text-lg">{formatCurrency(selectedPayment.balanceDue)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Type */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-type">Payment Type <span className="text-red-500">*</span></Label>
                <Select value={recordPaymentForm.paymentType} onValueChange={(val) => setRecordPaymentForm(prev => ({ ...prev, paymentType: val }))}>
                  <SelectTrigger id="payment-type">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit Payment</SelectItem>
                    <SelectItem value="balance">Balance Payment (Full)</SelectItem>
                    <SelectItem value="partial">Partial Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-method">Payment Method <span className="text-red-500">*</span></Label>
                <Select value={recordPaymentForm.method} onValueChange={(val) => setRecordPaymentForm(prev => ({ ...prev, method: val }))}>
                  <SelectTrigger id="payment-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="zelle">Zelle</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-amount">Amount Paid <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="payment-amount"
                    type="number"
                    placeholder="0.00"
                    className="pl-7"
                    value={recordPaymentForm.amount}
                    onChange={(e) => setRecordPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                {recordPaymentForm.paymentType === "deposit" && selectedPayment.depositAmount > 0 && (
                  <p className="text-xs text-muted-foreground">Deposit amount: {formatCurrency(selectedPayment.depositAmount)}</p>
                )}
                {recordPaymentForm.paymentType === "balance" && (
                  <p className="text-xs text-muted-foreground">Remaining balance: {formatCurrency(selectedPayment.balanceDue)}</p>
                )}
              </div>

              {/* Date and Reference */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payment-date">Payment Date <span className="text-red-500">*</span></Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={recordPaymentForm.date}
                    onChange={(e) => setRecordPaymentForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payment-reference">Reference Number</Label>
                  <Input
                    id="payment-reference"
                    placeholder="Check #, transaction ID"
                    value={recordPaymentForm.reference}
                    onChange={(e) => setRecordPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="payment-notes">Notes</Label>
                <Textarea
                  id="payment-notes"
                  placeholder="Optional notes about this payment..."
                  rows={2}
                  value={recordPaymentForm.notes}
                  onChange={(e) => setRecordPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowRecordPaymentDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => setShowRecordPaymentDialog(false)}
              disabled={!recordPaymentForm.paymentType || !recordPaymentForm.method || !recordPaymentForm.amount || !recordPaymentForm.date}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Reminder Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Payment Reminder</DialogTitle>
            <DialogDescription>
              Send a reminder email to {selectedPayment?.customer}
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="flex flex-col gap-4 py-4">
              <div className="rounded-lg border p-4">
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">To</span>
                    <span className="font-medium">{selectedPayment.customerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Due</span>
                    <span className="font-medium">{formatCurrency(selectedPayment.balanceDue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date</span>
                    <span className={`font-medium ${selectedPayment.balanceStatus === "Overdue" ? "text-red-600" : ""}`}>
                      {formatDate(selectedPayment.balanceDueDate)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Reminder Type</Label>
                <Select defaultValue="friendly">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly Reminder</SelectItem>
                    <SelectItem value="urgent">Urgent - Payment Overdue</SelectItem>
                    <SelectItem value="final">Final Notice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Additional Message (optional)</Label>
                <Textarea
                  placeholder="Add a personal note to the reminder email..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReminderDialog(false)}>Cancel</Button>
            <Button onClick={() => setShowReminderDialog(false)}>
              <Send className="mr-2 h-4 w-4" />
              Send Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
