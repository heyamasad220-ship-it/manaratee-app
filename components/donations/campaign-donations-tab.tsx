"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, ArrowUpDown, CreditCard, Landmark, Plus, Store } from "lucide-react"

import { QuickAddContactDialog, type QuickAddContactResult } from "@/components/contacts/quick-add-contact-dialog"
import { CampaignGroupPicker } from "@/components/donations/campaign-group-picker"
import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  toAttributionIds,
} from "@/components/donations/donation-attribution-fields"
import { PledgeContactPicker } from "@/components/donations/pledge-contact-picker"
import { WishlistItemPicker } from "@/components/donations/wishlist-item-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  TableColumnHeaderFilter,
  TableColumnHeaderSort,
} from "@/components/ui/table-column-header-filter"
import { Label } from "@/components/ui/label"
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
import { ListPagination } from "@/components/ui/list-pagination"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { Textarea } from "@/components/ui/textarea"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import {
  anonymousBulkSenderName,
  campaignPaymentMethodKey,
  campaignTransactionKind,
  campaignTransactionKindLabel,
  computeCampaignPaymentMethodTotals,
  formatDonationCurrency,
  type CampaignPaymentMethodKey,
  type CampaignPaymentRow,
  type CampaignRecurringPlanRow,
} from "@/lib/donations/campaign-analytics"
import { formatPaymentSourceLabel } from "@/lib/donations/payment-source-channel"
import { createRecurringDonationPlanAction } from "@/lib/donations/recurring-donation-actions"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import { DONATION_RECURRING_OPS_PATH } from "@/lib/donations/donation-payment-paths"
import { formatPaymentAllocationStatus } from "@/lib/donations/donation-status"
import {
  lastRecurringDateFromCount,
  paymentCountFromLastRecurringDate,
} from "@/lib/donations/recurring-donation-schedule"
import {
  formatRecurringFrequencyLabel,
  formatRecurringStatusLabel,
  type RecurringFrequency,
} from "@/lib/donations/recurring-donation-types"
import { fetchOpenPledgesForAllocationAction } from "@/lib/donations/donation-list-actions"
import { allocatePaymentToOpenPledgeAction } from "@/lib/donations/payment-admin-actions"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function formatShortDate(value: string | null | undefined) {
  if (!value) return "—"
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
  const date = dateOnly ? new Date(`${dateOnly}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

type DonationSortKey = "none" | "donor_asc" | "donor_desc" | "amount_asc" | "amount_desc"
type DonationListView = "all" | "one-time" | "recurring"
type PaymentMethodFilter = "all" | CampaignPaymentMethodKey
type PledgePaymentFilter = "all" | "pledge" | "not_pledge"

const PAYMENT_METHOD_CARDS: Array<{
  key: CampaignPaymentMethodKey
  label: string
  icon: typeof CreditCard
  tone: "blue" | "violet" | "emerald"
}> = [
  { key: "stripe", label: "Stripe", icon: CreditCard, tone: "blue" },
  { key: "zelle", label: "Zelle", icon: Landmark, tone: "violet" },
  { key: "square", label: "Square", icon: Store, tone: "emerald" },
]

function lockedCampaignAttribution(campaignId: string) {
  return {
    ...EMPTY_DONATION_ATTRIBUTION_VALUE,
    campaignId,
  }
}

export function CampaignDonationsTab({
  campaignId,
  organizationId,
  payments,
  recurringPlans,
  openPledgeDonorIds,
  openPledgeContactIds,
  canManage,
  mode = "donations",
  onDonorClick,
  onPledgeClick,
  onRecurringDonorClick,
  onReload,
}: {
  campaignId: string
  organizationId: string
  payments: CampaignPaymentRow[]
  recurringPlans: CampaignRecurringPlanRow[]
  openPledgeDonorIds: Set<string>
  openPledgeContactIds: Set<string>
  canManage: boolean
  mode?: "donations" | "transactions"
  onDonorClick: (payment: CampaignPaymentRow) => void
  onPledgeClick: (pledgeId: string) => void
  onRecurringDonorClick: (plan: CampaignRecurringPlanRow) => void
  onReload: () => void
}) {
  const supabase = createClient()

  const [applyPayment, setApplyPayment] = useState<CampaignPaymentRow | null>(null)
  const [applyPledgeId, setApplyPledgeId] = useState("")
  const [applyPledges, setApplyPledges] = useState<
    Array<{
      id: string
      campaign_id?: string | null
      campaign_name: string | null
      balance_remaining: number | null
    }>
  >([])
  const [applyLoading, setApplyLoading] = useState(false)
  const [applySaving, setApplySaving] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [bulkSource, setBulkSource] = useState<"cash" | "square">("square")
  const [bulkAmount, setBulkAmount] = useState("")
  const [bulkDate, setBulkDate] = useState(todayDateOnly())
  const [bulkMemo, setBulkMemo] = useState("")
  const [showPlanDialog, setShowPlanDialog] = useState(false)
  const [showQuickAddContact, setShowQuickAddContact] = useState(false)
  const [quickAddTarget, setQuickAddTarget] = useState<"donation" | "plan">("donation")
  const [contactQuery, setContactQuery] = useState("")
  const [saving, setSaving] = useState(false)

  const [donationContactId, setDonationContactId] = useState("")
  const [donationContactLabel, setDonationContactLabel] = useState("")
  const [donationAmount, setDonationAmount] = useState("")
  const [donationDate, setDonationDate] = useState(todayDateOnly())
  const [donationSource, setDonationSource] = useState("cash")
  const [donationMemo, setDonationMemo] = useState("")
  const [donationAttribution, setDonationAttribution] = useState(lockedCampaignAttribution(campaignId))
  const [donationWishlistItemId, setDonationWishlistItemId] = useState<string | null>(null)
  const [donationCampaignGroupId, setDonationCampaignGroupId] = useState<string | null>(null)
  const [donationCampaignGroupLabel, setDonationCampaignGroupLabel] = useState("")

  const [planContactId, setPlanContactId] = useState("")
  const [planContactLabel, setPlanContactLabel] = useState("")
  const [planAmount, setPlanAmount] = useState("")
  const [planFrequency, setPlanFrequency] = useState<RecurringFrequency>("monthly")
  const [planStartDate, setPlanStartDate] = useState(todayDateOnly())
  const [planPayments, setPlanPayments] = useState("")
  const [planEndDate, setPlanEndDate] = useState("")
  const [planNotes, setPlanNotes] = useState("")
  const [planCampaignGroupId, setPlanCampaignGroupId] = useState<string | null>(null)
  const [planCampaignGroupLabel, setPlanCampaignGroupLabel] = useState("")
  const [planAttribution, setPlanAttribution] = useState(lockedCampaignAttribution(campaignId))
  const [donorNameQuery, setDonorNameQuery] = useState("")
  const [sortKey, setSortKey] = useState<DonationSortKey>("none")
  const [methodFilter, setMethodFilter] = useState<PaymentMethodFilter>("all")
  const [pledgeFilter, setPledgeFilter] = useState<PledgePaymentFilter>("all")
  const [listView, setListView] = useState<DonationListView>("one-time")
  const paymentView: DonationListView = mode === "transactions" ? "all" : listView
  const [page, setPage] = useState(1)
  const [recurringPage, setRecurringPage] = useState(1)

  function resetReceiveForm() {
    setDonationContactId("")
    setDonationContactLabel("")
    setDonationAmount("")
    setDonationDate(todayDateOnly())
    setDonationSource("cash")
    setDonationMemo("")
    setDonationAttribution(lockedCampaignAttribution(campaignId))
    setDonationWishlistItemId(null)
    setDonationCampaignGroupId(null)
    setDonationCampaignGroupLabel("")
  }

  function resetPlanForm() {
    setPlanContactId("")
    setPlanContactLabel("")
    setPlanAmount("")
    setPlanFrequency("monthly")
    setPlanStartDate(todayDateOnly())
    setPlanPayments("")
    setPlanEndDate("")
    setPlanNotes("")
    setPlanCampaignGroupId(null)
    setPlanCampaignGroupLabel("")
    setPlanAttribution(lockedCampaignAttribution(campaignId))
  }

  function openReceiveDialog() {
    resetReceiveForm()
    setShowReceiveDialog(true)
  }

  function openBulkDialog() {
    setBulkSource("square")
    setBulkAmount("")
    setBulkDate(todayDateOnly())
    setBulkMemo("")
    setShowBulkDialog(true)
  }

  async function handleBulkEntry() {
    if (!bulkAmount || Number(bulkAmount) <= 0) {
      alert("Please enter a valid amount.")
      return
    }

    setSaving(true)
    const { error } = await supabase.from("payments").insert({
      organization_id: organizationId,
      donor_id: null,
      contact_id: null,
      campaign_group_id: null,
      pledge_id: null,
      sender_name: anonymousBulkSenderName(bulkSource),
      amount: Number(bulkAmount),
      payment_date: bulkDate ? `${bulkDate}T12:00:00` : new Date().toISOString(),
      source: bulkSource,
      source_type: "manual",
      memo: bulkMemo.trim() || null,
      status: "unallocated",
      is_verified: false,
      campaign_id: campaignId,
      wishlist_item_id: null,
    })
    setSaving(false)

    if (error) {
      alert(error.message)
      return
    }

    setShowBulkDialog(false)
    onReload()
  }

  function openPlanDialog() {
    resetPlanForm()
    setShowPlanDialog(true)
  }

  function applyPlanInstallmentCount(value: string) {
    setPlanPayments(value)
    const count = Number(value)
    if (planStartDate && Number.isInteger(count) && count >= 2) {
      const last = lastRecurringDateFromCount(planStartDate, planFrequency, count)
      if (last) setPlanEndDate(last)
    }
  }

  function applyPlanEndDate(value: string) {
    setPlanEndDate(value)
    if (planStartDate && value) {
      const count = paymentCountFromLastRecurringDate(planStartDate, planFrequency, value)
      setPlanPayments(count >= 2 ? String(count) : "")
    }
  }

  function applyPlanStartDate(value: string) {
    setPlanStartDate(value)
    const count = Number(planPayments)
    if (value && Number.isInteger(count) && count >= 2) {
      const last = lastRecurringDateFromCount(value, planFrequency, count)
      if (last) setPlanEndDate(last)
    } else if (value && planEndDate) {
      const nextCount = paymentCountFromLastRecurringDate(value, planFrequency, planEndDate)
      setPlanPayments(nextCount >= 2 ? String(nextCount) : "")
    }
  }

  function applyPlanFrequency(value: RecurringFrequency) {
    setPlanFrequency(value)
    const count = Number(planPayments)
    if (planStartDate && Number.isInteger(count) && count >= 2) {
      const last = lastRecurringDateFromCount(planStartDate, value, count)
      if (last) setPlanEndDate(last)
    } else if (planStartDate && planEndDate) {
      const nextCount = paymentCountFromLastRecurringDate(planStartDate, value, planEndDate)
      setPlanPayments(nextCount >= 2 ? String(nextCount) : "")
    }
  }

  function handleQuickAddCreated(contact: QuickAddContactResult) {
    const label = contact.full_name || contact.email || "New contact"
    if (quickAddTarget === "plan") {
      setPlanContactId(contact.contactId)
      setPlanContactLabel(label)
    } else {
      setDonationContactId(contact.contactId)
      setDonationContactLabel(label)
    }
    setShowQuickAddContact(false)
  }

  async function handleReceiveDonation() {
    if (!donationContactId) {
      alert("Select a donor.")
      return
    }
    if (!donationAmount || Number(donationAmount) <= 0) {
      alert("Please enter a valid amount.")
      return
    }

    setSaving(true)

    const resolvedDonorId = await ensureDonorExtensionForContact(organizationId, donationContactId)
    if (!resolvedDonorId) {
      setSaving(false)
      alert("Could not resolve a donor record for the selected contact.")
      return
    }

    const { error } = await supabase.from("payments").insert({
      organization_id: organizationId,
      donor_id: resolvedDonorId,
      contact_id: donationContactId,
      campaign_group_id: donationCampaignGroupId,
      pledge_id: null,
      sender_name: donationContactLabel || null,
      amount: Number(donationAmount),
      payment_date: donationDate ? `${donationDate}T12:00:00` : new Date().toISOString(),
      source: donationSource,
      source_type: "manual",
      memo: donationMemo || null,
      status: "unallocated",
      is_verified: false,
      ...toAttributionIds({
        ...donationAttribution,
        campaignId,
      }),
      campaign_id: campaignId,
      wishlist_item_id: donationWishlistItemId,
    })

    setSaving(false)

    if (error) {
      alert(error.message)
      return
    }

    try {
      const { handleDonationAffiliationSync } = await import(
        "@/lib/contacts/contact-affiliation-sync"
      )
      await handleDonationAffiliationSync({
        organizationId,
        donorId: resolvedDonorId,
        contactId: donationContactId,
      })
    } catch (syncError) {
      console.warn("Donation affiliation sync failed:", syncError)
    }

    resetReceiveForm()
    setShowReceiveDialog(false)
    onReload()
  }

  async function handleCreatePlan() {
    if (!planContactId) {
      alert("Select a donor.")
      return
    }
    if (!planAmount || Number(planAmount) <= 0) {
      alert("Enter a valid amount.")
      return
    }

    setSaving(true)
    const resolvedDonorId = await ensureDonorExtensionForContact(organizationId, planContactId)
    if (!resolvedDonorId) {
      setSaving(false)
      alert("Could not resolve a donor record for the selected contact.")
      return
    }

    const attributionIds = toAttributionIds({
      ...planAttribution,
      campaignId,
    })
    const result = await createRecurringDonationPlanAction({
      donorId: resolvedDonorId,
      contactId: planContactId,
      campaignId,
      categoryId: attributionIds.category_id,
      subcategoryId: attributionIds.subcategory_id,
      amount: Number(planAmount),
      frequency: planFrequency,
      startDate: planStartDate,
      numberOfPayments: planPayments ? Number(planPayments) : null,
      endDate: planEndDate || null,
      notes: planNotes || null,
      campaignGroupId: planCampaignGroupId,
    })
    setSaving(false)

    if (!result.success) {
      alert(result.error || "Could not create plan")
      return
    }

    resetPlanForm()
    setShowPlanDialog(false)
    onReload()
  }

  const methodTotals = useMemo(
    () => (mode === "transactions" ? computeCampaignPaymentMethodTotals(payments) : null),
    [mode, payments]
  )

  const donationPayments = useMemo(() => {
    const gifts =
      paymentView === "all"
        ? payments
        : payments.filter((payment) => campaignTransactionKind(payment) === "one_time")
    const query = donorNameQuery.trim().toLowerCase()
    const matched = gifts.filter((payment) => {
      if (query && !(payment.sender_name || "").toLowerCase().includes(query)) return false
      if (paymentView === "all" && methodFilter !== "all") {
        if (campaignPaymentMethodKey(payment.source) !== methodFilter) return false
      }
      if (paymentView === "all" && pledgeFilter === "pledge" && !payment.pledge_id) return false
      if (paymentView === "all" && pledgeFilter === "not_pledge" && payment.pledge_id) return false
      return true
    })
    if (sortKey === "none") return matched
    return [...matched].sort((left, right) => {
      if (sortKey === "donor_asc" || sortKey === "donor_desc") {
        const byName = (left.sender_name || "").localeCompare(right.sender_name || "", undefined, {
          sensitivity: "base",
        })
        return sortKey === "donor_asc" ? byName : -byName
      }
      const byAmount = Number(left.amount || 0) - Number(right.amount || 0)
      return sortKey === "amount_asc" ? byAmount : -byAmount
    })
  }, [donorNameQuery, methodFilter, paymentView, payments, pledgeFilter, sortKey])

  useEffect(() => {
    setPage(1)
  }, [donorNameQuery, methodFilter, paymentView, pledgeFilter, sortKey])

  const donationPageCount = Math.max(1, Math.ceil(donationPayments.length / DONATIONS_PAGE_SIZE))
  const donationPage = Math.min(page, donationPageCount)
  const pagedDonationPayments = donationPayments.slice(
    (donationPage - 1) * DONATIONS_PAGE_SIZE,
    donationPage * DONATIONS_PAGE_SIZE
  )
  const recurringPageCount = Math.max(1, Math.ceil(recurringPlans.length / DONATIONS_PAGE_SIZE))
  const recurringCurrentPage = Math.min(recurringPage, recurringPageCount)
  const pagedRecurringPlans = recurringPlans.slice(
    (recurringCurrentPage - 1) * DONATIONS_PAGE_SIZE,
    recurringCurrentPage * DONATIONS_PAGE_SIZE
  )

  async function openApplyDialog(payment: CampaignPaymentRow) {
    setApplyPayment(payment)
    setApplyPledgeId("")
    setApplyError(null)
    setApplyLoading(true)
    const result = await fetchOpenPledgesForAllocationAction(payment.donor_id)
    setApplyLoading(false)
    if (!result.success) {
      setApplyError(result.error)
      setApplyPledges([])
      return
    }
    const pledges = [...(result.pledges || [])].sort((a, b) => {
      const aHere = a.campaign_id === campaignId ? 0 : 1
      const bHere = b.campaign_id === campaignId ? 0 : 1
      return aHere - bHere
    })
    setApplyPledges(pledges)
  }

  function closeApplyDialog() {
    setApplyPayment(null)
    setApplyPledgeId("")
    setApplyPledges([])
    setApplyError(null)
    setApplySaving(false)
  }

  async function handleApplyPledge() {
    if (!applyPayment) return
    if (!applyPledgeId) {
      setApplyError("Choose a pledge.")
      return
    }
    setApplySaving(true)
    setApplyError(null)
    const result = await allocatePaymentToOpenPledgeAction({
      paymentId: applyPayment.id,
      pledgeId: applyPledgeId,
    })
    setApplySaving(false)
    if (!result.success) {
      setApplyError(result.error)
      return
    }
    closeApplyDialog()
    onReload()
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {mode === "donations" ? (
          <nav aria-label="Donation lists" className="flex gap-1 border-b border-border">
            {(
              [
                ["one-time", "One-Time"],
                ["recurring", "Recurring"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                  listView === value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setListView(value)}
              >
                {label}
              </button>
            ))}
          </nav>
          ) : null}
          <p className={cn("text-sm text-muted-foreground", mode === "donations" && "mt-3")}>
            {paymentView === "all"
              ? "Every payment on this campaign: one-time donations, recurring donations, and pledges."
              : paymentView === "one-time"
                ? "One-time gifts only. Apply one to a pledge and it leaves this list."
                : "Monthly and other recurring plans tied to this campaign."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {listView === "recurring" ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={DONATION_RECURRING_OPS_PATH}>All recurring plans</Link>
            </Button>
          ) : null}
          {canManage && listView === "recurring" ? (
            <Button size="sm" onClick={openPlanDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Recurring Plan
            </Button>
          ) : null}
          {canManage && listView === "one-time" ? (
            <>
              <Button variant="outline" onClick={openBulkDialog}>
                Bulk entry
              </Button>
              <Button onClick={openReceiveDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Receive Donation
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {methodTotals ? (
        <StatCardsRow equal columns={3} className="shrink-0 gap-3">
          {PAYMENT_METHOD_CARDS.map((card) => {
            const selected = methodFilter === card.key
            const totals = methodTotals[card.key]
            const countLabel = `${totals.count.toLocaleString()} payment${totals.count === 1 ? "" : "s"}`
            return (
              <button
                key={card.key}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "block h-full w-full cursor-pointer rounded-xl border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "ring-2 ring-primary"
                )}
                onClick={() =>
                  setMethodFilter((current) => (current === card.key ? "all" : card.key))
                }
              >
                <StatCard
                  layout="compact"
                  fill
                  className="h-full"
                  tone={card.tone}
                  icon={card.icon}
                  label={card.label}
                  value={formatDonationCurrency(totals.amount)}
                  hint={selected ? `${countLabel} · click to show all` : countLabel}
                  valueClassName="text-xl"
                />
              </button>
            )
          })}
        </StatCardsRow>
      ) : null}

      {paymentView !== "recurring" ? (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Card className="min-h-0 flex-1 gap-0 overflow-hidden border border-border py-0 shadow-sm">
        <CardContent className="h-full min-h-0 p-0">
          <Table containerClassName="h-full overflow-auto">
            <TableHeader className="sticky top-0 z-10 bg-card [&_th]:bg-card">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>
                  <TableColumnHeaderFilter
                    label="Donor"
                    active={Boolean(donorNameQuery.trim())}
                    trailing={
                      <TableColumnHeaderSort
                        label="Donor"
                        value={sortKey.startsWith("donor_") ? sortKey : "donor_asc"}
                        active={sortKey.startsWith("donor_")}
                        options={[
                          { value: "donor_asc", label: "A to Z" },
                          { value: "donor_desc", label: "Z to A" },
                        ]}
                        onChange={(value) => setSortKey(value as DonationSortKey)}
                      />
                    }
                  >
                    <Input
                      placeholder="Search by name"
                      value={donorNameQuery}
                      onChange={(event) => setDonorNameQuery(event.target.value)}
                      aria-label="Search donations by donor name"
                    />
                  </TableColumnHeaderFilter>
                </TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="font-medium">Amount</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 shrink-0",
                        sortKey.startsWith("amount_") &&
                          "rounded-full bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                      )}
                      aria-label={
                        sortKey === "amount_desc"
                          ? "Sort amount lowest first"
                          : "Sort amount highest first"
                      }
                      onClick={() =>
                        setSortKey((current) =>
                          current === "amount_desc" ? "amount_asc" : "amount_desc"
                        )
                      }
                    >
                      {sortKey === "amount_asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : sortKey === "amount_desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>
                  {paymentView === "all" ? (
                    <TableColumnHeaderFilter
                      label="Payment Method"
                      active={methodFilter !== "all"}
                    >
                      {({ close }) => (
                        <Select
                          value={methodFilter}
                          onValueChange={(value) => {
                            setMethodFilter(value as PaymentMethodFilter)
                            close()
                          }}
                        >
                          <SelectTrigger aria-label="Filter by payment method">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All methods</SelectItem>
                            <SelectItem value="stripe">Stripe</SelectItem>
                            <SelectItem value="zelle">Zelle</SelectItem>
                            <SelectItem value="square">Square</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableColumnHeaderFilter>
                  ) : (
                    "Payment Method"
                  )}
                </TableHead>
                <TableHead>
                  {paymentView === "all" ? (
                    <TableColumnHeaderFilter label="Pledge" active={pledgeFilter !== "all"}>
                      {({ close }) => (
                        <Select
                          value={pledgeFilter}
                          onValueChange={(value) => {
                            setPledgeFilter(value as PledgePaymentFilter)
                            close()
                          }}
                        >
                          <SelectTrigger aria-label="Filter by pledge">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All transactions</SelectItem>
                            <SelectItem value="pledge">Pledge payments</SelectItem>
                            <SelectItem value="not_pledge">Not a pledge</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableColumnHeaderFilter>
                  ) : (
                    "Pledge"
                  )}
                </TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedDonationPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {paymentView === "all" &&
                    (donorNameQuery.trim() || methodFilter !== "all" || pledgeFilter !== "all")
                      ? "No transactions match those filters."
                      : donorNameQuery.trim()
                        ? "No donations match that donor."
                        : paymentView === "all"
                          ? "No transactions on this campaign yet."
                          : "No one-time donations yet."}
                  </TableCell>
                </TableRow>
              ) : (
                pagedDonationPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatShortDate(payment.payment_date)}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => onDonorClick(payment)}
                      >
                        {payment.sender_name || "Donor"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(Number(payment.amount || 0))}
                    </TableCell>
                    <TableCell>{campaignTransactionKindLabel(payment)}</TableCell>
                    <TableCell>{payment.source ? formatPaymentSourceLabel(payment.source) : "—"}</TableCell>
                    <TableCell>
                      {payment.pledge_id ? (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0"
                          onClick={() => onPledgeClick(payment.pledge_id as string)}
                        >
                          Pledge
                        </Button>
                      ) : canManage &&
                        campaignTransactionKind(payment) === "one_time" &&
                        ((payment.donor_id && openPledgeDonorIds.has(payment.donor_id)) ||
                          (payment.contact_id && openPledgeContactIds.has(payment.contact_id))) ? (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0"
                          onClick={() => void openApplyDialog(payment)}
                        >
                          Apply to pledge
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      {formatPaymentAllocationStatus({
                        status: payment.status,
                        pledgeId: payment.pledge_id,
                        donorHasOpenPledge: Boolean(
                          (payment.donor_id && openPledgeDonorIds.has(payment.donor_id)) ||
                            (payment.contact_id && openPledgeContactIds.has(payment.contact_id))
                        ),
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ListPagination
        page={donationPage}
        pageSize={DONATIONS_PAGE_SIZE}
        total={donationPayments.length}
        onPageChange={setPage}
        hidePageSize
        entryLabel={paymentView === "all" ? "transactions" : "donations"}
      />
      </div>
      ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Card className="min-h-0 flex-1 gap-0 overflow-hidden border border-border py-0 shadow-sm">
        <CardContent className="h-full min-h-0 p-0">
          <Table containerClassName="h-full overflow-auto">
            <TableHeader className="sticky top-0 z-10 bg-card [&_th]:bg-card">
              <TableRow>
                <TableHead>Donor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Next payment</TableHead>
                <TableHead>Payments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRecurringPlans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No recurring plans on this campaign yet.
                  </TableCell>
                </TableRow>
              ) : (
                pagedRecurringPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => onRecurringDonorClick(plan)}
                      >
                        {plan.donor_name}
                      </button>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(plan.amount)}
                    </TableCell>
                    <TableCell>{formatRecurringFrequencyLabel(plan.frequency)}</TableCell>
                    <TableCell>{formatRecurringStatusLabel(plan.status)}</TableCell>
                    <TableCell>{formatShortDate(plan.start_date)}</TableCell>
                    <TableCell>{formatShortDate(plan.next_payment_date)}</TableCell>
                    <TableCell>
                      {plan.payments_made != null
                        ? plan.total_payments != null
                          ? `${plan.payments_made} / ${plan.total_payments}`
                          : String(plan.payments_made)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ListPagination
        page={recurringCurrentPage}
        pageSize={DONATIONS_PAGE_SIZE}
        total={recurringPlans.length}
        onPageChange={setRecurringPage}
        hidePageSize
        entryLabel="plans"
      />
      </div>
      )}

      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk entry</DialogTitle>
            <DialogDescription>
              One total for cash counted with no names, or Square taps with no customer. It stays in
              collected and raised, and it is not a donor.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label>Method</Label>
              <Select
                value={bulkSource}
                onValueChange={(value) => setBulkSource(value as "cash" | "square")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="campaign-bulk-amount">Amount</Label>
                <Input
                  id="campaign-bulk-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={bulkAmount}
                  onChange={(event) => setBulkAmount(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="campaign-bulk-date">Date</Label>
                <Input
                  id="campaign-bulk-date"
                  type="date"
                  value={bulkDate}
                  onChange={(event) => setBulkDate(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-bulk-memo">Note</Label>
              <Textarea
                id="campaign-bulk-memo"
                rows={2}
                value={bulkMemo}
                onChange={(event) => setBulkMemo(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleBulkEntry()} disabled={saving}>
              {saving ? "Saving..." : "Save bulk entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showReceiveDialog}
        onOpenChange={(open) => {
          setShowReceiveDialog(open)
          if (!open) resetReceiveForm()
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
          onInteractOutside={(event) => {
            if (showQuickAddContact) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (showQuickAddContact) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Receive Donation</DialogTitle>
            <DialogDescription>
              Record a one-time gift on this campaign. Same payment ledger as Fund Development →
              Donations.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <PledgeContactPicker
              organizationId={organizationId}
              contactId={donationContactId}
              contactLabel={donationContactLabel}
              onChange={(contactId, label) => {
                setDonationContactId(contactId)
                setDonationContactLabel(label)
                setDonationCampaignGroupId(null)
                setDonationCampaignGroupLabel("")
              }}
              label="Donor"
              inputId="campaign-donation-donor"
              placeholder="Search donor name, email, or phone"
              onQueryChange={setContactQuery}
              onCreateClick={() => {
                setQuickAddTarget("donation")
                setShowQuickAddContact(true)
              }}
              disabled={saving}
            />
            <CampaignGroupPicker
              campaignId={campaignId}
              groupId={donationCampaignGroupId}
              groupLabel={donationCampaignGroupLabel}
              onChange={(nextGroupId, label) => {
                setDonationCampaignGroupId(nextGroupId)
                setDonationCampaignGroupLabel(label)
              }}
              disabled={saving}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="campaign-donation-amount">Amount</Label>
                <Input
                  id="campaign-donation-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={donationAmount}
                  onChange={(event) => setDonationAmount(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="campaign-donation-date">Payment Date</Label>
                <Input
                  id="campaign-donation-date"
                  type="date"
                  value={donationDate}
                  onChange={(event) => setDonationDate(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Method</Label>
              <Select value={donationSource} onValueChange={setDonationSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DonationAttributionFields
              organizationId={organizationId}
              value={donationAttribution}
              onChange={(value) =>
                setDonationAttribution({
                  ...value,
                  campaignId,
                })
              }
              showCampaign={false}
            />
            <WishlistItemPicker
              campaignId={campaignId}
              value={donationWishlistItemId}
              onChange={setDonationWishlistItemId}
              disabled={saving}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-donation-memo">Memo</Label>
              <Textarea
                id="campaign-donation-memo"
                value={donationMemo}
                onChange={(event) => setDonationMemo(event.target.value)}
                placeholder="Optional note"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetReceiveForm()
                setShowReceiveDialog(false)
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleReceiveDonation()} disabled={saving}>
              {saving ? "Saving..." : "Save Donation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPlanDialog}
        onOpenChange={(open) => {
          setShowPlanDialog(open)
          if (!open) resetPlanForm()
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
          onInteractOutside={(event) => {
            if (showQuickAddContact) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (showQuickAddContact) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>New Recurring Donation Plan</DialogTitle>
            <DialogDescription>
              Create a schedule on this campaign. Enter the number of installments or an end date.
              Payments are recorded manually until processor billing is added.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <PledgeContactPicker
              organizationId={organizationId}
              contactId={planContactId}
              contactLabel={planContactLabel}
              onChange={(contactId, label) => {
                setPlanContactId(contactId)
                setPlanContactLabel(label)
              }}
              label="Donor"
              inputId="campaign-plan-donor"
              placeholder="Search donor name, email, or phone"
              onQueryChange={setContactQuery}
              onCreateClick={() => {
                setQuickAddTarget("plan")
                setShowQuickAddContact(true)
              }}
              disabled={saving}
            />
            <CampaignGroupPicker
              campaignId={campaignId}
              groupId={planCampaignGroupId}
              groupLabel={planCampaignGroupLabel}
              onChange={(nextGroupId, label) => {
                setPlanCampaignGroupId(nextGroupId)
                setPlanCampaignGroupLabel(label)
              }}
              disabled={saving}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="campaign-plan-amount">Amount</Label>
                <Input
                  id="campaign-plan-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={planAmount}
                  onChange={(event) => setPlanAmount(event.target.value)}
                  placeholder="50"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Frequency</Label>
                <Select
                  value={planFrequency}
                  onValueChange={(value) => applyPlanFrequency(value as RecurringFrequency)}
                >
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
                <Label htmlFor="campaign-plan-start">Start Date</Label>
                <Input
                  id="campaign-plan-start"
                  type="date"
                  value={planStartDate}
                  onChange={(event) => applyPlanStartDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="campaign-plan-installments">Number of installments</Label>
                <Input
                  id="campaign-plan-installments"
                  type="number"
                  min={2}
                  placeholder="e.g. 12"
                  value={planPayments}
                  onChange={(event) => applyPlanInstallmentCount(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="campaign-plan-end">End date</Label>
                <Input
                  id="campaign-plan-end"
                  type="date"
                  value={planEndDate}
                  onChange={(event) => applyPlanEndDate(event.target.value)}
                />
              </div>
            </div>
            <DonationAttributionFields
              organizationId={organizationId}
              value={planAttribution}
              onChange={(value) =>
                setPlanAttribution({
                  ...value,
                  campaignId,
                })
              }
              showCampaign={false}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-plan-notes">Notes</Label>
              <Textarea
                id="campaign-plan-notes"
                value={planNotes}
                onChange={(event) => setPlanNotes(event.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetPlanForm()
                setShowPlanDialog(false)
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleCreatePlan()} disabled={saving}>
              {saving ? "Creating..." : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(applyPayment)}
        onOpenChange={(open) => {
          if (!open) closeApplyDialog()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply to pledge</DialogTitle>
            <DialogDescription>
              This gift leaves Donations and is collected on the pledge you choose.
            </DialogDescription>
          </DialogHeader>
          {applyPayment ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {applyPayment.sender_name || "Donor"} ·{" "}
                {formatDonationCurrency(Number(applyPayment.amount || 0))}
              </p>
              {applyLoading ? (
                <p className="text-sm text-muted-foreground">Loading open pledges...</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="campaign-apply-pledge">Open pledge</Label>
                  <Select value={applyPledgeId} onValueChange={setApplyPledgeId}>
                    <SelectTrigger id="campaign-apply-pledge">
                      <SelectValue placeholder="Choose a pledge" />
                    </SelectTrigger>
                    <SelectContent>
                      {applyPledges.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No open pledges for this donor
                        </SelectItem>
                      ) : (
                        applyPledges.map((pledge) => (
                          <SelectItem key={pledge.id} value={pledge.id}>
                            {pledge.campaign_name || "No campaign"} — Balance{" "}
                            {formatDonationCurrency(Number(pledge.balance_remaining || 0))}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {applyError ? <p className="text-sm text-destructive">{applyError}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeApplyDialog} disabled={applySaving}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleApplyPledge()}
              disabled={applySaving || applyLoading || applyPledges.length === 0}
            >
              {applySaving ? "Applying..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddContactDialog
        open={showQuickAddContact}
        onOpenChange={setShowQuickAddContact}
        searchHint={contactQuery}
        onCreated={handleQuickAddCreated}
        description="Create a person or organization, then continue receiving this gift or plan."
      />
    </div>
  )
}
