"use client"

import type { ElementType } from "react"
import { useState } from "react"
import { 
  CreditCard, Calendar, DollarSign, ChevronRight, Clock, 
  CheckCircle2, XCircle, AlertCircle, RefreshCw, X, Wallet
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { customerEnrollments, type CustomerEnrollment, type EnrollmentStatus, type PaymentRecord } from "@/lib/mock-data"

// Mock saved payment methods
const savedPaymentMethods = [
  { id: "pm-1", label: "Visa ending in 4242" },
  { id: "pm-2", label: "Mastercard ending in 5555" },
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
const typeColors: Record<string, string> = {
  "Program": "bg-purple-100 text-purple-700",
  "Service": "bg-blue-100 text-blue-700",
  "Subscription": "bg-amber-100 text-amber-700",
  "Membership": "bg-emerald-100 text-emerald-700",
  "Class": "bg-pink-100 text-pink-700",
}

// Payment status icon
function PaymentStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "Paid":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    case "Pending":
      return <Clock className="h-4 w-4 text-amber-600" />
    case "Failed":
      return <XCircle className="h-4 w-4 text-red-600" />
    case "Refunded":
      return <RefreshCw className="h-4 w-4 text-blue-600" />
    default:
      return null
  }
}

// Interface for failed payment with enrollment context
interface FailedPaymentWithContext {
  payment: PaymentRecord
  enrollment: CustomerEnrollment
}

export default function CustomerTransactionsPage() {
  const [selectedEnrollment, setSelectedEnrollment] = useState<CustomerEnrollment | null>(null)
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all")
  
  // Payment dialog states
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentType, setPaymentType] = useState<"failed" | "one-time">("failed")
  const [selectedFailedPayment, setSelectedFailedPayment] = useState<FailedPaymentWithContext | null>(null)
  const [selectedEnrollmentForPayment, setSelectedEnrollmentForPayment] = useState<CustomerEnrollment | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "",
  })
  
  const filteredEnrollments = customerEnrollments.filter((enrollment) => {
    if (filter === "all") return true
    if (filter === "active") return enrollment.status === "Active"
    if (filter === "inactive") return enrollment.status !== "Active"
    return true
  })
  
  // Get all failed payments across all enrollments
  const failedPayments: FailedPaymentWithContext[] = customerEnrollments.flatMap((enrollment) =>
    enrollment.payments
      .filter((payment) => payment.status === "Failed")
      .map((payment) => ({ payment, enrollment }))
  )
  
  const activeCount = customerEnrollments.filter((e) => e.status === "Active" || e.status === "Past Due").length
  const totalMonthlySpend = customerEnrollments
    .filter((e) => (e.status === "Active" || e.status === "Past Due") && e.billingCycle === "Monthly")
    .reduce((sum, e) => sum + e.amount, 0)
  const failedCount = failedPayments.length
  
  // Payment handlers
  function openPayFailedDialog(failedPayment: FailedPaymentWithContext) {
    setSelectedFailedPayment(failedPayment)
    setPaymentType("failed")
    setPaymentForm({
      amount: failedPayment.payment.amount.toFixed(2),
      paymentMethod: "",
    })
    setIsPaymentDialogOpen(true)
  }
  
  function openMakePaymentDialog(enrollment: CustomerEnrollment) {
    setSelectedEnrollmentForPayment(enrollment)
    setPaymentType("one-time")
    setPaymentForm({
      amount: enrollment.amount.toFixed(2),
      paymentMethod: "",
    })
    setIsPaymentDialogOpen(true)
  }
  
  function handlePaymentSubmit() {
    // In production, this would process the payment via an API
    console.log("Payment submitted:", {
      type: paymentType,
      amount: paymentForm.amount,
      paymentMethod: paymentForm.paymentMethod,
      enrollment: paymentType === "failed" ? selectedFailedPayment?.enrollment.name : selectedEnrollmentForPayment?.name,
    })
    setIsPaymentDialogOpen(false)
    setSelectedFailedPayment(null)
    setSelectedEnrollmentForPayment(null)
    setPaymentForm({ amount: "", paymentMethod: "" })
  }
  
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Transactions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View your enrollments, subscriptions, and payment history.
        </p>
      </div>
      
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
              <p className="text-2xl font-bold text-foreground">${totalMonthlySpend.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Monthly Spend</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <CreditCard className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{customerEnrollments.length}</p>
              <p className="text-xs text-muted-foreground">Total Programs</p>
            </div>
          </CardContent>
        </Card>
        {failedCount > 0 && (
          <Card className="border border-red-200 bg-red-50/50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{failedCount}</p>
                <p className="text-xs text-red-600/80">Failed Payments</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Failed Transactions Section */}
      {failedPayments.length > 0 && (
        <Card className="border-red-200 bg-red-50/30 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-red-700">
              <AlertCircle className="h-4 w-4" />
              Failed Transactions
            </CardTitle>
            <CardDescription className="text-red-600/80">
              The following payments could not be processed. Please update your payment method and try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-red-200">
              {failedPayments.map(({ payment, enrollment }) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">
                        {enrollment.name}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">
                          {payment.date} - ${payment.amount.toFixed(2)}
                        </span>
                        <span className="text-xs font-medium text-red-600">
                          {payment.failureReason || "Payment failed"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => openPayFailedDialog({ payment, enrollment })}
                  >
                    <Wallet className="mr-1.5 h-3.5 w-3.5" />
                    Pay Now
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button 
          variant={filter === "all" ? "default" : "outline"} 
          size="sm"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button 
          variant={filter === "active" ? "default" : "outline"} 
          size="sm"
          onClick={() => setFilter("active")}
        >
          Active
        </Button>
        <Button 
          variant={filter === "inactive" ? "default" : "outline"} 
          size="sm"
          onClick={() => setFilter("inactive")}
        >
          Inactive
        </Button>
      </div>
      
      {/* Enrollments List */}
      <Card className="border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Your Enrollments</CardTitle>
          <CardDescription>Click on any item to view payment history.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filteredEnrollments.map((enrollment) => {
              const statusStyle = statusStyles[enrollment.status]
              const StatusIcon = statusStyle.icon
              
              return (
                <button
                  key={enrollment.id}
                  onClick={() => setSelectedEnrollment(enrollment)}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {enrollment.name}
                        </span>
                        <Badge variant="secondary" className={typeColors[enrollment.type]}>
                          {enrollment.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{enrollment.startDate}</span>
                        {enrollment.endDate && (
                          <>
                            <span>-</span>
                            <span>{enrollment.endDate}</span>
                          </>
                        )}
                        {enrollment.billingCycle && (
                          <>
                            <span className="text-muted-foreground/50">|</span>
                            <span>${enrollment.amount.toFixed(2)} / {enrollment.billingCycle}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusStyle.variant} className={statusStyle.className}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {enrollment.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Payment History Dialog */}
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
                <DialogDescription>
                  {selectedEnrollment?.description}
                </DialogDescription>
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
                    {selectedEnrollment.billingCycle || "One-time"}
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
                    ${selectedEnrollment.amount.toFixed(2)}
                    {selectedEnrollment.billingCycle && selectedEnrollment.billingCycle !== "One-time" && (
                      <span className="text-muted-foreground"> / {selectedEnrollment.billingCycle.toLowerCase()}</span>
                    )}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Total Paid</span>
                  <span className="text-sm font-medium text-emerald-600">
                    ${selectedEnrollment.totalPaid.toFixed(2)}
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
              </div>
              
              {/* Make a Payment button for active enrollments */}
              {(selectedEnrollment.status === "Active" || selectedEnrollment.status === "Past Due") && (
                <Button 
                  className="w-full"
                  onClick={() => {
                    setSelectedEnrollment(null)
                    openMakePaymentDialog(selectedEnrollment)
                  }}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Make a One-Time Payment
                </Button>
              )}
              
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
                        <TableRow key={payment.id}>
                          <TableCell className="text-sm">{payment.date}</TableCell>
                          <TableCell className="text-sm font-medium">
                            ${payment.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {payment.method}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <PaymentStatusIcon status={payment.status} />
                              <span className="text-sm">{payment.status}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {payment.transactionId}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              {paymentType === "failed" ? "Retry Failed Payment" : "Make a Payment"}
            </DialogTitle>
            <DialogDescription>
              {paymentType === "failed" 
                ? `Retry the failed payment for ${selectedFailedPayment?.enrollment.name}`
                : `Make a one-time payment for ${selectedEnrollmentForPayment?.name}`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-5 py-4">
            {/* Failed payment details */}
            {paymentType === "failed" && selectedFailedPayment && (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Original Date</span>
                    <span className="text-sm font-medium">{selectedFailedPayment.payment.date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Transaction ID</span>
                    <span className="font-mono text-xs">{selectedFailedPayment.payment.transactionId}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-600">
                      {selectedFailedPayment.payment.failureReason || "Payment failed"}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Amount */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  className="pl-9"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                  disabled={paymentType === "failed"}
                />
              </div>
              {paymentType === "one-time" && (
                <p className="text-xs text-muted-foreground">
                  Default amount is your regular payment. You can adjust if needed.
                </p>
              )}
            </div>
            
            {/* Payment Method */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select
                value={paymentForm.paymentMethod}
                onValueChange={(val) => setPaymentForm((prev) => ({ ...prev, paymentMethod: val }))}
              >
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {savedPaymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">Add new payment method</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Summary */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total to Pay</span>
                <span className="text-lg font-semibold text-foreground">
                  ${Number(paymentForm.amount || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePaymentSubmit}
              disabled={!paymentForm.amount || !paymentForm.paymentMethod}
            >
              {paymentType === "failed" ? "Retry Payment" : "Submit Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
