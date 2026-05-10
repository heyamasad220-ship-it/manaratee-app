"use client"

import { useEffect, useMemo, useState } from "react"
import { PlatformHeader } from "@/components/platform/platform-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  Search,
  TrendingUp,
  Banknote,
  AlertTriangle,
  CircleDollarSign,
  MoreHorizontal,
  Eye,
  XCircle,
  RotateCcw,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Transaction {
  id: string
  date: string
  org: string
  plan: string
  amount: number
  status: "Paid" | "Pending" | "Failed" | "Refunded"
  method: string
  subscriptionStatus: "Active" | "Trial" | "Past Due" | "Canceled"
  nextBillingDate: string
}

interface Organization {
  id: string
  name: string
  status: string
  members?: number
  mrr?: number
  contact_email?: string
  contactEmail?: string
  created_at?: string
  created?: string
}

const statusStyles: Record<string, string> = {
  Paid: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Failed: "bg-red-100 text-red-700 hover:bg-red-100",
  Refunded: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
}

const subscriptionStatusStyles: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Trial: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  "Past Due": "bg-red-100 text-red-700 hover:bg-red-100",
  Canceled: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
}

const filterTabs = ["All", "Paid", "Pending", "Failed", "Refunded"] as const

export default function PaymentsPage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [retryOpen, setRetryOpen] = useState(false)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    async function loadPayments() {
      setLoading(true)

      try {
        const response = await fetch("/api/platform/organizations")
        const result = await response.json()

        if (!response.ok) {
          console.error("PAYMENTS ORGS ERROR:", result)
          setLoading(false)
          return
        }

        setOrganizations(result.organizations || [])

        // No real payments source is connected yet.
        // Keep this empty until Stripe/Supabase payments are wired.
        setTransactions([])
      } catch (error) {
        console.error("PAYMENTS LOAD ERROR:", error)
      } finally {
        setLoading(false)
      }
    }

    loadPayments()
  }, [])

  const totalMrr = organizations.reduce((sum, org) => {
    return sum + Number(org.mrr || 0)
  }, 0)

  const collectedThisMonth = transactions
    .filter((txn) => txn.status === "Paid")
    .reduce((sum, txn) => sum + txn.amount, 0)

  const outstanding = transactions
    .filter((txn) => txn.status === "Pending" || txn.status === "Failed")
    .reduce((sum, txn) => sum + txn.amount, 0)

  const failedPayments = transactions.filter((txn) => txn.status === "Failed")
    .length

  const stats = [
    {
      label: "Total MRR",
      value: `$${totalMrr.toLocaleString("en-US")}`,
      icon: TrendingUp,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Collected This Month",
      value: `$${collectedThisMonth.toLocaleString("en-US")}`,
      icon: Banknote,
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "Outstanding",
      value: `$${outstanding.toLocaleString("en-US")}`,
      icon: CircleDollarSign,
      color: "bg-amber-100 text-amber-700",
    },
    {
      label: "Failed Payments",
      value: failedPayments.toLocaleString("en-US"),
      icon: AlertTriangle,
      color: "bg-red-100 text-red-700",
    },
  ]

  const handleViewDetails = (txn: Transaction) => {
    setSelectedTxn(txn)
    setDetailsOpen(true)
  }

  const handleCancelSubscription = (txn: Transaction) => {
    setSelectedTxn(txn)
    setCancelOpen(true)
  }

  const handleRetryPayment = (txn: Transaction) => {
    setSelectedTxn(txn)
    setRetryOpen(true)
  }

  const filtered = useMemo(() => {
    let result = transactions

    if (statusFilter !== "All") {
      result = result.filter((txn) => txn.status === statusFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((txn) => txn.org.toLowerCase().includes(q))
    }

    return result
  }, [transactions, search, statusFilter])

  return (
    <>
      <PlatformHeader title="Payments" />

      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border border-border shadow-sm">
              <CardContent className="flex items-start gap-4 p-5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.color}`}
                >
                  <stat.icon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-2xl font-bold text-foreground">
                    {loading ? "—" : stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border border-border shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold text-foreground">
                Transactions
              </h3>

              <div className="flex items-center gap-3">
                <div className="relative w-[240px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by organization..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-9"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filterTabs.map((tab) => (
                      <SelectItem key={tab} value={tab}>
                        {tab}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground">
                    Organization
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground">
                    Plan
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground">
                    Amount
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground">
                    Payment Status
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground">
                    Subscription
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground">
                    Next Billing
                  </TableHead>
                  <TableHead className="font-medium text-muted-foreground">
                    Method
                  </TableHead>
                  <TableHead className="w-[60px] font-medium text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading payments...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No transactions found. Real payment records will appear
                      here after payment processing is connected.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="text-muted-foreground">
                        {txn.date}
                      </TableCell>

                      <TableCell className="font-medium text-foreground">
                        {txn.org}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {txn.plan}
                      </TableCell>

                      <TableCell className="font-medium text-foreground">
                        ${txn.amount.toLocaleString("en-US")}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusStyles[txn.status] || ""}
                        >
                          {txn.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            subscriptionStatusStyles[
                              txn.subscriptionStatus
                            ] || ""
                          }
                        >
                          {txn.subscriptionStatus}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {txn.nextBillingDate}
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {txn.method}
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleViewDetails(txn)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Subscription Details
                            </DropdownMenuItem>

                            {(txn.status === "Failed" ||
                              txn.subscriptionStatus === "Past Due") && (
                              <DropdownMenuItem
                                onClick={() => handleRetryPayment(txn)}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Retry Payment
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {txn.subscriptionStatus !== "Canceled" && (
                              <DropdownMenuItem
                                onClick={() => handleCancelSubscription(txn)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel Subscription
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
          </DialogHeader>

          {selectedTxn && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Organization</p>
                  <p className="font-medium">{selectedTxn.org}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="font-medium">{selectedTxn.plan}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Subscription Status
                  </p>
                  <Badge
                    variant="secondary"
                    className={
                      subscriptionStatusStyles[
                        selectedTxn.subscriptionStatus
                      ] || ""
                    }
                  >
                    {selectedTxn.subscriptionStatus}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Monthly Amount
                  </p>
                  <p className="font-medium">${selectedTxn.amount}/mo</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Payment Method
                  </p>
                  <p className="font-medium">{selectedTxn.method}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Next Billing Date
                  </p>
                  <p className="font-medium">{selectedTxn.nextBillingDate}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Payment</p>
                  <p className="font-medium">{selectedTxn.date}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Last Payment Status
                  </p>
                  <Badge
                    variant="secondary"
                    className={statusStyles[selectedTxn.status] || ""}
                  >
                    {selectedTxn.status}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the subscription for{" "}
              <strong>{selectedTxn?.org}</strong>? They will lose access to
              their {selectedTxn?.plan} plan features at the end of the current
              billing period.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => setCancelOpen(false)}
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={retryOpen} onOpenChange={setRetryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry Payment</AlertDialogTitle>
            <AlertDialogDescription>
              This will attempt to charge the payment method on file for{" "}
              <strong>{selectedTxn?.org}</strong> for the amount of{" "}
              <strong>${selectedTxn?.amount}</strong>. The customer will be
              notified of the charge attempt.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => setRetryOpen(false)}
            >
              Retry Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}