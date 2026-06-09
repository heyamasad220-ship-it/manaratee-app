"use client"

import type { ElementType } from "react"
import { useState, useMemo, useEffect } from "react"
import { 
  CreditCard, Calendar, DollarSign, ChevronUp, ChevronDown, 
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Clock, Plus, Pencil, Trash2, Wallet
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

type EnrollmentStatus = "Active" | "Inactive" | "Cancelled" | "Completed" | "Past Due"
type EnrollmentType = "Program" | "Service" | "Subscription" | "Membership" | "Class"
type BillingCycle = "Monthly" | "Weekly" | "One-time" | "Annually"

interface PaymentRecord {
  id: string
  date: string
  amount: number
  method: string
  status: "Paid" | "Pending" | "Failed" | "Refunded"
  transactionId?: string
  failureReason?: string
}

interface CustomerEnrollment {
  id: string
  name: string
  description: string
  type: EnrollmentType
  status: EnrollmentStatus
  startDate: string
  endDate?: string
  amount: number
  billingCycle: BillingCycle
  totalPaid: number
  nextPaymentDate?: string
  autoRenew: boolean
  payments: PaymentRecord[]
}

// Mock enrollments for admin view - would come from API in production
const mockEnrollments: CustomerEnrollment[] = [
  {
    id: "enr-001",
    name: "Family Membership",
    description: "Full family access to all facilities and programs",
    type: "Membership",
    status: "Active",
    startDate: "Jan 1, 2026",
    amount: 75.00,
    billingCycle: "Monthly",
    totalPaid: 225.00,
    nextPaymentDate: "Mar 1, 2026",
    autoRenew: true,
    payments: [
      { id: "pmt-1", date: "Feb 1, 2026", amount: 75.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN001235" },
      { id: "pmt-2", date: "Jan 1, 2026", amount: 75.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN001234" },
      { id: "pmt-3", date: "Dec 1, 2025", amount: 75.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN001200" },
    ],
  },
  {
    id: "enr-002",
    name: "After School Care",
    description: "Daily after school care program for children",
    type: "Service",
    status: "Past Due",
    startDate: "Sep 1, 2025",
    endDate: "Jun 15, 2026",
    amount: 250.00,
    billingCycle: "Monthly",
    totalPaid: 1000.00,
    nextPaymentDate: "Feb 1, 2026",
    autoRenew: false,
    payments: [
      { id: "pmt-4", date: "Feb 1, 2026", amount: 250.00, method: "Visa ending in 4242", status: "Failed", failureReason: "Card declined - insufficient funds" },
      { id: "pmt-5", date: "Jan 1, 2026", amount: 250.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN001789" },
      { id: "pmt-6", date: "Dec 1, 2025", amount: 250.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN001500" },
      { id: "pmt-7", date: "Nov 1, 2025", amount: 250.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN001300" },
    ],
  },
  {
    id: "enr-003",
    name: "Youth Swimming Lessons",
    description: "Weekly swimming lessons for beginners",
    type: "Program",
    status: "Active",
    startDate: "Jan 15, 2026",
    endDate: "Mar 15, 2026",
    amount: 180.00,
    billingCycle: "One-time",
    totalPaid: 180.00,
    autoRenew: false,
    payments: [
      { id: "pmt-8", date: "Jan 15, 2026", amount: 180.00, method: "Mastercard ending in 5555", status: "Paid", transactionId: "#TXN001456" },
    ],
  },
  {
    id: "enr-004",
    name: "Weekend Arabic Class",
    description: "Arabic language classes for children ages 5-12",
    type: "Class",
    status: "Active",
    startDate: "Jan 10, 2026",
    endDate: "May 30, 2026",
    amount: 50.00,
    billingCycle: "Weekly",
    totalPaid: 350.00,
    nextPaymentDate: "Feb 21, 2026",
    autoRenew: true,
    payments: [
      { id: "pmt-9", date: "Feb 14, 2026", amount: 50.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN002100" },
      { id: "pmt-10", date: "Feb 7, 2026", amount: 50.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN002050" },
    ],
  },
  {
    id: "enr-005",
    name: "Fitness Center Access",
    description: "Individual fitness center membership",
    type: "Subscription",
    status: "Cancelled",
    startDate: "Oct 1, 2025",
    endDate: "Jan 31, 2026",
    amount: 30.00,
    billingCycle: "Monthly",
    totalPaid: 120.00,
    autoRenew: false,
    payments: [
      { id: "pmt-11", date: "Jan 1, 2026", amount: 30.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN001900" },
      { id: "pmt-12", date: "Dec 1, 2025", amount: 30.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN001800" },
      { id: "pmt-13", date: "Nov 1, 2025", amount: 30.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN001700" },
      { id: "pmt-14", date: "Oct 1, 2025", amount: 30.00, method: "Visa ending in 4242", status: "Paid", transactionId: "#TXN001600" },
    ],
  },
]

// Status badge styling
const statusStyles: Record<EnrollmentStatus, { variant: "default" | "secondary" | "outline" | "destructive", className: string, icon: ElementType }> = {
  "Active": { variant: "secondary", className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  "Inactive": { variant: "secondary", className: "bg-gray-100 text-gray-600", icon: Clock },
  "Cancelled": { variant: "destructive", className: "", icon: XCircle },
  "Completed": { variant: "secondary", className: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  "Past Due": { variant: "destructive", className: "bg-red-100 text-red-700", icon: AlertCircle },
}

// Type badge styling
const typeColors: Record<EnrollmentType, string> = {
  "Program": "bg-purple-100 text-purple-700",
  "Service": "bg-blue-100 text-blue-700",
  "Subscription": "bg-amber-100 text-amber-700",
  "Membership": "bg-emerald-100 text-emerald-700",
  "Class": "bg-pink-100 text-pink-700",
}

type SortField = "name" | "type" | "status" | "amount" | "startDate"
type SortDirection = "asc" | "desc"

function SortIcon({
  field,
  currentField,
  direction,
}: {
  field: SortField
  currentField: SortField
  direction: SortDirection
}) {
  if (field !== currentField) {
    return <ChevronUp className="ml-1 inline size-3.5 text-muted-foreground/40" />
  }
  return direction === "asc" ? (
    <ChevronUp className="ml-1 inline size-3.5" />
  ) : (
    <ChevronDown className="ml-1 inline size-3.5" />
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount)
}

interface FailedPaymentWithContext {
  payment: PaymentRecord
  enrollment: CustomerEnrollment
}

export function PersonSubscriptions({ customerId }: { customerId: string }) {
  const [mounted, setMounted] = useState(false)
  const [enrollments] = useState<CustomerEnrollment[]>(mockEnrollments)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  
  // Dialog states
  const [selectedEnrollment, setSelectedEnrollment] = useState<CustomerEnrollment | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isProcessPaymentOpen, setIsProcessPaymentOpen] = useState(false)
  const [selectedFailedPayment, setSelectedFailedPayment] = useState<FailedPaymentWithContext | null>(null)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const filtered = useMemo(() => {
    let result = [...enrollments]

    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter)
    }

    if (typeFilter !== "all") {
      result = result.filter((e) => e.type === typeFilter)
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "name":
          cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          break
        case "type":
          cmp = a.type.localeCompare(b.type)
          break
        case "status":
          cmp = a.status.localeCompare(b.status)
          break
        case "amount":
          cmp = a.amount - b.amount
          break
        case "startDate":
          cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          break
      }
      return sortDirection === "asc" ? cmp : -cmp
    })

    return result
  }, [enrollments, statusFilter, typeFilter, sortField, sortDirection])

  // Get failed payments
  const failedPayments: FailedPaymentWithContext[] = enrollments.flatMap((enrollment) =>
    enrollment.payments
      .filter((payment) => payment.status === "Failed")
      .map((payment) => ({ payment, enrollment }))
  )

  const activeCount = enrollments.filter((e) => e.status === "Active" || e.status === "Past Due").length
  const totalMonthlySpend = enrollments
    .filter((e) => (e.status === "Active" || e.status === "Past Due") && e.billingCycle === "Monthly")
    .reduce((sum, e) => sum + e.amount, 0)
  const totalPaid = enrollments.reduce((sum, e) => sum + e.totalPaid, 0)
  const failedAmount = failedPayments.reduce((sum, fp) => sum + fp.payment.amount, 0)

  function openProcessPayment(failedPayment: FailedPaymentWithContext) {
    setSelectedFailedPayment(failedPayment)
    setIsProcessPaymentOpen(true)
  }

  function handleProcessPayment() {
    // In production, this would process the payment via API
    console.log("Processing payment:", selectedFailedPayment)
    setIsProcessPaymentOpen(false)
    setSelectedFailedPayment(null)
  }

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Summary Cards */}
      <div className="flex flex-wrap gap-4 [&>*]:w-fit">
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active Enrollments</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalMonthlySpend)}</p>
              <p className="text-xs text-muted-foreground">Monthly Billing</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <CreditCard className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalPaid)}</p>
              <p className="text-xs text-muted-foreground">Total Collected</p>
            </div>
          </CardContent>
        </Card>
        {failedPayments.length > 0 && (
          <Card className="border border-red-200 bg-red-50/50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(failedAmount)}</p>
                <p className="text-xs text-red-600/80">Failed Payments</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Failed Payments Alert */}
      {failedPayments.length > 0 && (
        <Card className="border-red-200 bg-red-50/30 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-red-700">
              <AlertCircle className="h-4 w-4" />
              Failed Payments Requiring Action
            </CardTitle>
            <CardDescription className="text-red-600/80">
              These payments failed and need to be resolved.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-red-200">
              {failedPayments.map(({ payment, enrollment }) => (
                <div key={payment.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">{enrollment.name}</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">
                          {payment.date} - {formatCurrency(payment.amount)}
                        </span>
                        <span className="text-xs font-medium text-red-600">
                          {payment.failureReason || "Payment failed"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                    >
                      Send Reminder
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 bg-red-600 text-xs hover:bg-red-700"
                      onClick={() => openProcessPayment({ payment, enrollment })}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Retry
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Enrollments</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {enrollments.length} enrollments
          </p>
        </div>
        <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          Add Enrollment
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Past Due">Past Due</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Membership">Membership</SelectItem>
            <SelectItem value="Program">Program</SelectItem>
            <SelectItem value="Service">Service</SelectItem>
            <SelectItem value="Class">Class</SelectItem>
            <SelectItem value="Subscription">Subscription</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Enrollments Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("name")}
                  >
                    Name
                    <SortIcon field="name" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("type")}
                  >
                    Type
                    <SortIcon field="type" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("status")}
                  >
                    Status
                    <SortIcon field="status" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>Billing</TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("amount")}
                  >
                    Amount
                    <SortIcon field="amount" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("startDate")}
                  >
                    Start Date
                    <SortIcon field="startDate" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No enrollments found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((enrollment) => {
                  const statusStyle = statusStyles[enrollment.status]
                  const StatusIcon = statusStyle.icon
                  const hasFailedPayment = enrollment.payments.some((p) => p.status === "Failed")
                  
                  return (
                    <TableRow 
                      key={enrollment.id} 
                      className={hasFailedPayment ? "bg-red-50/50" : ""}
                    >
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSelectedEnrollment(enrollment)}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {enrollment.name}
                        </button>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {enrollment.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={typeColors[enrollment.type]}>
                          {enrollment.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusStyle.variant} className={statusStyle.className}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {enrollment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {enrollment.billingCycle}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(enrollment.amount)}
                        {enrollment.billingCycle !== "One-time" && (
                          <span className="text-xs text-muted-foreground">
                            /{enrollment.billingCycle === "Monthly" ? "mo" : enrollment.billingCycle === "Weekly" ? "wk" : "yr"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {enrollment.startDate}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-emerald-600">
                        {formatCurrency(enrollment.totalPaid)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedEnrollment(enrollment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Enrollment Detail Dialog */}
      <Dialog open={!!selectedEnrollment} onOpenChange={() => setSelectedEnrollment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  {selectedEnrollment?.name}
                  {selectedEnrollment && (
                    <Badge 
                      variant={statusStyles[selectedEnrollment.status].variant} 
                      className={statusStyles[selectedEnrollment.status].className}
                    >
                      {selectedEnrollment.status}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>{selectedEnrollment?.description}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedEnrollment && (
            <div className="flex flex-col gap-6 py-4">
              {/* Enrollment Details */}
              <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <Badge variant="secondary" className={`w-fit ${typeColors[selectedEnrollment.type]}`}>
                    {selectedEnrollment.type}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Billing Cycle</span>
                  <span className="text-sm font-medium text-foreground">
                    {selectedEnrollment.billingCycle}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Start Date</span>
                  <span className="text-sm font-medium text-foreground">
                    {selectedEnrollment.startDate}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">End Date</span>
                  <span className="text-sm font-medium text-foreground">
                    {selectedEnrollment.endDate || "Ongoing"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Amount</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(selectedEnrollment.amount)}
                    {selectedEnrollment.billingCycle !== "One-time" && (
                      <span className="text-muted-foreground"> / {selectedEnrollment.billingCycle.toLowerCase()}</span>
                    )}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Total Paid</span>
                  <span className="text-sm font-medium text-emerald-600">
                    {formatCurrency(selectedEnrollment.totalPaid)}
                  </span>
                </div>
                {selectedEnrollment.nextPaymentDate && (
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-xs text-muted-foreground">Next Payment</span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedEnrollment.nextPaymentDate}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Auto-Renew</span>
                  <Badge variant={selectedEnrollment.autoRenew ? "default" : "secondary"} className="w-fit">
                    {selectedEnrollment.autoRenew ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>

              {/* Admin Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit Enrollment
                </Button>
                {(selectedEnrollment.status === "Active" || selectedEnrollment.status === "Past Due") && (
                  <Button variant="outline" size="sm">
                    <Wallet className="mr-1.5 h-3.5 w-3.5" />
                    Process Payment
                  </Button>
                )}
                {selectedEnrollment.status === "Active" && (
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Cancel Enrollment
                  </Button>
                )}
              </div>

              <Separator />

              {/* Payment History */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-foreground">Payment History</h4>
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Transaction ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedEnrollment.payments.map((payment) => (
                        <TableRow key={payment.id} className={payment.status === "Failed" ? "bg-red-50/50" : ""}>
                          <TableCell className="text-sm">{payment.date}</TableCell>
                          <TableCell className="text-sm font-medium">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {payment.method}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <Badge
                                variant={payment.status === "Paid" ? "secondary" : payment.status === "Failed" ? "destructive" : "outline"}
                                className={
                                  payment.status === "Paid"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : payment.status === "Pending"
                                    ? "bg-amber-100 text-amber-700"
                                    : payment.status === "Refunded"
                                    ? "bg-blue-100 text-blue-700"
                                    : ""
                                }
                              >
                                {payment.status}
                              </Badge>
                              {payment.failureReason && (
                                <span className="text-xs text-red-600">{payment.failureReason}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {payment.transactionId || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEnrollment(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Enrollment Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Enrollment</DialogTitle>
            <DialogDescription>
              Add a new enrollment for this customer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Program/Service</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a program or service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="membership-family">Family Membership</SelectItem>
                  <SelectItem value="membership-individual">Individual Membership</SelectItem>
                  <SelectItem value="after-school">After School Care</SelectItem>
                  <SelectItem value="swimming">Youth Swimming Lessons</SelectItem>
                  <SelectItem value="arabic">Weekend Arabic Class</SelectItem>
                  <SelectItem value="fitness">Fitness Center Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Start Date</Label>
                <Input type="date" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>End Date (Optional)</Label>
                <Input type="date" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea placeholder="Add any notes about this enrollment..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsAddDialogOpen(false)}>
              Add Enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Payment Dialog */}
      <Dialog open={isProcessPaymentOpen} onOpenChange={setIsProcessPaymentOpen}>
        <DialogContent className="max-w-md">
          {selectedFailedPayment && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-red-600" />
                  Retry Failed Payment
                </DialogTitle>
                <DialogDescription>
                  Process the failed payment for {selectedFailedPayment.enrollment.name}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="text-lg font-bold">{formatCurrency(selectedFailedPayment.payment.amount)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600">{selectedFailedPayment.payment.failureReason}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Payment Method</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="existing">Use existing card on file</SelectItem>
                      <SelectItem value="new">Enter new payment method</SelectItem>
                      <SelectItem value="cash">Cash Payment</SelectItem>
                      <SelectItem value="check">Check Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Note (Optional)</Label>
                  <Textarea placeholder="Add a note about this payment..." rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsProcessPaymentOpen(false)}>
                  Cancel
                </Button>
                <Button className="bg-red-600 hover:bg-red-700" onClick={handleProcessPayment}>
                  Process Payment
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
