"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  toAttributionIds,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields"
import { DonationGroupPicker } from "@/components/donations/donation-group-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea"
import { ensureGroupMembershipForDonationAction } from "@/lib/contacts/group-giving-actions"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import { getDonorPledgesAction } from "@/lib/donations/pledge-reminder-actions"
import { recordPledgePaymentAction } from "@/lib/donations/pledge-admin-actions"
import { recordRecurringDonationPaymentAction } from "@/lib/donations/recurring-donation-actions"
import { formatRecurringFrequencyLabel } from "@/lib/donations/recurring-donation-types"
import { getSelectedOrganizationIdClient } from "@/lib/organizations/get-selected-organization-id-client"

const APPLY_ONE_TIME = "__one_time__"
const APPLY_PLEDGE_PREFIX = "pledge:"
const APPLY_PLAN_PREFIX = "plan:"

type OpenPledgeOption = {
  id: string
  campaignName: string | null
  balanceRemaining: number
}

type OpenPlanOption = {
  id: string
  campaignName: string | null
  amount: number
  frequency: string
  status: string
}

type ContactReceivePaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName: string
  organizationId?: string | null
  onSuccess?: () => void
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function applyToValue(kind: "pledge" | "plan", id: string) {
  return kind === "pledge" ? `${APPLY_PLEDGE_PREFIX}${id}` : `${APPLY_PLAN_PREFIX}${id}`
}

function parseApplyTo(value: string): { kind: "one_time" } | { kind: "pledge" | "plan"; id: string } {
  if (value === APPLY_ONE_TIME) return { kind: "one_time" }
  if (value.startsWith(APPLY_PLEDGE_PREFIX)) {
    return { kind: "pledge", id: value.slice(APPLY_PLEDGE_PREFIX.length) }
  }
  if (value.startsWith(APPLY_PLAN_PREFIX)) {
    return { kind: "plan", id: value.slice(APPLY_PLAN_PREFIX.length) }
  }
  return { kind: "one_time" }
}

export function ContactReceivePaymentDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  organizationId: organizationIdProp,
  onSuccess,
}: ContactReceivePaymentDialogProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(organizationIdProp ?? null)
  const [amount, setAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState("")
  const [source, setSource] = useState("cash")
  const [memo, setMemo] = useState("")
  const [attribution, setAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  )
  const [groupContactId, setGroupContactId] = useState<string | null>(null)
  const [groupLabel, setGroupLabel] = useState("")
  const [applyTo, setApplyTo] = useState(APPLY_ONE_TIME)
  const [openPledges, setOpenPledges] = useState<OpenPledgeOption[]>([])
  const [openPlans, setOpenPlans] = useState<OpenPlanOption[]>([])
  const [loadingTargets, setLoadingTargets] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount("")
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setSource("cash")
    setMemo("")
    setAttribution(EMPTY_DONATION_ATTRIBUTION_VALUE)
    setGroupContactId(null)
    setGroupLabel("")
    setApplyTo(APPLY_ONE_TIME)
    setOpenPledges([])
    setOpenPlans([])

    void (async () => {
      const orgId = organizationIdProp || (await getSelectedOrganizationIdClient())
      setOrganizationId(orgId)
      if (!orgId) return

      setLoadingTargets(true)
      try {
        const donorId = await ensureDonorExtensionForContact(orgId, contactId)
        if (!donorId) {
          setOpenPledges([])
          setOpenPlans([])
          return
        }

        const [pledgesResult, plansResult] = await Promise.all([
          getDonorPledgesAction(donorId),
          supabase
            .from("recurring_donation_plans")
            .select("id, amount, frequency, status, campaigns(name)")
            .eq("organization_id", orgId)
            .eq("donor_id", donorId)
            .in("status", ["active", "paused", "past_due"])
            .order("next_payment_date", { ascending: true }),
        ])

        setOpenPledges(
          pledgesResult.success
            ? pledgesResult.pledges
                .filter(
                  (pledge) =>
                    pledge.balanceRemaining > 0 &&
                    String(pledge.status || "").toLowerCase() !== "cancelled"
                )
                .map((pledge) => ({
                  id: pledge.id,
                  campaignName: pledge.campaignName,
                  balanceRemaining: pledge.balanceRemaining,
                }))
            : []
        )

        if (plansResult.error) {
          setOpenPlans([])
        } else {
          setOpenPlans(
            (plansResult.data || []).map((plan: any) => ({
              id: plan.id as string,
              campaignName: (plan.campaigns?.name as string | null) ?? null,
              amount: Number(plan.amount || 0),
              frequency: String(plan.frequency || ""),
              status: String(plan.status || ""),
            }))
          )
        }
      } finally {
        setLoadingTargets(false)
      }
    })()
  }, [open, organizationIdProp, contactId])

  useEffect(() => {
    const target = parseApplyTo(applyTo)
    if (target.kind === "pledge") {
      const pledge = openPledges.find((row) => row.id === target.id)
      if (pledge) setAmount(String(pledge.balanceRemaining))
      return
    }
    if (target.kind === "plan") {
      const plan = openPlans.find((row) => row.id === target.id)
      if (plan) setAmount(String(plan.amount))
    }
  }, [applyTo, openPledges, openPlans])

  async function handleSave() {
    const orgId = organizationId || (await getSelectedOrganizationIdClient())
    if (!orgId) {
      alert("No organization found for this admin user.")
      return
    }

    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount.")
      return
    }

    setSaving(true)

    if (groupContactId) {
      const groupResult = await ensureGroupMembershipForDonationAction({
        memberContactId: contactId,
        groupContactId,
      })
      if (!groupResult.success) {
        setSaving(false)
        alert(groupResult.error)
        return
      }
    }

    const donorId = await ensureDonorExtensionForContact(orgId, contactId)
    if (!donorId) {
      setSaving(false)
      alert("Could not resolve a donor record for this contact.")
      return
    }

    const target = parseApplyTo(applyTo)

    if (target.kind === "pledge") {
      const result = await recordPledgePaymentAction({
        pledgeId: target.id,
        amount: Number(amount),
        paymentDate,
        source,
        memo: memo || null,
        attributedGroupContactId: groupContactId,
      })

      setSaving(false)

      if (!result.success) {
        alert(result.error)
        return
      }

      onOpenChange(false)
      onSuccess?.()
      return
    }

    if (target.kind === "plan") {
      const result = await recordRecurringDonationPaymentAction({
        planId: target.id,
        amount: Number(amount),
        paymentDate,
        source,
        memo: memo || undefined,
        attributedGroupContactId: groupContactId,
      })

      setSaving(false)

      if (!result.success) {
        alert(result.error)
        return
      }

      onOpenChange(false)
      onSuccess?.()
      return
    }

    const { error } = await supabase.from("payments").insert({
      organization_id: orgId,
      donor_id: donorId,
      contact_id: contactId,
      attributed_group_contact_id: groupContactId,
      pledge_id: null,
      sender_name: contactName || null,
      amount: Number(amount),
      payment_date: paymentDate ? `${paymentDate}T12:00:00` : new Date().toISOString(),
      source,
      source_type: "manual",
      memo: memo || null,
      status: "unallocated",
      is_verified: false,
      ...toAttributionIds(attribution),
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
        donorId,
        contactId,
      })
    } catch (syncError) {
      console.warn("Donation affiliation sync failed:", syncError)
    }

    onOpenChange(false)
    onSuccess?.()
  }

  const applyingToTarget = applyTo !== APPLY_ONE_TIME

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive Payment</DialogTitle>
          <p className="text-base font-medium text-foreground">{contactName || "Unnamed"}</p>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="receive-payment-apply-to">Apply to</Label>
            <Select value={applyTo} onValueChange={setApplyTo} disabled={loadingTargets || saving}>
              <SelectTrigger id="receive-payment-apply-to">
                <SelectValue placeholder={loadingTargets ? "Loading..." : "Select target"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={APPLY_ONE_TIME}>One-time donation</SelectItem>
                {openPledges.map((pledge) => (
                  <SelectItem key={pledge.id} value={applyToValue("pledge", pledge.id)}>
                    Pledge: {pledge.campaignName || "Campaign"} (
                    {formatCurrency(pledge.balanceRemaining)} due)
                  </SelectItem>
                ))}
                {openPlans.map((plan) => (
                  <SelectItem key={plan.id} value={applyToValue("plan", plan.id)}>
                    Plan: {plan.campaignName || "Payment plan"} — {formatCurrency(plan.amount)}{" "}
                    {formatRecurringFrequencyLabel(plan.frequency).toLowerCase()}
                    {plan.status === "past_due" ? " (past due)" : plan.status === "paused" ? " (paused)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Program fees and failed/missed payment make-ups can be added here as those modules are
              wired up.
            </p>
          </div>

          <DonationGroupPicker
            groupContactId={groupContactId}
            groupLabel={groupLabel}
            memberContactId={contactId}
            onChange={(nextGroupId, label) => {
              setGroupContactId(nextGroupId)
              setGroupLabel(label)
            }}
            disabled={saving}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Method</Label>
            <Select value={source} onValueChange={setSource}>
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

          {!applyingToTarget ? (
            <DonationAttributionFields
              organizationId={organizationId}
              value={attribution}
              onChange={setAttribution}
            />
          ) : null}

          <div className="flex flex-col gap-2">
            <Label>Memo</Label>
            <Textarea
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="Optional note"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
