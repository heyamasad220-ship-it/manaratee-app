"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
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
import {
  Plus,
  RefreshCw,
  Users,
  DollarSign,
  Pause,
  MoreHorizontal,
  TrendingUp,
} from "lucide-react"
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
import { getDonorProfilePath } from "@/lib/donations/donor-profile-path"
import { TableColumnHeaderFilter, TableColumnHeaderSort } from "@/components/ui/table-column-header-filter"

const TABLE_COLSPAN = 11

const AMOUNT_SORT_OPTIONS = [
  { value: "amount_desc", label: "Highest first" },
  { value: "amount_asc", label: "Lowest first" },
] as const

const PLAN_START_SORT_OPTIONS = [
  { value: "start_desc", label: "Newest first" },
  { value: "start_asc", label: "Oldest first" },
] as const

const PLAN_END_SORT_OPTIONS = [
  { value: "end_desc", label: "Newest first" },
  { value: "end_asc", label: "Oldest first" },
] as const

type RecurringSortKey =
  | "default"
  | (typeof AMOUNT_SORT_OPTIONS)[number]["value"]
  | (typeof PLAN_START_SORT_OPTIONS)[number]["value"]
  | (typeof PLAN_END_SORT_OPTIONS)[number]["value"]

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

function formatCategoryFund(plan: RecurringPlanWithDonor) {
  if (plan.category_name && plan.fund_name) {
    return `${plan.category_name} / ${plan.fund_name}`
  }
  return plan.category_name || plan.fund_name || "—"
}

function formatPaymentsMade(plan: RecurringPlanWithDonor) {
  if (plan.payments_made != null) return String(plan.payments_made)
  if (plan.linked_payment_count > 0) return String(plan.linked_payment_count)
  return "—"
}

function formatCount(value: number | null) {
  return value == null ? "—" : String(value)
}

function isImportedRecurringPlan(plan: RecurringPlanWithDonor) {
  if (plan.external_processor === "square") return true
  const notes = String(plan.notes || "")
  return (
    notes.includes("MADINA_SQUARE_RECURRING_PLANS_V1") ||
    notes.includes("Imported from Square") ||
    notes.includes("Inferred recurring from Square")
  )
}

function formatNextPaymentDate(plan: RecurringPlanWithDonor) {
  if (isImportedRecurringPlan(plan)) return "—"
  return formatDate(plan.next_payment_date)
}

function getRecurringStatusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
    case "paused":
      return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50"
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700 hover:bg-red-50"
    case "completed":
      return "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100"
    case "past_due":
      return "border-red-300 bg-red-100 text-red-800 hover:bg-red-100"
    case "pending_setup":
      return "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50"
    default:
      return "border-border bg-muted text-muted-foreground hover:bg-muted"
  }
}

function dateSortValue(value: string | null) {
  if (!value) return null
  return new Date(value.includes("T") ? value : `${value}T00:00:00`).getTime()
}

function compareDateValues(
  left: string | null,
  right: string | null,
  direction: "asc" | "desc"
) {
  const leftValue = dateSortValue(left)
  const rightValue = dateSortValue(right)

  if (leftValue == null && rightValue == null) return 0
  if (leftValue == null) return 1
  if (rightValue == null) return -1

  return direction === "asc" ? leftValue - rightValue : rightValue - leftValue
}

function sortValueForColumn(sortKey: RecurringSortKey, prefix: string, fallback: string) {
  return sortKey.startsWith(prefix) ? sortKey : fallback
}

export function DonationRecurringPanel({ embedded = false }: { embedded?: boolean }) {
  const supabase = createClient()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
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
  const [statusFilter, setStatusFilter] = useState("active")
  const [categoryFundFilter, setCategoryFundFilter] = useState("all")
  const [frequencyFilter, setFrequencyFilter] = useState("all")
  const [sortKey, setSortKey] = useState<RecurringSortKey>("default")
  const [donorNameFilterInput, setDonorNameFilterInput] = useState("")
  const [donorNameFilter, setDonorNameFilter] = useState("")
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
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "quarterly" | "annually">("monthly")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [paymentSource, setPaymentSource] = useState("cash")

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    const result = await getRecurringDashboardAction()
    if (result.success) {
      setMetrics(result.metrics)
      setPlans(result.plans)
    } else {
      setLoadError(result.error || "Could not load recurring donation plans")
      setPlans([])
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDonorNameFilter(donorNameFilterInput.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [donorNameFilterInput])

  const categoryFundOptions = useMemo(() => {
    const values = new Set<string>()
    for (const plan of plans) {
      const label = formatCategoryFund(plan)
      if (label !== "—") values.add(label)
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [plans])

  const frequencyOptions = useMemo(() => {
    const order = ["daily", "weekly", "monthly", "quarterly", "annually"]
    const values = new Set(plans.map((plan) => plan.frequency))
    return Array.from(values).sort(
      (a, b) => order.indexOf(a) - order.indexOf(b) || a.localeCompare(b)
    )
  }, [plans])

  const displayedPlans = useMemo(() => {
    let result = plans

    if (statusFilter !== "all") {
      result = result.filter((plan) => plan.status === statusFilter)
    }

    if (categoryFundFilter !== "all") {
      result = result.filter((plan) => formatCategoryFund(plan) === categoryFundFilter)
    }

    if (frequencyFilter !== "all") {
      result = result.filter((plan) => plan.frequency === frequencyFilter)
    }

    if (donorNameFilter) {
      const query = donorNameFilter.toLowerCase()
      result = result.filter(
        (plan) =>
          (plan.donor_name || "").toLowerCase().includes(query) ||
          (plan.donor_email || "").toLowerCase().includes(query)
      )
    }

    const sorted = [...result]

    switch (sortKey) {
      case "amount_asc":
        sorted.sort((a, b) => a.amount - b.amount)
        break
      case "amount_desc":
        sorted.sort((a, b) => b.amount - a.amount)
        break
      case "start_asc":
        sorted.sort((a, b) => compareDateValues(a.start_date, b.start_date, "asc"))
        break
      case "start_desc":
        sorted.sort((a, b) => compareDateValues(a.start_date, b.start_date, "desc"))
        break
      case "end_asc":
        sorted.sort((a, b) => compareDateValues(a.end_date, b.end_date, "asc"))
        break
      case "end_desc":
        sorted.sort((a, b) => compareDateValues(a.end_date, b.end_date, "desc"))
        break
      default:
        break
    }

    return sorted
  }, [plans, statusFilter, categoryFundFilter, frequencyFilter, donorNameFilter, sortKey])

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
      {!embedded ? <Header title="Recurring Donations" /> : null}
      <div className={embedded ? "space-y-6" : "space-y-6 p-6"}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Recurring Donation Plans</h2>
            <p className="text-sm text-muted-foreground">
              Ongoing giving commitments — not pledges. Stripe-linked plans bill automatically;
              manual plans can still record payments here.
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

        <DonationMetricCardGrid colorful columns={4}>
          <DonationMetricCard
            title="Active Recurring Donors"
            value={metrics.activeDonorCount}
            icon={Users}
            accent="emerald"
            description={`${metrics.activePlanCount} active plans`}
          />
          <DonationMetricCard
            title="Monthly Recurring Revenue"
            value={formatCurrency(metrics.monthlyRecurringRevenue)}
            icon={DollarSign}
            accent="blue"
            description="Projected from active plans"
          />
          <DonationMetricCard
            title="Annual Recurring Revenue"
            value={formatCurrency(metrics.annualRecurringRevenue)}
            icon={TrendingUp}
            accent="purple"
            description="MRR × 12"
          />
          <DonationMetricCard
            title="Paused / Cancelled"
            value={`${metrics.pausedPlanCount} / ${metrics.cancelledPlanCount}`}
            icon={Pause}
            accent="amber"
            description={`${formatCurrency(metrics.actualRecurringRevenue)} received to date`}
          />
        </DonationMetricCardGrid>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : null}

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Donor"
                      active={Boolean(donorNameFilter)}
                    >
                      {({ close }) => (
                        <Input
                          placeholder="Search by donor name or email"
                          value={donorNameFilterInput}
                          onChange={(event) => setDonorNameFilterInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              setDonorNameFilter(donorNameFilterInput.trim())
                              close()
                            }
                          }}
                        />
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Category / Fund"
                      active={categoryFundFilter !== "all"}
                    >
                      {({ close }) => (
                        <Select
                          value={categoryFundFilter}
                          onValueChange={(value) => {
                            setCategoryFundFilter(value)
                            close()
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All categories</SelectItem>
                            {categoryFundOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-medium">Amount</span>
                      <TableColumnHeaderSort
                        label="Amount"
                        value={sortValueForColumn(sortKey, "amount_", "amount_desc")}
                        active={sortKey.startsWith("amount_")}
                        options={[...AMOUNT_SORT_OPTIONS]}
                        onChange={(value) => setSortKey(value as RecurringSortKey)}
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Frequency"
                      active={frequencyFilter !== "all"}
                    >
                      {({ close }) => (
                        <Select
                          value={frequencyFilter}
                          onValueChange={(value) => {
                            setFrequencyFilter(value)
                            close()
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All frequencies</SelectItem>
                            {frequencyOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {formatRecurringFrequencyLabel(option)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Plan Start</span>
                      <TableColumnHeaderSort
                        label="Plan Start"
                        value={sortValueForColumn(sortKey, "start_", "start_desc")}
                        active={sortKey.startsWith("start_")}
                        options={[...PLAN_START_SORT_OPTIONS]}
                        onChange={(value) => setSortKey(value as RecurringSortKey)}
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Plan End</span>
                      <TableColumnHeaderSort
                        label="Plan End"
                        value={sortValueForColumn(sortKey, "end_", "end_desc")}
                        active={sortKey.startsWith("end_")}
                        options={[...PLAN_END_SORT_OPTIONS]}
                        onChange={(value) => setSortKey(value as RecurringSortKey)}
                      />
                    </div>
                  </TableHead>
                  <TableHead>Next Payment</TableHead>
                  <TableHead className="text-right">Total Payments</TableHead>
                  <TableHead className="text-right">Payments Made</TableHead>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Status"
                      active={statusFilter !== "active"}
                    >
                      {({ close }) => (
                        <Select
                          value={statusFilter}
                          onValueChange={(value) => {
                            setStatusFilter(value)
                            close()
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={TABLE_COLSPAN} className="py-8 text-center text-muted-foreground">
                      Loading recurring plans...
                    </TableCell>
                  </TableRow>
                ) : displayedPlans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={TABLE_COLSPAN} className="py-8 text-center text-muted-foreground">
                      No recurring donation plans found.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">
                        {plan.donor_name ? (
                          <Link
                            href={getDonorProfilePath(
                              plan.donor_id,
                              null,
                              plan.contact_id,
                              pathname
                            )}
                            className="text-primary hover:underline"
                          >
                            {plan.donor_name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {formatCategoryFund(plan)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(plan.amount)}</TableCell>
                      <TableCell>{formatRecurringFrequencyLabel(plan.frequency)}</TableCell>
                      <TableCell>{formatDate(plan.start_date)}</TableCell>
                      <TableCell>{formatDate(plan.end_date)}</TableCell>
                      <TableCell>{formatNextPaymentDate(plan)}</TableCell>
                      <TableCell className="text-right">
                        {formatCount(plan.total_payments)}
                      </TableCell>
                      <TableCell className="text-right">{formatPaymentsMade(plan)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getRecurringStatusBadgeClass(plan.status)}
                        >
                          {formatRecurringStatusLabel(plan.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(plan.status === "active" ||
                              plan.status === "paused" ||
                              plan.status === "past_due") && (
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
                            {(plan.status === "active" ||
                              plan.status === "paused" ||
                              plan.status === "past_due") && (
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
                    <SelectItem value="daily">Daily</SelectItem>
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
