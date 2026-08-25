"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"

import { QuickAddContactDialog } from "@/components/contacts/quick-add-contact-dialog"
import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields"
import { DonationGroupPicker } from "@/components/donations/donation-group-picker"
import { PaymentHistory } from "@/components/donations/payment-history"
import { PledgeContactPicker } from "@/components/donations/pledge-contact-picker"
import { PledgeReminderActions } from "@/components/donations/pledge-reminder-actions"
import { WishlistItemPicker } from "@/components/donations/wishlist-item-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  convertCampaignProspectToPledgeAction,
  getCampaignProspectForConversionAction,
} from "@/lib/donations/campaign-prospect-actions"
import type { PledgeDisplayStatus } from "@/lib/donations/donation-status"
import {
  createPledgeAction,
  deletePledgeAction,
  getPledgeForEditAction,
  recordPledgePaymentAction,
  updatePledgeAction,
  updatePledgePaymentPlanAction,
} from "@/lib/donations/pledge-admin-actions"
import {
  calculateInstallmentAmount,
  defaultFirstPaymentDate,
  pledgeHasPaymentPlan,
  suggestedPledgePaymentAmount,
  type PledgePlanFrequency,
} from "@/lib/donations/pledge-payment-plan"
import { createClient } from "@/lib/supabase/client"
import { getSelectedOrganizationIdClient } from "@/lib/organizations/get-selected-organization-id-client"
import { cn } from "@/lib/utils"

function getTodayPlainDate() {
  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset() * 60 * 1000
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

type LoadedPledge = Extract<
  Awaited<ReturnType<typeof getPledgeForEditAction>>,
  { success: true }
>["pledge"]

type PaymentRow = {
  id: string
  amount: number | string
  payment_date: string | null
  source: string | null
  memo: string | null
}

export type PledgeDetailsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pledgeId?: string | null
  organizationId?: string | null
  defaultCampaignId?: string | null
  defaultContactId?: string | null
  defaultContactLabel?: string | null
  prospectId?: string | null
  canManage?: boolean
  onSaved?: (pledgeId: string) => void
  onDeleted?: (pledgeId: string) => void
}

export function PledgeDetailsDialog({
  open,
  onOpenChange,
  pledgeId = null,
  organizationId: organizationIdProp = null,
  defaultCampaignId = null,
  defaultContactId = null,
  defaultContactLabel = null,
  prospectId = null,
  canManage = true,
  onSaved,
  onDeleted,
}: PledgeDetailsDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [organizationId, setOrganizationId] = useState<string | null>(organizationIdProp)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [planDirty, setPlanDirty] = useState(false)
  const [suggestedPaymentAmount, setSuggestedPaymentAmount] = useState(0)

  const [activePledgeId, setActivePledgeId] = useState<string | null>(pledgeId)
  const [loaded, setLoaded] = useState<LoadedPledge | null>(null)
  const [campaignName, setCampaignName] = useState("")

  const [contactId, setContactId] = useState("")
  const [contactLabel, setContactLabel] = useState("")
  const [amount, setAmount] = useState("")
  const [pledgeDate, setPledgeDate] = useState(getTodayPlainDate())
  const [frequency, setFrequency] = useState("One-Time")
  const [status, setStatus] = useState<PledgeDisplayStatus>("Open")
  const [notes, setNotes] = useState("")
  const [attribution, setAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  )
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null)

  const [suggestedAskAmount, setSuggestedAskAmount] = useState<number | null>(null)
  const [convertProspectId, setConvertProspectId] = useState<string | null>(null)
  const [showQuickAddContact, setShowQuickAddContact] = useState(false)

  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState(getTodayPlainDate())
  const [paymentSource, setPaymentSource] = useState("check")
  const [paymentMemo, setPaymentMemo] = useState("")
  const [paymentGroupContactId, setPaymentGroupContactId] = useState<string | null>(null)
  const [paymentGroupLabel, setPaymentGroupLabel] = useState("")
  const [payments, setPayments] = useState<PaymentRow[]>([])

  const [planFrequency, setPlanFrequency] = useState("monthly")
  const [planPayments, setPlanPayments] = useState("10")
  const [planInstallment, setPlanInstallment] = useState("")
  const [planFirstDate, setPlanFirstDate] = useState(defaultFirstPaymentDate())

  const isExisting = Boolean(activePledgeId)
  const balanceRemaining = loaded?.balanceRemaining ?? 0
  const canCollect = isExisting && balanceRemaining > 0.009 && canManage

  const resetAddForm = useCallback(() => {
    setActivePledgeId(null)
    setLoaded(null)
    setCampaignName("")
    setContactId(defaultContactId || "")
    setContactLabel(defaultContactLabel || "")
    setAmount("")
    setPledgeDate(getTodayPlainDate())
    setFrequency("One-Time")
    setStatus("Open")
    setNotes("")
    setAttribution({
      ...EMPTY_DONATION_ATTRIBUTION_VALUE,
      campaignId: defaultCampaignId || "",
    })
    setWishlistItemId(null)
    setSuggestedAskAmount(null)
    setConvertProspectId(prospectId)
    setErrorMessage(null)
    setPlanDirty(false)
    setSuggestedPaymentAmount(0)
    setPayments([])
    setPaymentAmount("")
    setPaymentDate(getTodayPlainDate())
    setPaymentSource("check")
    setPaymentMemo("")
    setPaymentGroupContactId(null)
    setPaymentGroupLabel("")
    setPlanFrequency("monthly")
    setPlanPayments("10")
    setPlanInstallment("")
    setPlanFirstDate(defaultFirstPaymentDate())
  }, [defaultCampaignId, defaultContactId, defaultContactLabel, prospectId])

  const applyLoadedPledge = useCallback((pledge: LoadedPledge) => {
    setLoaded(pledge)
    setActivePledgeId(pledge.id)
    setCampaignName(pledge.campaignName || "")
    setContactId(pledge.contactId || "")
    setContactLabel(pledge.donorName || "")
    setAmount(String(pledge.amountPledged || ""))
    setPledgeDate(pledge.pledgeDate || getTodayPlainDate())
    setFrequency(pledge.frequency || "One-Time")
    setStatus(pledge.status)
    setNotes(pledge.notes || "")
    setAttribution({
      campaignId: pledge.campaignId || "",
      categoryId: pledge.categoryId || "",
      subcategoryId: pledge.subcategoryId || "",
    })
    setWishlistItemId(pledge.wishlistItemId || null)
    setConvertProspectId(null)
    setSuggestedAskAmount(null)

    const suggested = suggestedPledgePaymentAmount({
      balance: pledge.balanceRemaining,
      installmentAmount: pledge.installmentAmount,
      frequency: pledge.frequency,
      totalPayments: pledge.totalPayments,
    })
    setSuggestedPaymentAmount(suggested)
    setPaymentAmount("")
    setPaymentDate(getTodayPlainDate())
    setPaymentMemo("")
    setPaymentGroupContactId(null)
    setPaymentGroupLabel("")
    setPlanDirty(false)

    const hasPlan = pledgeHasPaymentPlan({
      frequency: pledge.frequency,
      totalPayments: pledge.totalPayments,
      installmentAmount: pledge.installmentAmount,
    })
    const numberOfPayments = hasPlan ? String(pledge.totalPayments ?? 10) : "10"
    setPlanPayments(numberOfPayments)
    setPlanFrequency(hasPlan ? String(pledge.frequency || "monthly").toLowerCase() : "monthly")
    setPlanFirstDate(pledge.firstPaymentDate || defaultFirstPaymentDate())
    setPlanInstallment(
      hasPlan
        ? String(pledge.installmentAmount ?? "")
        : pledge.amountPledged > 0
          ? String(calculateInstallmentAmount(pledge.amountPledged, Number(numberOfPayments)))
          : ""
    )
  }, [])

  const loadPayments = useCallback(
    async (id: string, orgId: string) => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount, payment_date, source, memo")
        .eq("organization_id", orgId)
        .eq("pledge_id", id)
        .order("payment_date", { ascending: false })
      setPayments((data || []) as PaymentRow[])
    },
    [supabase]
  )

  const loadExisting = useCallback(
    async (id: string) => {
      setLoading(true)
      setErrorMessage(null)
      const result = await getPledgeForEditAction(id)
      if (!result.success) {
        setErrorMessage(result.error)
        setLoading(false)
        return
      }
      setOrganizationId(result.organizationId)
      applyLoadedPledge(result.pledge)
      await loadPayments(id, result.organizationId)
      setLoading(false)
    },
    [applyLoadedPledge, loadPayments]
  )

  useEffect(() => {
    if (!open) return
    setOrganizationId(organizationIdProp)
    if (pledgeId) {
      void loadExisting(pledgeId)
      return
    }
    resetAddForm()
    void (async () => {
      if (organizationIdProp) return
      setOrganizationId(await getSelectedOrganizationIdClient())
    })()
    // Re-initialize only when the window opens or the target pledge changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pledgeId])

  useEffect(() => {
    if (!open || pledgeId || !defaultContactId || contactLabel) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from("contacts")
        .select("full_name, email, phone")
        .eq("id", defaultContactId)
        .maybeSingle()
      if (cancelled || !data) return
      setContactLabel(
        (data.full_name as string | null) ||
          (data.email as string | null) ||
          (data.phone as string | null) ||
          ""
      )
    })()
    return () => {
      cancelled = true
    }
  }, [open, pledgeId, defaultContactId, contactLabel, supabase])

  useEffect(() => {
    if (!open || pledgeId || !prospectId) return
    let cancelled = false
    void (async () => {
      const result = await getCampaignProspectForConversionAction(prospectId)
      if (cancelled || !result.success) return
      setConvertProspectId(result.prospect.id)
      setSuggestedAskAmount(result.prospect.suggested_ask_amount)
      setContactId(result.prospect.contact_id)
      setContactLabel(result.prospect.contactName)
      if (result.prospect.suggested_ask_amount != null) {
        setAmount(String(result.prospect.suggested_ask_amount))
      }
      setAttribution((current) => ({
        ...current,
        campaignId: result.prospect.campaign_id,
      }))
    })()
    return () => {
      cancelled = true
    }
  }, [open, pledgeId, prospectId])

  async function persistPledgeRecord(): Promise<string | null> {
    if (!contactId) {
      setErrorMessage("Please select a contact.")
      return null
    }
    if (!amount || Number(amount) <= 0) {
      setErrorMessage("Please enter a valid amount.")
      return null
    }

    if (!isExisting && convertProspectId) {
      const result = await convertCampaignProspectToPledgeAction({
        prospectId: convertProspectId,
        amountPledged: Number(amount),
        pledgeDate,
        frequency,
        notes: notes || null,
        categoryId: attribution.categoryId || null,
        subcategoryId: attribution.subcategoryId || null,
        wishlistItemId,
      })
      if (!result.success) {
        setErrorMessage(result.error)
        return null
      }
      return result.pledgeId
    }

    if (!isExisting) {
      const result = await createPledgeAction({
        contactId,
        amountPledged: Number(amount),
        pledgeDate,
        frequency,
        notes: notes || null,
        campaignId: attribution.campaignId || null,
        categoryId: attribution.categoryId || null,
        subcategoryId: attribution.subcategoryId || null,
        wishlistItemId,
      })
      if (!result.success) {
        setErrorMessage(result.error)
        return null
      }
      return result.pledgeId
    }

    const result = await updatePledgeAction({
      pledgeId: activePledgeId!,
      amountPledged: Number(amount),
      pledgeDate,
      frequency,
      status,
      campaignId: attribution.campaignId || null,
      categoryId: attribution.categoryId || null,
      subcategoryId: attribution.subcategoryId || null,
      wishlistItemId,
      notes: notes || null,
      contactId,
    })
    if (!result.success) {
      setErrorMessage(result.error)
      return null
    }
    return activePledgeId
  }

  async function handleSave() {
    setSaving(true)
    setErrorMessage(null)

    const savedId = await persistPledgeRecord()
    if (!savedId) {
      setSaving(false)
      return
    }

    const paymentValue = Number(paymentAmount)
    if (paymentValue > 0) {
      const payResult = await recordPledgePaymentAction({
        pledgeId: savedId,
        amount: paymentValue,
        paymentDate,
        source: paymentSource,
        memo: paymentMemo || null,
        attributedGroupContactId: paymentGroupContactId,
      })
      if (!payResult.success) {
        setSaving(false)
        setErrorMessage(payResult.error)
        onSaved?.(savedId)
        await loadExisting(savedId)
        return
      }
    }

    const hasExistingPlan = Boolean(
      loaded &&
        pledgeHasPaymentPlan({
          frequency: loaded.frequency,
          totalPayments: loaded.totalPayments,
          installmentAmount: loaded.installmentAmount,
        })
    )
    if (planDirty || hasExistingPlan) {
      const planResult = await updatePledgePaymentPlanAction({
        pledgeId: savedId,
        installmentAmount: Number(planInstallment || 0),
        numberOfPayments: Number(planPayments || 0),
        frequency: planFrequency as PledgePlanFrequency,
        firstPaymentDate: planFirstDate,
      })
      if (!planResult.success) {
        setSaving(false)
        setErrorMessage(planResult.error)
        onSaved?.(savedId)
        await loadExisting(savedId)
        return
      }
    }

    onOpenChange(false)
    onSaved?.(savedId)
    setSaving(false)
  }

  async function handleDelete() {
    if (!activePledgeId) return
    if (
      !confirm(
        "Delete this pledge? Related payments will stay in Payments but will be unallocated from this pledge."
      )
    ) {
      return
    }
    const result = await deletePledgeAction(activePledgeId)
    if (!result.success) {
      setErrorMessage(result.error)
      return
    }
    onDeleted?.(activePledgeId)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[min(96vw,56rem)] max-w-4xl flex-col gap-0 overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Pledge Details</DialogTitle>
            <DialogDescription>
              {isExisting
                ? "View and manage this pledge, payments, and collection. Save closes this window."
                : convertProspectId
                  ? "Creates one pledge and marks the prospect as Pledged."
                  : "Create a pledge. After you save, this window closes. Open the pledge later to record payments or reminders."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto py-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading pledge...</p>
            ) : (
              <>
                {isExisting ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{status}</Badge>
                    {campaignName ? <Badge variant="outline">{campaignName}</Badge> : null}
                    <Badge variant="outline">{frequency}</Badge>
                  </div>
                ) : null}

                {convertProspectId && suggestedAskAmount != null ? (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    Suggested ask:{" "}
                    <span className="font-medium tabular-nums">
                      {formatDonationCurrency(suggestedAskAmount)}
                    </span>
                  </div>
                ) : null}

                {canManage ? (
                  <PledgeContactPicker
                    organizationId={organizationId}
                    contactId={contactId}
                    contactLabel={contactLabel}
                    onChange={(nextId, label) => {
                      setContactId(nextId)
                      setContactLabel(label)
                    }}
                    disabled={saving}
                    label="Contact"
                  />
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p className="font-medium">{contactLabel || "—"}</p>
                  </div>
                )}

                {!isExisting && canManage && contactLabel.trim() && !contactId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQuickAddContact(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add contact
                  </Button>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="pledge-details-amount">
                      {convertProspectId ? "Actual Pledge Amount" : "Total Amount"}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="pledge-details-amount"
                        type="number"
                        className="pl-7"
                        value={amount}
                        disabled={!canManage}
                        onChange={(event) => setAmount(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="pledge-details-date">Pledge Date</Label>
                    <Input
                      id="pledge-details-date"
                      type="date"
                      value={pledgeDate}
                      disabled={!canManage}
                      onChange={(event) => setPledgeDate(event.target.value)}
                    />
                  </div>
                </div>

                <DonationAttributionFields
                  organizationId={organizationId}
                  value={attribution}
                  disabled={!canManage}
                  onChange={(value) => {
                    setAttribution(value)
                    if (!value.campaignId) setWishlistItemId(null)
                  }}
                />
                <WishlistItemPicker
                  campaignId={attribution.campaignId || null}
                  value={wishlistItemId}
                  disabled={!canManage}
                  onChange={setWishlistItemId}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label>Pledge Type</Label>
                    <Select value={frequency} onValueChange={setFrequency} disabled={!canManage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="One-Time">One-Time</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Quarterly">Quarterly</SelectItem>
                        <SelectItem value="Yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isExisting ? (
                    <div className="flex flex-col gap-2">
                      <Label>Status</Label>
                      <Select
                        value={status}
                        onValueChange={(value) => setStatus(value as PledgeDisplayStatus)}
                        disabled={!canManage}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="Partial">Partial</SelectItem>
                          <SelectItem value="Fulfilled">Fulfilled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="pledge-details-notes">Notes</Label>
                  <Textarea
                    id="pledge-details-notes"
                    rows={2}
                    value={notes}
                    disabled={!canManage}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>

                {isExisting && loaded ? (
                  <>
                    <Separator />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Pledged</p>
                        <p className="text-lg font-semibold tabular-nums">
                          {formatDonationCurrency(loaded.amountPledged)}
                        </p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Collected</p>
                        <p className="text-lg font-semibold tabular-nums text-emerald-600">
                          {formatDonationCurrency(loaded.amountPaid)}
                        </p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p
                          className={cn(
                            "text-lg font-semibold tabular-nums",
                            loaded.balanceRemaining > 0 ? "text-amber-600" : "text-muted-foreground"
                          )}
                        >
                          {formatDonationCurrency(loaded.balanceRemaining)}
                        </p>
                      </div>
                    </div>

                    {canCollect ? (
                      <section className="space-y-3 rounded-lg border p-4">
                        <h3 className="text-sm font-semibold">Receive Payment</h3>
                        <p className="text-xs text-muted-foreground">
                          Enter an amount only if you are recording a payment now.
                          {suggestedPaymentAmount > 0
                            ? ` Suggested: ${formatDonationCurrency(suggestedPaymentAmount)}.`
                            : ""}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="flex flex-col gap-1.5">
                            <Label>Amount</Label>
                            <Input
                              type="number"
                              value={paymentAmount}
                              disabled={saving}
                              onChange={(event) => setPaymentAmount(event.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Date</Label>
                            <Input
                              type="date"
                              value={paymentDate}
                              disabled={saving}
                              onChange={(event) => setPaymentDate(event.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Method</Label>
                            <Select
                              value={paymentSource}
                              onValueChange={setPaymentSource}
                              disabled={saving}
                            >
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
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Memo</Label>
                          <Textarea
                            rows={2}
                            value={paymentMemo}
                            disabled={saving}
                            onChange={(event) => setPaymentMemo(event.target.value)}
                          />
                        </div>
                        <DonationGroupPicker
                          groupContactId={paymentGroupContactId}
                          groupLabel={paymentGroupLabel}
                          memberContactId={contactId || null}
                          onChange={(groupContactId, label) => {
                            setPaymentGroupContactId(groupContactId)
                            setPaymentGroupLabel(label)
                          }}
                          disabled={saving}
                        />
                      </section>
                    ) : null}

                    {canManage && loaded.balanceRemaining > 0.009 ? (
                      <section className="space-y-3 rounded-lg border p-4">
                        <h3 className="text-sm font-semibold">
                          {pledgeHasPaymentPlan({
                            frequency: loaded.frequency,
                            totalPayments: loaded.totalPayments,
                            installmentAmount: loaded.installmentAmount,
                          })
                            ? "Payment Plan"
                            : "Set Up Payment Plan"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Change these fields, then click Save to apply.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <Label>Frequency</Label>
                            <Select
                              value={planFrequency}
                              disabled={saving}
                              onValueChange={(value) => {
                                setPlanFrequency(value)
                                setPlanDirty(true)
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">Quarterly</SelectItem>
                                <SelectItem value="annually">Annually</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Number of payments</Label>
                            <Input
                              type="number"
                              min={2}
                              value={planPayments}
                              disabled={saving}
                              onChange={(event) => {
                                const numberOfPayments = event.target.value
                                setPlanPayments(numberOfPayments)
                                setPlanDirty(true)
                                if (loaded.amountPledged > 0 && Number(numberOfPayments) > 0) {
                                  setPlanInstallment(
                                    String(
                                      calculateInstallmentAmount(
                                        loaded.amountPledged,
                                        Number(numberOfPayments)
                                      )
                                    )
                                  )
                                }
                              }}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Amount per payment</Label>
                            <Input
                              type="number"
                              value={planInstallment}
                              disabled={saving}
                              onChange={(event) => {
                                setPlanInstallment(event.target.value)
                                setPlanDirty(true)
                              }}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>First payment date</Label>
                            <Input
                              type="date"
                              value={planFirstDate}
                              disabled={saving}
                              onChange={(event) => {
                                setPlanFirstDate(event.target.value)
                                setPlanDirty(true)
                              }}
                            />
                          </div>
                        </div>
                      </section>
                    ) : null}

                    {canCollect ? (
                      <section className="space-y-3 rounded-lg border p-4">
                        <h3 className="text-sm font-semibold">Remind / Contact</h3>
                        <PledgeReminderActions
                          pledgeId={activePledgeId!}
                          donorName={loaded.donorName}
                          onUpdated={() => void loadExisting(activePledgeId!)}
                        />
                      </section>
                    ) : null}

                    <PaymentHistory payments={payments} />
                  </>
                ) : null}

                {errorMessage ? (
                  <p className="text-sm text-destructive">{errorMessage}</p>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            {isExisting && canManage ? (
              <Button
                variant="destructive"
                className="mr-auto"
                disabled={saving}
                onClick={() => void handleDelete()}
              >
                Delete Pledge
              </Button>
            ) : null}
            <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {canManage ? (
              <Button onClick={() => void handleSave()} disabled={saving || loading}>
                {saving ? "Saving..." : "Save"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddContactDialog
        open={showQuickAddContact}
        onOpenChange={setShowQuickAddContact}
        searchHint={contactLabel}
        onCreated={(contact) => {
          setContactId(contact.contactId)
          setContactLabel(contact.full_name || contact.email || contact.phone || "")
        }}
      />
    </>
  )
}
