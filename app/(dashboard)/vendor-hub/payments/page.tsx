"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  DollarSign,
  Search,
  Plus,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCcw,
  Banknote,
  Receipt,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

type VendorHubEvent = {
  id: string
  name: string
}

type VendorHubVendor = {
  id: string
  business_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  status: string | null
}

type BoothType = {
  id: string
  name: string
  size: string | null
  price: number | null
  color: string | null
}

type Booth = {
  id: string
  number: string
  location: string | null
  booth_type_id: string | null
  vendor_hub_booth_types?: BoothType | null
}

type BoothAssignment = {
  id: string
  event_id: string | null
  booth_id: string | null
  vendor_id: string | null
  fee_amount: number | null
  status: string | null
  vendor_hub_vendors?: VendorHubVendor | null
  vendor_hub_booths?: Booth | null
}

type VendorPayment = {
  id: string
  event_id: string | null
  booth_assignment_id: string | null
  vendor_id: string | null
  amount: number
  payment_method: string | null
  payment_date: string | null
  payment_type: string | null
  notes: string | null
  created_at: string | null
}

type PaymentRow = {
  assignment: BoothAssignment
  vendorName: string
  boothNumber: string
  boothTypeName: string
  feeAmount: number
  paidAmount: number
  balance: number
  status: "unpaid" | "partial" | "paid" | "refunded"
  paymentMethod: string | null
  lastPaymentDate: string | null
}

const statusConfig = {
  unpaid: { label: "Unpaid", color: "border-red-200 bg-red-50 text-red-700", icon: AlertCircle },
  partial: { label: "Partial", color: "border-amber-200 bg-amber-50 text-amber-700", icon: Clock },
  paid: { label: "Paid", color: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  refunded: { label: "Refunded", color: "border-blue-200 bg-blue-50 text-blue-700", icon: RefreshCcw },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0)
}

function formatDate(value: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString()
}

export default function BazaarPaymentsPage() {
  const supabase = createClient()

  const [events, setEvents] = useState<VendorHubEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState("")
  const [assignments, setAssignments] = useState<BoothAssignment[]>([])
  const [payments, setPayments] = useState<VendorPayment[]>([])
  const [loading, setLoading] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showRecordPaymentDialog, setShowRecordPaymentDialog] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("")
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [savingPayment, setSavingPayment] = useState(false)

  useEffect(() => {
    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      loadPaymentData(selectedEventId)
    } else {
      setAssignments([])
      setPayments([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId])

  async function loadEvents() {
    const { data, error } = await supabase
      .from("vendor_hub_events")
      .select("id, name")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading vendor events:", error)
      setEvents([])
      return
    }

    const eventData = data ?? []
    setEvents(eventData)

    if (eventData.length > 0) {
      setSelectedEventId(eventData[0].id)
    }
  }

  async function loadPaymentData(eventId: string) {
    setLoading(true)

    const [{ data: assignmentData, error: assignmentError }, { data: paymentData, error: paymentError }] =
      await Promise.all([
        supabase
          .from("vendor_hub_booth_assignments")
          .select(`
            *,
            vendor_hub_vendors (
              id,
              business_name,
              contact_name,
              email,
              phone,
              status
            ),
            vendor_hub_booths (
              id,
              number,
              location,
              booth_type_id,
              vendor_hub_booth_types (
                id,
                name,
                size,
                price,
                color
              )
            )
          `)
          .eq("event_id", eventId)
          .order("created_at", { ascending: false }),

        supabase
          .from("vendor_hub_payments")
          .select("*")
          .eq("event_id", eventId)
          .order("payment_date", { ascending: false }),
      ])

    if (assignmentError) {
      console.error("Error loading booth assignments:", assignmentError)
      setAssignments([])
    } else {
      setAssignments((assignmentData ?? []) as BoothAssignment[])
    }

    if (paymentError) {
      console.error("Error loading payments:", paymentError)
      setPayments([])
    } else {
      setPayments((paymentData ?? []) as VendorPayment[])
    }

    setLoading(false)
  }

  const paymentRows = useMemo<PaymentRow[]>(() => {
    return assignments.map((assignment) => {
      const assignmentPayments = payments.filter(
        (payment) => payment.booth_assignment_id === assignment.id
      )

      const paymentTotal = assignmentPayments.reduce((sum, payment) => {
        if (payment.payment_type === "refund") {
          return sum - Number(payment.amount || 0)
        }

        return sum + Number(payment.amount || 0)
      }, 0)

      const feeAmount = Number(assignment.fee_amount || 0)
      const balance = feeAmount - paymentTotal

      let status: PaymentRow["status"] = "unpaid"

      if (paymentTotal <= 0) {
        status = "unpaid"
      } else if (balance > 0) {
        status = "partial"
      } else {
        status = "paid"
      }

      const lastPayment = assignmentPayments[0] ?? null

      return {
        assignment,
        vendorName: assignment.vendor_hub_vendors?.business_name || "Unknown Vendor",
        boothNumber: assignment.vendor_hub_booths?.number || "-",
        boothTypeName:
          assignment.vendor_hub_booths?.vendor_hub_booth_types?.name || "No booth type",
        feeAmount,
        paidAmount: paymentTotal,
        balance,
        status,
        paymentMethod: lastPayment?.payment_method || null,
        lastPaymentDate: lastPayment?.payment_date || null,
      }
    })
  }, [assignments, payments])

  const filteredPayments = paymentRows.filter((payment) => {
    const matchesSearch =
      payment.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.boothNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.boothTypeName.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || payment.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const selectedPaymentRow =
    paymentRows.find((row) => row.assignment.id === selectedAssignmentId) || null

  const stats = {
    totalExpected: paymentRows.reduce((sum, row) => sum + row.feeAmount, 0),
    totalCollected: paymentRows.reduce((sum, row) => sum + row.paidAmount, 0),
    outstanding: paymentRows.reduce((sum, row) => sum + Math.max(0, row.balance), 0),
    overdue: paymentRows.filter((row) => row.status === "unpaid").length,
  }

  function openRecordPayment(row?: PaymentRow) {
    if (row) {
      setSelectedAssignmentId(row.assignment.id)
      setPaymentAmount(row.balance > 0 ? String(row.balance) : "")
    } else {
      setSelectedAssignmentId("")
      setPaymentAmount("")
    }

    setPaymentMethod("")
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setShowRecordPaymentDialog(true)
  }

  async function recordPayment() {
    if (!selectedPaymentRow) {
      alert("Please select a vendor assignment.")
      return
    }

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      alert("Please enter a valid payment amount.")
      return
    }

    if (!paymentMethod) {
      alert("Please select a payment method.")
      return
    }

    setSavingPayment(true)

    const { error } = await supabase.from("vendor_hub_payments").insert({
      event_id: selectedEventId,
      booth_assignment_id: selectedPaymentRow.assignment.id,
      vendor_id: selectedPaymentRow.assignment.vendor_id,
      amount: Number(paymentAmount),
      payment_method: paymentMethod,
      payment_date: paymentDate || new Date().toISOString().slice(0, 10),
      payment_type: "payment",
    })

    if (error) {
      console.error("Error recording payment:", error)
      alert("Payment could not be recorded.")
      setSavingPayment(false)
      return
    }

    await loadPaymentData(selectedEventId)

    setSavingPayment(false)
    setShowRecordPaymentDialog(false)
    setSelectedAssignmentId("")
    setPaymentAmount("")
    setPaymentMethod("")
  }

  async function issueRefund(row: PaymentRow) {
    const refundAmount = window.prompt(
      `Enter refund amount for ${row.vendorName}:`,
      row.paidAmount > 0 ? String(row.paidAmount) : ""
    )

    if (!refundAmount) return

    const amount = Number(refundAmount)

    if (!amount || amount <= 0) {
      alert("Please enter a valid refund amount.")
      return
    }

    const { error } = await supabase.from("vendor_hub_payments").insert({
      event_id: selectedEventId,
      booth_assignment_id: row.assignment.id,
      vendor_id: row.assignment.vendor_id,
      amount,
      payment_method: "refund",
      payment_date: new Date().toISOString().slice(0, 10),
      payment_type: "refund",
      notes: "Refund issued from payments page.",
    })

    if (error) {
      console.error("Error issuing refund:", error)
      alert("Refund could not be recorded.")
      return
    }

    await loadPaymentData(selectedEventId)
  }

  return (
    <>
      <Header title="Vendor Payments" />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Payments</h1>
            <p className="text-sm text-muted-foreground">
              Track vendor booth fees, balances, payments, and refunds.
            </p>
          </div>

          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select vendor event" />
            </SelectTrigger>
            <SelectContent>
              {events.length === 0 ? (
                <SelectItem value="no-events" disabled>
                  No vendor events found
                </SelectItem>
              ) : (
                events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Expected</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalExpected)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Collected</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(stats.totalCollected)}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {formatCurrency(stats.outstanding)}
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 p-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unpaid Assignments</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Payment Records</CardTitle>
                <CardDescription>
                  Payment records are generated from booth assignments.
                </CardDescription>
              </div>

              <Button onClick={() => openRecordPayment()} className="gap-2">
                <Plus className="h-4 w-4" />
                Record Payment
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search vendors, booths, or booth types..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Booth / Assignment</TableHead>
                    <TableHead className="text-right">Fee Amount</TableHead>
                    <TableHead className="text-right">Paid Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        Loading payment records...
                      </TableCell>
                    </TableRow>
                  ) : filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        No payment records found. Assign vendors to booths first.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => {
                      const config = statusConfig[payment.status]
                      const StatusIcon = config.icon

                      return (
                        <TableRow key={payment.assignment.id}>
                          <TableCell className="font-medium">{payment.vendorName}</TableCell>

                          <TableCell>
                            <div>
                              <p>{payment.boothNumber}</p>
                              <p className="text-xs text-muted-foreground">
                                {payment.boothTypeName}
                              </p>
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            {formatCurrency(payment.feeAmount)}
                          </TableCell>

                          <TableCell className="text-right">
                            {formatCurrency(payment.paidAmount)}
                          </TableCell>

                          <TableCell
                            className={cn(
                              "text-right font-medium",
                              payment.balance > 0 && "text-red-600",
                              payment.balance < 0 && "text-blue-600"
                            )}
                          >
                            {formatCurrency(Math.abs(payment.balance))}
                            {payment.balance < 0 && " credit"}
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className={cn("gap-1", config.color)}>
                              <StatusIcon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            {payment.paymentMethod || "-"}
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            {formatDate(payment.lastPaymentDate)}
                          </TableCell>

                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openRecordPayment(payment)}>
                                  <DollarSign className="mr-2 h-4 w-4" />
                                  Record Payment
                                </DropdownMenuItem>

                                <DropdownMenuItem disabled>
                                  <Receipt className="mr-2 h-4 w-4" />
                                  View History
                                </DropdownMenuItem>

                                <DropdownMenuItem disabled>
                                  <Banknote className="mr-2 h-4 w-4" />
                                  Send Reminder
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => issueRefund(payment)}
                                  disabled={payment.paidAmount <= 0}
                                >
                                  <RefreshCcw className="mr-2 h-4 w-4" />
                                  Issue Refund
                                </DropdownMenuItem>
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

      <Dialog open={showRecordPaymentDialog} onOpenChange={setShowRecordPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedPaymentRow
                ? `Record a payment for ${selectedPaymentRow.vendorName}`
                : "Select a booth assignment and record payment."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Select Assignment</Label>
              <Select
                value={selectedAssignmentId}
                onValueChange={(value) => {
                  setSelectedAssignmentId(value)
                  const row = paymentRows.find((payment) => payment.assignment.id === value)
                  setPaymentAmount(row && row.balance > 0 ? String(row.balance) : "")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose vendor assignment" />
                </SelectTrigger>

                <SelectContent>
                  {paymentRows.length === 0 ? (
                    <SelectItem value="no-assignments" disabled>
                      No assignments found
                    </SelectItem>
                  ) : (
                    paymentRows.map((payment) => (
                      <SelectItem key={payment.assignment.id} value={payment.assignment.id}>
                        {payment.vendorName} - Booth {payment.boothNumber} - {formatCurrency(Math.max(0, payment.balance))} due
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedPaymentRow && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedPaymentRow.vendorName}</p>
                    <p className="text-sm text-muted-foreground">
                      Booth {selectedPaymentRow.boothNumber} - {selectedPaymentRow.boothTypeName}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Balance Due</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(Math.max(0, selectedPaymentRow.balance))}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Payment Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="payment-date">Payment Date</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRecordPaymentDialog(false)
                setSelectedAssignmentId("")
                setPaymentAmount("")
                setPaymentMethod("")
              }}
            >
              Cancel
            </Button>

            <Button
              onClick={recordPayment}
              disabled={!selectedPaymentRow || !paymentAmount || !paymentMethod || savingPayment}
            >
              {savingPayment ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}