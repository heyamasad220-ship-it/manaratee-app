"use client"

import { useState, useMemo, useEffect } from "react"
import { 
  Search, ChevronUp, ChevronDown, Plus, DollarSign, AlertCircle, 
  CheckCircle2, XCircle, Clock, RefreshCw, CreditCard, Mail, Filter
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Header } from "@/components/layout/header"
import { Separator } from "@/components/ui/separator"

type TransactionStatus = "Paid" | "Pending" | "Failed" | "Refunded"
type TransactionType = "Membership" | "Program" | "Service" | "Donation" | "Event" | "Rental"

interface Transaction {
  id: string
  transactionId: string
  customerName: string
  customerEmail: string
  customerId: string
  type: TransactionType
  description: string
  amount: number
  date: string
  status: TransactionStatus
  paymentMethod: string
  failureReason?: string
}

const mockTransactions: Transaction[] = [
  {
    id: "txn-001",
    transactionId: "#TXN001790",
    customerName: "Ahmed Hassan",
    customerEmail: "ahmed.hassan@email.com",
    customerId: "cust-001",
    type: "Service",
    description: "After School Care - February 2026",
    amount: 250.00,
    date: "Feb 15, 2026",
    status: "Failed",
    paymentMethod: "Visa ending in 4242",
    failureReason: "Card declined - insufficient funds",
  },
  {
    id: "txn-002",
    transactionId: "#TXN001235",
    customerName: "Sarah Johnson",
    customerEmail: "sarah.johnson@email.com",
    customerId: "cust-002",
    type: "Membership",
    description: "Family Membership - March 2026",
    amount: 75.00,
    date: "Feb 20, 2026",
    status: "Failed",
    paymentMethod: "Visa ending in 4242",
    failureReason: "Card expired",
  },
  {
    id: "txn-003",
    transactionId: "#TXN001789",
    customerName: "Ahmed Hassan",
    customerEmail: "ahmed.hassan@email.com",
    customerId: "cust-001",
    type: "Service",
    description: "After School Care - January 2026",
    amount: 250.00,
    date: "Feb 1, 2026",
    status: "Paid",
    paymentMethod: "Visa ending in 4242",
  },
  {
    id: "txn-004",
    transactionId: "#TXN001456",
    customerName: "Michael Chen",
    customerEmail: "michael.chen@email.com",
    customerId: "cust-003",
    type: "Program",
    description: "Youth Swimming Lessons",
    amount: 180.00,
    date: "Feb 10, 2026",
    status: "Paid",
    paymentMethod: "Mastercard ending in 5555",
  },
  {
    id: "txn-005",
    transactionId: "#TXN001234",
    customerName: "Sarah Johnson",
    customerEmail: "sarah.johnson@email.com",
    customerId: "cust-002",
    type: "Membership",
    description: "Family Membership - February 2026",
    amount: 75.00,
    date: "Feb 1, 2026",
    status: "Paid",
    paymentMethod: "Visa ending in 4242",
  },
  {
    id: "txn-006",
    transactionId: "#TXN001500",
    customerName: "Fatima Al-Rashid",
    customerEmail: "fatima.rashid@email.com",
    customerId: "cust-004",
    type: "Donation",
    description: "General Fund - Monthly Pledge",
    amount: 100.00,
    date: "Feb 15, 2026",
    status: "Paid",
    paymentMethod: "Visa ending in 1234",
  },
  {
    id: "txn-007",
    transactionId: "#TXN001501",
    customerName: "Omar Syed",
    customerEmail: "omar.syed@email.com",
    customerId: "cust-005",
    type: "Event",
    description: "Spring Festival Registration",
    amount: 45.00,
    date: "Feb 18, 2026",
    status: "Pending",
    paymentMethod: "Pending",
  },
  {
    id: "txn-008",
    transactionId: "#TXN001100",
    customerName: "Layla Mahmoud",
    customerEmail: "layla.mahmoud@email.com",
    customerId: "cust-006",
    type: "Program",
    description: "Yoga Class - January Session",
    amount: 45.00,
    date: "Jan 5, 2026",
    status: "Refunded",
    paymentMethod: "Visa ending in 9876",
  },
  {
    id: "txn-009",
    transactionId: "#TXN001502",
    customerName: "Ibrahim Khan",
    customerEmail: "ibrahim.khan@email.com",
    customerId: "cust-007",
    type: "Rental",
    description: "Main Hall Rental - Feb 22",
    amount: 350.00,
    date: "Feb 20, 2026",
    status: "Paid",
    paymentMethod: "Mastercard ending in 5555",
  },
  {
    id: "txn-010",
    transactionId: "#TXN001503",
    customerName: "Nadia Omar",
    customerEmail: "nadia.omar@email.com",
    customerId: "cust-008",
    type: "Membership",
    description: "Individual Membership - March 2026",
    amount: 35.00,
    date: "Feb 21, 2026",
    status: "Failed",
    paymentMethod: "Visa ending in 7777",
    failureReason: "Payment method not valid",
  },
]

type SortField = "transactionId" | "customerName" | "type" | "amount" | "date" | "status"
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

const statusStyles: Record<TransactionStatus, { badge: string; icon: React.ElementType }> = {
  Paid: { badge: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100", icon: CheckCircle2 },
  Pending: { badge: "bg-amber-100 text-amber-700 hover:bg-amber-100", icon: Clock },
  Failed: { badge: "bg-red-100 text-red-700 hover:bg-red-100", icon: XCircle },
  Refunded: { badge: "bg-blue-100 text-blue-700 hover:bg-blue-100", icon: RefreshCw },
}

const typeStyles: Record<TransactionType, string> = {
  Membership: "bg-purple-100 text-purple-700",
  Program: "bg-blue-100 text-blue-700",
  Service: "bg-teal-100 text-teal-700",
  Donation: "bg-rose-100 text-rose-700",
  Event: "bg-amber-100 text-amber-700",
  Rental: "bg-indigo-100 text-indigo-700",
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function BillingPage() {
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [isRetryDialogOpen, setIsRetryDialogOpen] = useState(false)
  const [selectedForRetry, setSelectedForRetry] = useState<Transaction | null>(null)
  const [activeTab, setActiveTab] = useState("all")

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
    let result = [...mockTransactions]

    // Tab filter
    if (activeTab === "failed") {
      result = result.filter((t) => t.status === "Failed")
    } else if (activeTab === "pending") {
      result = result.filter((t) => t.status === "Pending")
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          t.customerName.toLowerCase().includes(q) ||
          t.transactionId.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter)
    }

    if (typeFilter !== "all") {
      result = result.filter((t) => t.type === typeFilter)
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "transactionId":
          cmp = a.transactionId.localeCompare(b.transactionId)
          break
        case "customerName":
          cmp = a.customerName.toLowerCase().localeCompare(b.customerName.toLowerCase())
          break
        case "type":
          cmp = a.type.localeCompare(b.type)
          break
        case "amount":
          cmp = a.amount - b.amount
          break
        case "date":
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
          break
        case "status":
          cmp = a.status.localeCompare(b.status)
          break
      }
      return sortDirection === "asc" ? cmp : -cmp
    })

    return result
  }, [search, statusFilter, typeFilter, sortField, sortDirection, activeTab])

  const totalAmount = filtered.reduce((sum, t) => sum + t.amount, 0)
  const failedCount = mockTransactions.filter((t) => t.status === "Failed").length
  const failedAmount = mockTransactions.filter((t) => t.status === "Failed").reduce((sum, t) => sum + t.amount, 0)
  const paidAmount = mockTransactions.filter((t) => t.status === "Paid").reduce((sum, t) => sum + t.amount, 0)
  const pendingCount = mockTransactions.filter((t) => t.status === "Pending").length

  function openRetryDialog(transaction: Transaction) {
    setSelectedForRetry(transaction)
    setIsRetryDialogOpen(true)
  }

  function handleRetryPayment() {
    // In production, this would retry the payment via API
    console.log("Retrying payment for:", selectedForRetry?.transactionId)
    setIsRetryDialogOpen(false)
    setSelectedForRetry(null)
  }

  function handleSendReminder(transaction: Transaction) {
    // In production, this would send an email reminder
    console.log("Sending reminder to:", transaction.customerEmail)
  }

  if (!mounted) {
    return (
      <>
        <Header title="Billing" />
        <div className="flex flex-col gap-6 p-6">
          <div className="h-10 w-48 animate-pulse rounded bg-muted" />
          <div className="h-9 w-full max-w-sm animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Billing" />
      <div className="flex flex-col gap-6 p-6">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(paidAmount)}</p>
                <p className="text-xs text-muted-foreground">Collected (This Month)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending Payments</p>
              </div>
            </CardContent>
          </Card>
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
          <Card className="border border-red-200 bg-red-50/50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <DollarSign className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(failedAmount)}</p>
                <p className="text-xs text-red-600/80">Failed Amount</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All Transactions</TabsTrigger>
              <TabsTrigger value="failed" className="text-red-600 data-[state=active]:text-red-600">
                Failed ({failedCount})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({pendingCount})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-4">
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              {activeTab === "all" && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                    <SelectItem value="Refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Membership">Membership</SelectItem>
                  <SelectItem value="Program">Program</SelectItem>
                  <SelectItem value="Service">Service</SelectItem>
                  <SelectItem value="Donation">Donation</SelectItem>
                  <SelectItem value="Event">Event</SelectItem>
                  <SelectItem value="Rental">Rental</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results Summary */}
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filtered.length} transactions &middot; {formatCurrency(totalAmount)} total
              </p>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                          onClick={() => handleSort("transactionId")}
                        >
                          Transaction
                          <SortIcon field="transactionId" currentField={sortField} direction={sortDirection} />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                          onClick={() => handleSort("customerName")}
                        >
                          Customer
                          <SortIcon field="customerName" currentField={sortField} direction={sortDirection} />
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
                          onClick={() => handleSort("date")}
                        >
                          Date
                          <SortIcon field="date" currentField={sortField} direction={sortDirection} />
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No transactions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((transaction) => {
                        const StatusIcon = statusStyles[transaction.status].icon
                        return (
                          <TableRow key={transaction.id} className={transaction.status === "Failed" ? "bg-red-50/50" : ""}>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => setSelectedTransaction(transaction)}
                                className="font-mono text-sm text-primary underline-offset-4 hover:underline"
                              >
                                {transaction.transactionId}
                              </button>
                              <p className="text-xs text-muted-foreground">{transaction.description}</p>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{transaction.customerName}</span>
                              <p className="text-xs text-muted-foreground">{transaction.customerEmail}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={typeStyles[transaction.type]}>
                                {transaction.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{transaction.date}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant="secondary" className={statusStyles[transaction.status].badge}>
                                  <StatusIcon className="mr-1 h-3 w-3" />
                                  {transaction.status}
                                </Badge>
                                {transaction.failureReason && (
                                  <span className="text-xs text-red-600">{transaction.failureReason}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {transaction.status === "Failed" && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => handleSendReminder(transaction)}
                                    >
                                      <Mail className="mr-1 h-3 w-3" />
                                      Remind
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-7 bg-red-600 text-xs hover:bg-red-700"
                                      onClick={() => openRetryDialog(transaction)}
                                    >
                                      <RefreshCw className="mr-1 h-3 w-3" />
                                      Retry
                                    </Button>
                                  </>
                                )}
                                {transaction.status === "Pending" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => handleSendReminder(transaction)}
                                  >
                                    <Mail className="mr-1 h-3 w-3" />
                                    Remind
                                  </Button>
                                )}
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
          </TabsContent>
        </Tabs>

        {/* Transaction Detail Dialog */}
        <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
          <DialogContent className="max-w-lg">
            {selectedTransaction && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    {selectedTransaction.transactionId}
                    <Badge
                      variant="secondary"
                      className={statusStyles[selectedTransaction.status].badge}
                    >
                      {selectedTransaction.status}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription>{selectedTransaction.description}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Customer</span>
                      <span className="text-sm font-medium">{selectedTransaction.customerName}</span>
                      <span className="text-xs text-muted-foreground">{selectedTransaction.customerEmail}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Amount</span>
                      <span className="text-lg font-bold">{formatCurrency(selectedTransaction.amount)}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Type</span>
                      <Badge variant="secondary" className={`w-fit ${typeStyles[selectedTransaction.type]}`}>
                        {selectedTransaction.type}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Date</span>
                      <span className="text-sm font-medium">{selectedTransaction.date}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Payment Method</span>
                    <span className="text-sm font-medium">{selectedTransaction.paymentMethod}</span>
                  </div>
                  {selectedTransaction.failureReason && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-700">Failure Reason</span>
                      </div>
                      <p className="mt-1 text-sm text-red-600">{selectedTransaction.failureReason}</p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedTransaction(null)}>
                    Close
                  </Button>
                  {selectedTransaction.status === "Failed" && (
                    <Button
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => {
                        setSelectedTransaction(null)
                        openRetryDialog(selectedTransaction)
                      }}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Payment
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Retry Payment Dialog */}
        <Dialog open={isRetryDialogOpen} onOpenChange={setIsRetryDialogOpen}>
          <DialogContent className="max-w-md">
            {selectedForRetry && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-red-600" />
                    Retry Failed Payment
                  </DialogTitle>
                  <DialogDescription>
                    Retry the payment for {selectedForRetry.customerName}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Transaction</span>
                      <span className="font-mono text-sm">{selectedForRetry.transactionId}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Amount</span>
                      <span className="text-lg font-bold">{formatCurrency(selectedForRetry.amount)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-600">{selectedForRetry.failureReason}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Payment Method</Label>
                    <Select defaultValue="same">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same">
                          Use same method ({selectedForRetry.paymentMethod})
                        </SelectItem>
                        <SelectItem value="new">Request new payment method</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Note to Customer (Optional)</Label>
                    <Textarea
                      placeholder="Add a note that will be sent with the payment retry notification..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRetryDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="bg-red-600 hover:bg-red-700" onClick={handleRetryPayment}>
                    Retry Payment
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
