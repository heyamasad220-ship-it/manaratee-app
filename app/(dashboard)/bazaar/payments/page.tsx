"use client"

import { useState } from "react"
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
  CreditCard,
  Banknote,
  Receipt,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Mock bazaar events for selector
const bazaarEvents = [
  { id: "bz-1", name: "Annual Community Bazaar 2026" },
  { id: "bz-2", name: "Ramadan Night Market" },
  { id: "bz-3", name: "Eid Celebration Bazaar" },
]

// Mock vendor payments
const mockPayments = [
  {
    id: "p-1",
    vendor: "Islamic Arts & Crafts",
    booth: "A-01",
    boothType: "Standard",
    feeAmount: 150,
    paidAmount: 150,
    balance: 0,
    status: "paid",
    paymentMethod: "Credit Card",
    lastPaymentDate: "Feb 20, 2026",
  },
  {
    id: "p-2",
    vendor: "Modest Fashion Hub",
    booth: "A-02",
    boothType: "Premium",
    feeAmount: 250,
    paidAmount: 250,
    balance: 0,
    status: "paid",
    paymentMethod: "Bank Transfer",
    lastPaymentDate: "Feb 18, 2026",
  },
  {
    id: "p-3",
    vendor: "Halal Eats Co.",
    booth: "B-01",
    boothType: "Food Booth",
    feeAmount: 300,
    paidAmount: 150,
    balance: 150,
    status: "partial",
    paymentMethod: "Cash",
    lastPaymentDate: "Feb 22, 2026",
  },
  {
    id: "p-4",
    vendor: "Kids Fun Zone",
    booth: "C-01",
    boothType: "Activity Space",
    feeAmount: 350,
    paidAmount: 0,
    balance: 350,
    status: "unpaid",
    paymentMethod: null,
    lastPaymentDate: null,
  },
  {
    id: "p-5",
    vendor: "Halal Cosmetics Co.",
    booth: "A-03",
    boothType: "Premium",
    feeAmount: 250,
    paidAmount: 0,
    balance: 250,
    status: "unpaid",
    paymentMethod: null,
    lastPaymentDate: null,
  },
  {
    id: "p-6",
    vendor: "Books & Beyond",
    booth: "A-05",
    boothType: "Corner",
    feeAmount: 200,
    paidAmount: 200,
    balance: 0,
    status: "paid",
    paymentMethod: "Check",
    lastPaymentDate: "Feb 25, 2026",
  },
  {
    id: "p-7",
    vendor: "Baklava Paradise",
    booth: "B-02",
    boothType: "Food Booth",
    feeAmount: 300,
    paidAmount: 300,
    balance: -50,
    status: "refunded",
    paymentMethod: "Credit Card",
    lastPaymentDate: "Feb 15, 2026",
  },
  {
    id: "p-8",
    vendor: "Henna Artists",
    booth: "C-02",
    boothType: "Activity Space",
    feeAmount: 350,
    paidAmount: 100,
    balance: 250,
    status: "partial",
    paymentMethod: "Cash",
    lastPaymentDate: "Feb 28, 2026",
  },
]

const statusConfig = {
  unpaid: { label: "Unpaid", color: "border-red-200 bg-red-50 text-red-700", icon: AlertCircle },
  partial: { label: "Partial", color: "border-amber-200 bg-amber-50 text-amber-700", icon: Clock },
  paid: { label: "Paid", color: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  refunded: { label: "Refunded", color: "border-blue-200 bg-blue-50 text-blue-700", icon: RefreshCcw },
}

export default function BazaarPaymentsPage() {
  const [selectedEvent, setSelectedEvent] = useState(bazaarEvents[0])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showRecordPaymentDialog, setShowRecordPaymentDialog] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<typeof mockPayments[0] | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")

  const filteredPayments = mockPayments.filter((payment) => {
    const matchesSearch = payment.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.booth.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    totalExpected: mockPayments.reduce((sum, p) => sum + p.feeAmount, 0),
    totalCollected: mockPayments.reduce((sum, p) => sum + p.paidAmount, 0),
    outstanding: mockPayments.reduce((sum, p) => sum + Math.max(0, p.balance), 0),
    overdue: mockPayments.filter((p) => p.status === "unpaid").length,
  }

  const handleRecordPayment = (payment: typeof mockPayments[0]) => {
    setSelectedVendor(payment)
    setPaymentAmount(payment.balance > 0 ? payment.balance.toString() : "")
    setPaymentMethod("")
    setShowRecordPaymentDialog(true)
  }

  return (
    <>
      <Header title="Vendor Payments" />
      <div className="flex flex-col gap-6 p-6">
        {/* Event Selector */}
        <div className="flex items-center gap-3">
          <Select
            value={selectedEvent.id}
            onValueChange={(val) => setSelectedEvent(bazaarEvents.find((e) => e.id === val) || bazaarEvents[0])}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bazaarEvents.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Expected</p>
                  <p className="text-2xl font-bold">${stats.totalExpected.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold text-emerald-600">${stats.totalCollected.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold text-amber-600">${stats.outstanding.toLocaleString()}</p>
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
                  <p className="text-sm text-muted-foreground">Overdue Payments</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Payment Records</CardTitle>
                <CardDescription>Track and manage vendor fee payments</CardDescription>
              </div>
              <Button onClick={() => setShowRecordPaymentDialog(true)} className="gap-2">
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
                  placeholder="Search vendors or booths..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => {
                    const StatusIcon = statusConfig[payment.status as keyof typeof statusConfig].icon
                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.vendor}</TableCell>
                        <TableCell>
                          <div>
                            <p>{payment.booth}</p>
                            <p className="text-xs text-muted-foreground">{payment.boothType}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">${payment.feeAmount}</TableCell>
                        <TableCell className="text-right">${payment.paidAmount}</TableCell>
                        <TableCell className={cn("text-right font-medium", payment.balance > 0 && "text-red-600", payment.balance < 0 && "text-blue-600")}>
                          ${Math.abs(payment.balance)}
                          {payment.balance < 0 && " (credit)"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("gap-1", statusConfig[payment.status as keyof typeof statusConfig].color)}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig[payment.status as keyof typeof statusConfig].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.paymentMethod || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.lastPaymentDate || "-"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleRecordPayment(payment)}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Record Payment
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Receipt className="mr-2 h-4 w-4" />
                                View History
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Banknote className="mr-2 h-4 w-4" />
                                Send Reminder
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                Issue Refund
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={showRecordPaymentDialog} onOpenChange={setShowRecordPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {selectedVendor
                ? `Record a payment for ${selectedVendor.vendor}`
                : "Select a vendor and record their payment"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {!selectedVendor && (
              <div className="flex flex-col gap-2">
                <Label>Select Vendor</Label>
                <Select onValueChange={(val) => setSelectedVendor(mockPayments.find(p => p.id === val) || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockPayments.filter(p => p.status !== "paid").map((payment) => (
                      <SelectItem key={payment.id} value={payment.id}>
                        {payment.vendor} - ${payment.balance} due
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedVendor && (
              <>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedVendor.vendor}</p>
                      <p className="text-sm text-muted-foreground">{selectedVendor.booth} - {selectedVendor.boothType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Balance Due</p>
                      <p className="text-lg font-bold text-red-600">${selectedVendor.balance}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="amount">Payment Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
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
                      <SelectItem value="credit">Credit Card</SelectItem>
                      <SelectItem value="debit">Debit Card</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="zelle">Zelle</SelectItem>
                      <SelectItem value="venmo">Venmo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRecordPaymentDialog(false)
              setSelectedVendor(null)
            }}>
              Cancel
            </Button>
            <Button disabled={!selectedVendor || !paymentAmount || !paymentMethod}>
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
