"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, RefreshCw, Users, DollarSign, Pause, MoreHorizontal } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  createRecurringDonationPlanAction,
  getRecurringDashboardAction,
  recordRecurringDonationPaymentAction,
  updateRecurringPlanStatusAction,
} from "@/lib/donations/recurring-donation-actions"
import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  toAttributionIds,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields"
import type { RecurringPlanWithDonor } from "@/lib/donations/recurring-donation-types"
import {
  formatRecurringFrequencyLabel,
  formatRecurringStatusLabel,
} from "@/lib/donations/recurring-donation-types"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value + (value.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function RecurringDonationsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<RecurringPlanWithDonor[]>([])
  const [metrics, setMetrics] = useState({
    activeDonorCount: 0,
    activePlanCount: 0,
    pausedPlanCount: 0,
    cancelledPlanCount: 0,
    monthlyRecurringRevenue: 0,
    annualRecurringRevenue: 0,
    actualRecurringRevenue: 0,
    upcomingThisMonth: 0,
  })
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<RecurringPlanWithDonor | null>(null)
  const [saving, setSaving] = useState(false)

  const [donors, setDonors] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [attribution, setAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  )
  const [donorId, setDonorId] = useState("")
  const [amount, setAmount] = useState("")
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly" | "annually">("monthly")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [paymentSource, setPaymentSource] = useState("cash")

  async function loadData() {
    setLoading(true)
    const result = await getRecurringDashboardAction()
    if (result.success) {
      setMetrics(result.metrics)
      setPlans(result.plans)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    async function loadFormOptions() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle()
      if (!profile?.organization_id) return

      setOrganizationId(profile.organization_id)

      const { data: donorRows } = await supabase
        .from("donors")
        .select("id, full_name, email")
        .eq("organization_id", profile.organization_id)
        .order("full_name")

      setDonors((donorRows || []) as typeof donors)
    }
    loadFormOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredPlans = useMemo(() => {
    if (statusFilter === "all") return plans
    return plans.filter((p) => p.status === statusFilter)
  }, [plans, statusFilter])

  async function handleCreatePlan() {
    if (!donorId) {
      alert("Select a donor")
      return
    }
    if (!amount || Number(amount) <= 0) {
      alert("Enter a valid amount")
      return
    }

    setSaving(true)
    const attributionIds = toAttributionIds(attribution)
    const result = await createRecurringDonationPlanAction({
      donorId,
      campaignId: attributionIds.campaign_id,
      categoryId: attributionIds.category_id,
      subcategoryId: attributionIds.subcategory_id,
      amount: Number(amount),
      frequency,
      startDate,
      notes: notes || null,
    })
    setSaving(false)

    if (!result.success) {
      alert(result.error || "Could not create plan")
      return
    }

    setShowCreateDialog(false)
    setDonorId("")
    setAttribution(EMPTY_DONATION_ATTRIBUTION_VALUE)
    setAmount("")
    setNotes("")
    await loadData()
  }

  async function handleRecordPayment() {
    if (!selectedPlan) return
    setSaving(true)
    const result = await recordRecurringDonationPaymentAction({
      planId: selectedPlan.id,
      source: paymentSource,
    })
    setSaving(false)

    if (!result.success) {
      alert(result.error || "Could not record payment")
      return
    }

    setShowPaymentDialog(false)
    setSelectedPlan(null)
    alert(`Payment recorded. Next payment: ${result.nextPaymentDate}`)
    await loadData()
  }

  async function handleStatusChange(planId: string, status: "active" | "paused" | "cancelled" | "completed") {
    const result = await updateRecurringPlanStatusAction(planId, status)
    if (!result.success) {
      alert(result.error || "Could not update status")
      return
    }
    await loadData()
  }

  return (
    <>
      <Header title="Recurring Donations" />
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Recurring Donation Plans</h2>
            <p className="text-sm text-muted-foreground">
              Ongoing giving commitments — not pledges. Record actual payments manually until
              processor billing is connected.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Plan
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Recurring Donors
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeDonorCount}</div>
              <p className="text-xs text-muted-foreground">{metrics.activePlanCount} active plans</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Recurring Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(metrics.monthlyRecurringRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">Projected from active plans</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Annual Recurring Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(metrics.annualRecurringRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">MRR × 12</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paused / Cancelled
              </CardTitle>
              <Pause className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.pausedPlanCount} / {metrics.cancelledPlanCount}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(metrics.actualRecurringRevenue)} received to date
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donor</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Next Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Loading recurring plans...
                    </TableCell>
                  </TableRow>
                ) : filteredPlans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No recurring donation plans found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.donor_name || "—"}</TableCell>
                      <TableCell>{plan.campaign_name || "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(plan.amount)}</TableCell>
                      <TableCell>{formatRecurringFrequencyLabel(plan.frequency)}</TableCell>
                      <TableCell>{formatDate(plan.start_date)}</TableCell>
                      <TableCell>{formatDate(plan.next_payment_date)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{formatRecurringStatusLabel(plan.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(plan.status === "active" || plan.status === "paused") && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedPlan(plan)
                                  setShowPaymentDialog(true)
                                }}
                              >
                                Record Payment
                              </DropdownMenuItem>
                            )}
                            {plan.status === "active" && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(plan.id, "paused")}
                              >
                                Pause Plan
                              </DropdownMenuItem>
                            )}
                            {plan.status === "paused" && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(plan.id, "active")}
                              >
                                Resume Plan
                              </DropdownMenuItem>
                            )}
                            {(plan.status === "active" || plan.status === "paused") && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(plan.id, "cancelled")}
                              >
                                Cancel Plan
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Recurring Donation Plan</DialogTitle>
            <DialogDescription>
              Create a schedule record. Payments are recorded manually until processor billing is
              added.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label>Donor</Label>
              <Select value={donorId} onValueChange={setDonorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select donor" />
                </SelectTrigger>
                <SelectContent>
                  {donors.map((donor) => (
                    <SelectItem key={donor.id} value={donor.id}>
                      {donor.full_name || donor.email || donor.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
            <DonationAttributionFields
              organizationId={organizationId}
              value={attribution}
              onChange={setAttribution}
            />
            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePlan} disabled={saving}>
              {saving ? "Creating..." : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Recurring Payment</DialogTitle>
            <DialogDescription>
              Creates a canonical payment linked to this plan and advances the next payment date.
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Donor:</span> {selectedPlan.donor_name}
              </p>
              <p>
                <span className="text-muted-foreground">Amount:</span>{" "}
                {formatCurrency(selectedPlan.amount)}
              </p>
              <div className="flex flex-col gap-2">
                <Label>Payment Method</Label>
                <Select value={paymentSource} onValueChange={setPaymentSource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="zelle">Zelle</SelectItem>
                    <SelectItem value="venmo">Venmo</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={saving}>
              {saving ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
