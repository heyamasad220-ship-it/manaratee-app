"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import { QuickAddContactDialog, type QuickAddContactResult } from "@/components/contacts/quick-add-contact-dialog"
import { DonationGroupPicker } from "@/components/donations/donation-group-picker"
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
import { Textarea } from "@/components/ui/textarea"
import { ensureGroupMembershipForDonationAction } from "@/lib/contacts/group-giving-actions"
import {
  campaignPaymentTypeLabel,
  formatDonationCurrency,
  type CampaignPaymentRow,
  type CampaignRecurringPlanRow,
} from "@/lib/donations/campaign-analytics"
import { createRecurringDonationPlanAction } from "@/lib/donations/recurring-donation-actions"
import { DONATION_RECURRING_OPS_PATH } from "@/lib/donations/donation-payment-paths"
import { formatPaymentAllocationStatus } from "@/lib/donations/donation-status"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import {
  lastRecurringDateFromCount,
  paymentCountFromLastRecurringDate,
} from "@/lib/donations/recurring-donation-schedule"
import {
  formatRecurringFrequencyLabel,
  formatRecurringStatusLabel,
  type RecurringFrequency,
} from "@/lib/donations/recurring-donation-types"
import { createClient } from "@/lib/supabase/client"

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
  onDonorClick: (payment: CampaignPaymentRow) => void
  onPledgeClick: (pledgeId: string) => void
  onRecurringDonorClick: (plan: CampaignRecurringPlanRow) => void
  onReload: () => void
}) {
  const supabase = createClient()

  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
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
  const [donationGroupContactId, setDonationGroupContactId] = useState<string | null>(null)
  const [donationGroupLabel, setDonationGroupLabel] = useState("")

  const [planContactId, setPlanContactId] = useState("")
  const [planContactLabel, setPlanContactLabel] = useState("")
  const [planAmount, setPlanAmount] = useState("")
  const [planFrequency, setPlanFrequency] = useState<RecurringFrequency>("monthly")
  const [planStartDate, setPlanStartDate] = useState(todayDateOnly())
  const [planPayments, setPlanPayments] = useState("")
  const [planEndDate, setPlanEndDate] = useState("")
  const [planNotes, setPlanNotes] = useState("")
  const [planAttribution, setPlanAttribution] = useState(lockedCampaignAttribution(campaignId))

  function resetReceiveForm() {
    setDonationContactId("")
    setDonationContactLabel("")
    setDonationAmount("")
    setDonationDate(todayDateOnly())
    setDonationSource("cash")
    setDonationMemo("")
    setDonationAttribution(lockedCampaignAttribution(campaignId))
    setDonationWishlistItemId(null)
    setDonationGroupContactId(null)
    setDonationGroupLabel("")
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
    setPlanAttribution(lockedCampaignAttribution(campaignId))
  }

  function openReceiveDialog() {
    resetReceiveForm()
    setShowReceiveDialog(true)
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
    if (donationGroupContactId && !donationContactId) {
      alert("Select a donor when counting a gift toward a group.")
      return
    }

    setSaving(true)

    if (donationGroupContactId) {
      const groupResult = await ensureGroupMembershipForDonationAction({
        memberContactId: donationContactId,
        groupContactId: donationGroupContactId,
      })
      if (!groupResult.success) {
        setSaving(false)
        alert(groupResult.error)
        return
      }
    }

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
      attributed_group_contact_id: donationGroupContactId,
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Campaign Donations</h2>
          <p className="text-sm text-muted-foreground">
            Actual payments attributed to this campaign (one ledger — no duplicate records).
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openPlanDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Recurring Plan
            </Button>
            <Button onClick={openReceiveDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Receive Donation
            </Button>
          </div>
        ) : null}
      </div>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Donor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Pledge Applied To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No donations for this campaign yet.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
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
                    <TableCell>{campaignPaymentTypeLabel(payment)}</TableCell>
                    <TableCell className="capitalize">{payment.source || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {payment.pledge_id ? (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          title="Open pledge"
                          onClick={() => onPledgeClick(payment.pledge_id!)}
                        >
                          {`${payment.pledge_id.slice(0, 8)}…`}
                        </button>
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Recurring</h2>
          <p className="text-sm text-muted-foreground">
            Monthly and other recurring plans tied to this campaign. Collected installments still
            appear in the ledger above.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={DONATION_RECURRING_OPS_PATH}>All recurring plans</Link>
          </Button>
          {canManage ? (
            <Button size="sm" onClick={openPlanDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Recurring Plan
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
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
              {recurringPlans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No recurring plans on this campaign yet.
                  </TableCell>
                </TableRow>
              ) : (
                recurringPlans.map((plan) => (
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
                setDonationGroupContactId(null)
                setDonationGroupLabel("")
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
            <DonationGroupPicker
              groupContactId={donationGroupContactId}
              groupLabel={donationGroupLabel}
              memberContactId={donationContactId || null}
              onChange={(groupContactId, label) => {
                setDonationGroupContactId(groupContactId)
                setDonationGroupLabel(label)
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
