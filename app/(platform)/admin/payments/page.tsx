"use client"

import { useState, useMemo } from "react"
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
import { Search, TrendingUp, Banknote, AlertTriangle, CircleDollarSign, MoreHorizontal, Eye, XCircle, RotateCcw, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
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

const stats = [
  { label: "Total MRR", value: "$28,450", icon: TrendingUp, color: "bg-emerald-100 text-emerald-700" },
  { label: "Collected This Month", value: "$26,200", icon: Banknote, color: "bg-blue-100 text-blue-700" },
  { label: "Outstanding", value: "$1,850", icon: CircleDollarSign, color: "bg-amber-100 text-amber-700" },
  { label: "Failed Payments", value: "3", icon: AlertTriangle, color: "bg-red-100 text-red-700" },
]

interface Transaction {
  id: string
  date: string
  org: string
  plan: string
  amount: number
  status: string
  method: string
  subscriptionStatus: "Active" | "Trial" | "Past Due" | "Canceled"
  nextBillingDate: string
}

const transactions: Transaction[] = [
  { id: "txn-1", date: "Feb 23, 2026", org: "Al-Noor Community Center", plan: "Professional", amount: 200, status: "Paid", method: "Credit Card", subscriptionStatus: "Active", nextBillingDate: "Mar 23, 2026" },
  { id: "txn-2", date: "Feb 22, 2026", org: "Salam Foundation", plan: "Enterprise", amount: 900, status: "Paid", method: "ACH Transfer", subscriptionStatus: "Active", nextBillingDate: "Mar 22, 2026" },
  { id: "txn-3", date: "Feb 22, 2026", org: "Crescent Community Hub", plan: "Starter", amount: 100, status: "Failed", method: "Credit Card", subscriptionStatus: "Past Due", nextBillingDate: "Feb 22, 2026" },
  { id: "txn-4", date: "Feb 21, 2026", org: "Masjid Al-Rahman", plan: "Professional", amount: 200, status: "Paid", method: "Credit Card", subscriptionStatus: "Active", nextBillingDate: "Mar 21, 2026" },
  { id: "txn-5", date: "Feb 21, 2026", org: "Noor Academy", plan: "Enterprise", amount: 900, status: "Paid", method: "ACH Transfer", subscriptionStatus: "Trial", nextBillingDate: "Mar 7, 2026" },
  { id: "txn-6", date: "Feb 20, 2026", org: "Unity Islamic School", plan: "Professional", amount: 200, status: "Pending", method: "Credit Card", subscriptionStatus: "Active", nextBillingDate: "Mar 20, 2026" },
  { id: "txn-7", date: "Feb 20, 2026", org: "Iqra Learning Center", plan: "Starter", amount: 100, status: "Paid", method: "Credit Card", subscriptionStatus: "Active", nextBillingDate: "Mar 20, 2026" },
  { id: "txn-8", date: "Feb 19, 2026", org: "Islamic Center of Austin", plan: "Starter", amount: 100, status: "Failed", method: "Credit Card", subscriptionStatus: "Past Due", nextBillingDate: "Feb 19, 2026" },
  { id: "txn-9", date: "Feb 18, 2026", org: "Al-Noor Community Center", plan: "Professional", amount: 200, status: "Refunded", method: "Credit Card", subscriptionStatus: "Canceled", nextBillingDate: "-" },
  { id: "txn-10", date: "Feb 17, 2026", org: "Salam Foundation", plan: "Enterprise", amount: 900, status: "Paid", method: "ACH Transfer", subscriptionStatus: "Active", nextBillingDate: "Mar 17, 2026" },
]

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
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [retryOpen, setRetryOpen] = useState(false)

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
      result = result.filter((t) => t.status === statusFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((t) => t.org.toLowerCase().includes(q))
    }
    return result
  }, [search, statusFilter])

  return (
    <>
      <PlatformHeader title="Payments" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border border-border shadow-sm">
              <CardContent className="flex items-start gap-4 p-5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="mt-0.5 text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Transactions Table */}
        <Card className="border border-border shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Transactions</h3>
              <div className="flex items-center gap-3">
                <div className="relative w-[240px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by organization..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
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
                  <TableHead className="font-medium text-muted-foreground">Date</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Organization</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Plan</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Amount</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Payment Status</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Subscription</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Next Billing</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Method</TableHead>
                  <TableHead className="font-medium text-muted-foreground w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="text-muted-foreground">{txn.date}</TableCell>
                      <TableCell className="font-medium text-foreground">{txn.org}</TableCell>
                      <TableCell className="text-muted-foreground">{txn.plan}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        ${txn.amount.toLocaleString("en-US")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusStyles[txn.status] || ""}>
                          {txn.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={subscriptionStatusStyles[txn.subscriptionStatus] || ""}>
                          {txn.subscriptionStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {txn.nextBillingDate}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{txn.method}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(txn)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Subscription Details
                            </DropdownMenuItem>
                            {(txn.status === "Failed" || txn.subscriptionStatus === "Past Due") && (
                              <DropdownMenuItem onClick={() => handleRetryPayment(txn)}>
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

      {/* Subscription Details Dialog */}
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
                  <p className="text-sm text-muted-foreground">Subscription Status</p>
                  <Badge variant="secondary" className={subscriptionStatusStyles[selectedTxn.subscriptionStatus]}>
                    {selectedTxn.subscriptionStatus}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Monthly Amount</p>
                  <p className="font-medium">${selectedTxn.amount}/mo</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium">{selectedTxn.method}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Next Billing Date</p>
                  <p className="font-medium">{selectedTxn.nextBillingDate}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Payment</p>
                  <p className="font-medium">{selectedTxn.date}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Payment Status</p>
                  <Badge variant="secondary" className={statusStyles[selectedTxn.status]}>
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

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the subscription for <strong>{selectedTxn?.org}</strong>? 
              They will lose access to their {selectedTxn?.plan} plan features at the end of the current billing period.
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

      {/* Retry Payment Dialog */}
      <AlertDialog open={retryOpen} onOpenChange={setRetryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry Payment</AlertDialogTitle>
            <AlertDialogDescription>
              This will attempt to charge the payment method on file for <strong>{selectedTxn?.org}</strong> 
              for the amount of <strong>${selectedTxn?.amount}</strong>. 
              The customer will be notified of the charge attempt.
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
