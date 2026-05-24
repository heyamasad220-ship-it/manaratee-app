"use client"

import { useEffect, useState } from "react"
import {
  Heart,
  CreditCard,
  DollarSign,
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

type Contact = {
  id: string
  full_name: string
  email: string | null
  organization_id: string
}

type DonationPledge = {
  id: string
  campaign: string
  totalAmount: number
  paidAmount: number
  balance: number
  frequency: string
  nextPaymentDate: string | null
  nextPaymentAmount: number
  startDate: string | null
  endDate: string | null
  status: string
}

type DonationPayment = {
  id: string
  date: string
  amount: number
  campaign: string
  method: string
  status: string
}

type SavedPaymentMethod = {
  id: string
  type: string
  last4: string
  isDefault: boolean
}

const donationCategories = [
  {
    id: "operations",
    label: "Operations",
    subcategories: [
      { id: "general", label: "General Fund" },
      { id: "building", label: "Building & Maintenance" },
    ],
  },
  {
    id: "programs",
    label: "Programs",
    subcategories: [
      { id: "youth", label: "Youth Programs" },
      { id: "education", label: "Education" },
    ],
  },
  {
    id: "community",
    label: "Community",
    subcategories: [
      { id: "outreach", label: "Community Outreach" },
      { id: "emergency", label: "Emergency Relief" },
    ],
  },
]

export default function CustomerDonationsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [contact, setContact] = useState<Contact | null>(null)
  const [pledges, setPledges] = useState<DonationPledge[]>([])
  const [payments, setPayments] = useState<DonationPayment[]>([])
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([])

  const [selectedPledge, setSelectedPledge] = useState<DonationPledge | null>(null)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showNewPledgeDialog, setShowNewPledgeDialog] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const [newPledgeForm, setNewPledgeForm] = useState({
    amount: "",
    frequency: "one-time",
    payments: "1",
    category: "",
    subcategory: "",
    paymentMethod: "",
  })

  useEffect(() => {
    async function loadDonationsPage() {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setContact(null)
        setPledges([])
        setPayments([])
        setSavedPaymentMethods([])
        setLoading(false)
        return
      }

      const { data: contactData, error: contactError } = await supabase
        .from("contacts")
        .select("id, full_name, email, organization_id")
        .eq("auth_user_id", user.id)
        .maybeSingle()

      if (contactError || !contactData) {
        console.error("Customer donations contact load error:", contactError)
        setContact(null)
        setPledges([])
        setPayments([])
        setSavedPaymentMethods([])
        setLoading(false)
        return
      }

      setContact(contactData)

            // Load real pledges
      const { data: pledgesData } = await supabase
        .from("donation_pledges")
        .select("*")
        .eq("contact_id", contactData.id)
        .eq("organization_id", contactData.organization_id)
        .order("created_at", { ascending: false })

      // Load real payments
      const { data: paymentsData, error: paymentsError } = await supabase
  .from("payments")
  .select("*")
  .eq("contact_id", contactData.id)
  .eq("organization_id", contactData.organization_id)
  .order("payment_date", { ascending: false })

console.log("PAYMENTS DATA:", paymentsData)
console.log("PAYMENTS ERROR:", paymentsError)

      const formattedPledges: DonationPledge[] = (pledgesData || []).map((p) => ({
        id: p.id,
        campaign: p.fund_name || "General Fund",
        totalAmount: Number(p.pledged_amount || p.amount || 0),
        paidAmount: Number(p.collected_amount || 0),
        balance:
          Number(p.pledged_amount || p.amount || 0) -
          Number(p.collected_amount || 0),
        frequency: p.frequency || "one-time",
        nextPaymentDate: null,
        nextPaymentAmount: 0,
        startDate: p.start_date || null,
        endDate: p.end_date || null,
        status: p.status || "Active",
      }))

      const formattedPayments: DonationPayment[] = (paymentsData || []).map((p) => ({
        id: p.id,
        date: p.payment_date || "",
        amount: Number(p.amount || 0),
        campaign: p.fund_name || "General Fund",
        method: p.payment_method || p.source || "Card",
        status: p.status || "Completed",
      }))

      setPledges(formattedPledges)
      setPayments(formattedPayments)

      // Keep payment methods empty for now
      setSavedPaymentMethods([])
      setSelectedPaymentMethod("")

      setLoading(false)
    }

    loadDonationsPage()
  }, [supabase])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const totalPledged = pledges.reduce((sum, pledge) => sum + Number(pledge.totalAmount || 0), 0)
  const totalPaid = pledges.reduce((sum, pledge) => sum + Number(pledge.paidAmount || 0), 0)
  const outstandingBalance = pledges.reduce((sum, pledge) => sum + Number(pledge.balance || 0), 0)
  const activePledges = pledges.filter((p) => p.status === "Active")
  const upcomingPaymentTotal = activePledges.reduce(
    (sum, p) => sum + Number(p.nextPaymentAmount || 0),
    0
  )
  const nextPaymentDate =
    activePledges.find((pledge) => pledge.nextPaymentDate)?.nextPaymentDate || "—"

  const handlePayPledge = (pledge: DonationPledge) => {
    setSelectedPledge(pledge)
    setPaymentAmount(String(pledge.nextPaymentAmount || pledge.balance || ""))
    setSelectedPaymentMethod(savedPaymentMethods[0]?.id || "")
    setShowPaymentDialog(true)
    setPaymentSuccess(false)
  }

  const processPayment = async () => {
    setIsProcessing(true)

    // Payment processing is intentionally not connected yet.
    await new Promise((resolve) => setTimeout(resolve, 500))

    setIsProcessing(false)
    setPaymentSuccess(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Active</Badge>
      case "Fulfilled":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Fulfilled</Badge>
      case "Completed":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>
      case "Pending":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Donations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View your pledges, payments, and manage your donations.
        </p>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pledged</p>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? "—" : formatCurrency(totalPledged)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Heart className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {loading ? "—" : formatCurrency(totalPaid)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className="text-2xl font-bold text-amber-600">
                  {loading ? "—" : formatCurrency(outstandingBalance)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Next Payment Due</p>
                <p className="text-2xl font-bold text-violet-600">
                  {loading ? "—" : formatCurrency(upcomingPaymentTotal)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{nextPaymentDate}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <Calendar className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action */}
      {activePledges.length > 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Pay All Upcoming Payments</h3>
                <p className="text-sm text-muted-foreground">
                  Pay {formatCurrency(upcomingPaymentTotal)} for all {activePledges.length} active pledges at once
                </p>
              </div>
              <Button size="lg" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Pay {formatCurrency(upcomingPaymentTotal)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="pledges" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pledges">My Pledges</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>

        {/* Pledges Tab */}
        <TabsContent value="pledges" className="mt-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Your Pledges</h2>
              <Button variant="outline" size="sm" onClick={() => setShowNewPledgeDialog(true)}>
                <Plus className="mr-1 h-4 w-4" />
                New Pledge
              </Button>
            </div>

            <div className="flex flex-col gap-4">
              {loading ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Loading donations...
                  </CardContent>
                </Card>
              ) : pledges.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <Heart className="h-10 w-10 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium text-foreground">No pledges yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Create a pledge when you are ready to support a fund.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setShowNewPledgeDialog(true)}>
                      <Plus className="mr-1 h-4 w-4" />
                      New Pledge
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                pledges.map((pledge) => (
                  <Card key={pledge.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col lg:flex-row">
                        {/* Pledge Info */}
                        <div className="flex-1 p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground">{pledge.campaign}</h3>
                                {getStatusBadge(pledge.status)}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {pledge.frequency} pledge
                              </p>
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="mt-4">
                            <div className="mb-2 flex justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">
                                {formatCurrency(pledge.paidAmount)} of {formatCurrency(pledge.totalAmount)}
                              </span>
                            </div>
                            <Progress
                              value={pledge.totalAmount > 0 ? (pledge.paidAmount / pledge.totalAmount) * 100 : 0}
                              className="h-2"
                            />
                            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                              <span>
                                {pledge.totalAmount > 0
                                  ? Math.round((pledge.paidAmount / pledge.totalAmount) * 100)
                                  : 0}
                                % complete
                              </span>
                              <span>{formatCurrency(pledge.balance)} remaining</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Panel */}
                        {pledge.status === "Active" && (
                          <div className="flex flex-col justify-center gap-3 border-t border-border bg-muted/30 p-5 lg:w-64 lg:border-l lg:border-t-0">
                            <div className="text-center lg:text-left">
                              <p className="text-xs text-muted-foreground">Next Payment</p>
                              <p className="text-lg font-bold text-foreground">
                                {formatCurrency(pledge.nextPaymentAmount)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Due {pledge.nextPaymentDate || "—"}
                              </p>
                            </div>
                            <Button
                              className="w-full gap-2"
                              onClick={() => handlePayPledge(pledge)}
                            >
                              <CreditCard className="h-4 w-4" />
                              Pay Now
                            </Button>
                          </div>
                        )}

                        {pledge.status === "Fulfilled" && (
                          <div className="flex flex-col items-center justify-center gap-2 border-t border-border bg-emerald-50 p-5 lg:w-64 lg:border-l lg:border-t-0">
                            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                            <p className="text-sm font-medium text-emerald-700">Fully Paid</p>
                            <p className="text-xs text-emerald-600">Thank you!</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="mt-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">Payment History</h2>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 text-sm text-muted-foreground">Loading payment history...</div>
                ) : payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <CreditCard className="h-10 w-10 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium text-foreground">No payments yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Your completed donation payments will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{payment.campaign}</p>
                            <p className="text-sm text-muted-foreground">{payment.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold text-foreground">{formatCurrency(payment.amount)}</p>
                            <p className="text-xs text-muted-foreground">{payment.method}</p>
                          </div>
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {paymentSuccess ? "Payment Successful" : "Make a Payment"}
            </DialogTitle>
            <DialogDescription>
              {paymentSuccess
                ? "Thank you for your contribution!"
                : selectedPledge?.campaign}
            </DialogDescription>
          </DialogHeader>

          {paymentSuccess ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(Number(paymentAmount))}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Payment processed successfully
                </p>
              </div>
              <Button className="mt-4 w-full" onClick={() => setShowPaymentDialog(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 py-4">
                {/* Amount */}
                <div className="flex flex-col gap-2">
                  <Label>Payment Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                  {selectedPledge && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPaymentAmount(String(selectedPledge.nextPaymentAmount))}
                      >
                        Next Due ({formatCurrency(selectedPledge.nextPaymentAmount)})
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPaymentAmount(String(selectedPledge.balance))}
                      >
                        Full Balance ({formatCurrency(selectedPledge.balance)})
                      </Button>
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div className="flex flex-col gap-2">
                  <Label>Payment Method</Label>
                  {savedPaymentMethods.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No saved payment methods yet.
                    </div>
                  ) : (
                    <RadioGroup
                      value={selectedPaymentMethod}
                      onValueChange={setSelectedPaymentMethod}
                      className="flex flex-col gap-2"
                    >
                      {savedPaymentMethods.map((method) => (
                        <div key={method.id} className="flex items-center gap-3 rounded-lg border p-3">
                          <RadioGroupItem value={method.id} id={method.id} />
                          <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <span>
                                {method.type} **** {method.last4}
                              </span>
                              {method.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                  <Button variant="ghost" size="sm" className="w-fit text-primary">
                    <Plus className="mr-1 h-4 w-4" />
                    Add new card
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={processPayment}
                  disabled={!paymentAmount || isProcessing || savedPaymentMethods.length === 0}
                  className="gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Pay {formatCurrency(Number(paymentAmount) || 0)}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Pledge Dialog */}
      <Dialog open={showNewPledgeDialog} onOpenChange={setShowNewPledgeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Make a New Pledge</DialogTitle>
            <DialogDescription>
              Set up a new pledge to support our community.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {/* Amount */}
            <div className="flex flex-col gap-2">
              <Label>Amount per Payment</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  value={newPledgeForm.amount}
                  onChange={(e) => setNewPledgeForm({ ...newPledgeForm, amount: e.target.value })}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Frequency */}
            <div className="flex flex-col gap-2">
              <Label>Frequency</Label>
              <Select
                value={newPledgeForm.frequency}
                onValueChange={(v) => setNewPledgeForm({ ...newPledgeForm, frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One-time</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Number of Payments (if recurring) */}
            {newPledgeForm.frequency !== "one-time" && (
              <div className="flex flex-col gap-2">
                <Label>Number of Payments</Label>
                <Select
                  value={newPledgeForm.payments}
                  onValueChange={(v) => setNewPledgeForm({ ...newPledgeForm, payments: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 payments</SelectItem>
                    <SelectItem value="6">6 payments</SelectItem>
                    <SelectItem value="12">12 payments</SelectItem>
                    <SelectItem value="24">24 payments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Category */}
            <div className="flex flex-col gap-2">
              <Label>Donation Category</Label>
              <Select
                value={newPledgeForm.category}
                onValueChange={(v) =>
                  setNewPledgeForm({ ...newPledgeForm, category: v, subcategory: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {donationCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategory */}
            {newPledgeForm.category && (
              <div className="flex flex-col gap-2">
                <Label>Specific Fund</Label>
                <Select
                  value={newPledgeForm.subcategory}
                  onValueChange={(v) => setNewPledgeForm({ ...newPledgeForm, subcategory: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fund" />
                  </SelectTrigger>
                  <SelectContent>
                    {donationCategories
                      .find((c) => c.id === newPledgeForm.category)
                      ?.subcategories.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Summary */}
            {newPledgeForm.amount && (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground">Pledge Summary</p>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Pledge:</span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(
                      Number(newPledgeForm.amount) *
                        (newPledgeForm.frequency === "one-time"
                          ? 1
                          : Number(newPledgeForm.payments))
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPledgeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setShowNewPledgeDialog(false)}
              disabled={!newPledgeForm.amount || !newPledgeForm.category}
            >
              Create Pledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
