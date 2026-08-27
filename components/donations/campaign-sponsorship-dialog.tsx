"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Textarea } from "@/components/ui/textarea"
import {
  convertCampaignProspectToSponsorshipAction,
  getCampaignSponsorshipAction,
  listCampaignLinkedEventsAction,
  updateCampaignSponsorshipAction,
  updateCampaignSponsorshipBenefitAction,
} from "@/lib/donations/campaign-sponsorship-actions"
import { listSponsorshipPackagesForCampaignAction } from "@/lib/donations/campaign-sponsorship-package-actions"
import {
  CUSTOM_SPONSORSHIP_PACKAGE_VALUE,
  SPONSORSHIP_BENEFIT_STATUS_LABELS,
  SPONSORSHIP_BENEFIT_STATUSES,
  SPONSORSHIP_PAYMENT_STATUS_LABELS,
  SPONSORSHIP_PAYMENT_STATUSES,
  SPONSORSHIP_STATUS_LABELS,
  SPONSORSHIP_STATUSES,
  SPONSORSHIP_TYPE_LABELS,
  SPONSORSHIP_TYPES,
  formatCampaignEventOptionLabel,
  formatSponsorshipBenefitLabel,
  formatSponsorshipPackageOptionLabel,
  type CampaignLinkedEventOption,
  type CampaignSponsorshipBenefitRow,
  type SponsorshipBenefitStatus,
  type SponsorshipPackageRow,
  type SponsorshipPaymentStatus,
  type SponsorshipStatus,
  type SponsorshipType,
} from "@/lib/donations/campaign-sponsorship-types"
import { donationCampaignWorkspaceHref } from "@/lib/donations/campaign-workspace-paths"

type Prefill = {
  contactId: string
  contactName: string
  eventId: string | null
  packageId: string | null
  amount: number | null
  notes: string | null
}

type CampaignSponsorshipDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
  canManage: boolean
  sponsorshipId?: string | null
  prospectId?: string | null
  prefill?: Prefill | null
  onSaved: () => void
}

export function CampaignSponsorshipDialog({
  open,
  onOpenChange,
  campaignId,
  canManage,
  sponsorshipId = null,
  prospectId = null,
  prefill = null,
  onSaved,
}: CampaignSponsorshipDialogProps) {
  const [contactName, setContactName] = useState("")
  const [eventId, setEventId] = useState("")
  const [packageId, setPackageId] = useState(CUSTOM_SPONSORSHIP_PACKAGE_VALUE)
  const [sponsorshipType, setSponsorshipType] = useState<SponsorshipType>("cash")
  const [committedAmount, setCommittedAmount] = useState("")
  const [cashAmount, setCashAmount] = useState("")
  const [inKindValue, setInKindValue] = useState("")
  const [status, setStatus] = useState<SponsorshipStatus>("committed")
  const [paymentStatus, setPaymentStatus] = useState<SponsorshipPaymentStatus>("unpaid")
  const [committedDate, setCommittedDate] = useState("")
  const [notes, setNotes] = useState("")
  const [events, setEvents] = useState<CampaignLinkedEventOption[]>([])
  const [packages, setPackages] = useState<SponsorshipPackageRow[]>([])
  const [benefits, setBenefits] = useState<CampaignSponsorshipBenefitRow[]>([])
  const [linkedProspectId, setLinkedProspectId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const isEditing = Boolean(sponsorshipId)

  useEffect(() => {
    if (!open) return
    void listCampaignLinkedEventsAction(campaignId).then((result) => {
      if (result.success) setEvents(result.events)
    })
  }, [open, campaignId])

  useEffect(() => {
    if (!open) return
    void listSponsorshipPackagesForCampaignAction(campaignId, { activeOnly: false }).then(
      (result) => {
        if (result.success) setPackages(result.packages)
      }
    )
  }, [open, campaignId])

  useEffect(() => {
    if (!open) return

    if (sponsorshipId) {
      setLoading(true)
      void getCampaignSponsorshipAction(sponsorshipId).then((result) => {
        setLoading(false)
        if (!result.success) {
          alert(result.error)
          return
        }
        const row = result.sponsorship
        setContactName(row.contactName)
        setEventId(row.event_id || "")
        setPackageId(row.sponsorship_package_id || CUSTOM_SPONSORSHIP_PACKAGE_VALUE)
        setSponsorshipType(row.sponsorship_type)
        setCommittedAmount(String(row.committed_amount || ""))
        setCashAmount(String(row.cash_amount || ""))
        setInKindValue(String(row.in_kind_value || ""))
        setStatus(row.status)
        setPaymentStatus(row.payment_status)
        setCommittedDate(row.committed_date || "")
        setNotes(row.notes || "")
        setLinkedProspectId(row.prospectId || row.prospect_id)
        setBenefits(result.benefits || [])
      })
      return
    }

    setContactName(prefill?.contactName || "")
    setEventId(prefill?.eventId || "")
    setPackageId(prefill?.packageId || CUSTOM_SPONSORSHIP_PACKAGE_VALUE)
    setSponsorshipType("cash")
    setCommittedAmount(prefill?.amount != null ? String(prefill.amount) : "")
    setCashAmount(prefill?.amount != null ? String(prefill.amount) : "")
    setInKindValue("")
    setStatus("committed")
    setPaymentStatus("unpaid")
    setCommittedDate(new Date().toISOString().slice(0, 10))
    setNotes(prefill?.notes || "")
    setLinkedProspectId(prospectId)
    setBenefits([])
  }, [open, sponsorshipId, prefill, prospectId])

  const selectedPackage = useMemo(
    () => packages.find((row) => row.id === packageId) || null,
    [packages, packageId]
  )

  const completedBenefits = benefits.filter((benefit) => benefit.status === "completed").length

  async function handleBenefitStatus(benefitId: string, status: SponsorshipBenefitStatus) {
    const result = await updateCampaignSponsorshipBenefitAction(benefitId, { status })
    if (!result.success) {
      alert(result.error)
      return
    }
    setBenefits((current) =>
      current.map((benefit) => (benefit.id === benefitId ? result.benefit : benefit))
    )
  }

  async function handleSave() {
    const amount = Number(committedAmount)
    if (!(amount > 0)) {
      alert("Enter a valid sponsorship amount")
      return
    }

    setSaving(true)
    const payload = {
      committedAmount: amount,
      sponsorshipType,
      cashAmount: cashAmount ? Number(cashAmount) : sponsorshipType === "in_kind" ? 0 : amount,
      inKindValue: inKindValue ? Number(inKindValue) : sponsorshipType === "in_kind" ? amount : 0,
      eventId: eventId || null,
      sponsorshipPackageId:
        packageId === CUSTOM_SPONSORSHIP_PACKAGE_VALUE ? null : packageId || null,
      status,
      paymentStatus,
      committedDate: committedDate || null,
      notes: notes.trim() || null,
    }

    const result = isEditing
      ? await updateCampaignSponsorshipAction(sponsorshipId as string, {
          event_id: payload.eventId,
          sponsorship_package_id: payload.sponsorshipPackageId,
          sponsorship_type: sponsorshipType,
          committed_amount: payload.committedAmount,
          cash_amount: payload.cashAmount,
          in_kind_value: payload.inKindValue,
          status,
          payment_status: paymentStatus,
          committed_date: payload.committedDate,
          notes: payload.notes,
        })
      : prospectId
        ? await convertCampaignProspectToSponsorshipAction({
            prospectId,
            ...payload,
          })
        : ({ success: false as const, error: "Prospect is required" } as const)

    setSaving(false)
    if (!result.success) {
      alert(result.error)
      return
    }

    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Sponsorship" : "Create Sponsorship"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Committed sponsor record for this campaign. Outreach stays on Prospects."
              : "Creates a sponsorship from this prospect. The contact and campaign stay linked."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading sponsorship…</p>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1">
              <Label>Sponsor</Label>
              <p className="text-sm font-medium">{contactName || "—"}</p>
              {isEditing && linkedProspectId ? (
                <Button variant="link" className="h-auto justify-start px-0" asChild>
                  <Link
                    href={donationCampaignWorkspaceHref(campaignId, {
                      tab: "plan",
                      section: "prospects",
                      askType: "sponsorship",
                    })}
                  >
                    View Original Prospect
                  </Link>
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Related Event</Label>
              <Select
                value={eventId || "__none__"}
                onValueChange={(value) => setEventId(value === "__none__" ? "" : value)}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No event</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {formatCampaignEventOptionLabel(event)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Sponsorship Package</Label>
              <Select
                value={packageId}
                onValueChange={(value) => {
                  setPackageId(value)
                  const pkg = packages.find((row) => row.id === value)
                  if (pkg) {
                    setCommittedAmount(String(pkg.amount))
                    if (sponsorshipType !== "in_kind") setCashAmount(String(pkg.amount))
                    if (pkg.event_id) setEventId(pkg.event_id)
                  }
                }}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CUSTOM_SPONSORSHIP_PACKAGE_VALUE}>
                    Custom / Undecided
                  </SelectItem>
                  {packages
                    .filter((pkg) => pkg.active || pkg.id === packageId)
                    .map((pkg) => {
                    const eventName = pkg.event_id
                      ? events.find((event) => event.id === pkg.event_id)?.name
                      : null
                    return (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {formatSponsorshipPackageOptionLabel(pkg)}
                        {eventName ? ` · ${eventName}` : ""}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {selectedPackage?.description ? (
                <p className="text-xs text-muted-foreground">{selectedPackage.description}</p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select
                  value={sponsorshipType}
                  onValueChange={(value: SponsorshipType) => setSponsorshipType(value)}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPONSORSHIP_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SPONSORSHIP_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="committed-amount">Committed Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="committed-amount"
                    type="number"
                    className="pl-7"
                    value={committedAmount}
                    disabled={!canManage}
                    onChange={(event) => setCommittedAmount(event.target.value)}
                  />
                </div>
              </div>
            </div>

            {sponsorshipType !== "cash" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cash-amount">Cash Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="cash-amount"
                      type="number"
                      className="pl-7"
                      value={cashAmount}
                      disabled={!canManage}
                      onChange={(event) => setCashAmount(event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="in-kind-value">In-Kind Value</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="in-kind-value"
                      type="number"
                      className="pl-7"
                      value={inKindValue}
                      disabled={!canManage}
                      onChange={(event) => setInKindValue(event.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(value: SponsorshipStatus) => setStatus(value)}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPONSORSHIP_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SPONSORSHIP_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Payment</Label>
                <Select
                  value={paymentStatus}
                  onValueChange={(value: SponsorshipPaymentStatus) => setPaymentStatus(value)}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPONSORSHIP_PAYMENT_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SPONSORSHIP_PAYMENT_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="committed-date">Committed Date</Label>
              <Input
                id="committed-date"
                type="date"
                value={committedDate}
                disabled={!canManage}
                onChange={(event) => setCommittedDate(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sponsorship-notes">Notes</Label>
              <Textarea
                id="sponsorship-notes"
                rows={3}
                value={notes}
                disabled={!canManage}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            {isEditing && benefits.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div>
                  <Label>Benefit Fulfillment</Label>
                  <p className="text-xs text-muted-foreground">
                    {completedBenefits} / {benefits.length} completed
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {benefits.map((benefit) => (
                    <div
                      key={benefit.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
                    >
                      <Checkbox
                        checked={benefit.status === "completed"}
                        disabled={!canManage}
                        onCheckedChange={(checked) =>
                          void handleBenefitStatus(
                            benefit.id,
                            checked === true ? "completed" : "pending"
                          )
                        }
                        aria-label={`Mark ${benefit.name} complete`}
                      />
                      <p className="min-w-0 flex-1 text-sm">
                        {formatSponsorshipBenefitLabel(benefit)}
                      </p>
                      <Select
                        value={benefit.status}
                        onValueChange={(value: SponsorshipBenefitStatus) =>
                          void handleBenefitStatus(benefit.id, value)
                        }
                        disabled={!canManage}
                      >
                        <SelectTrigger className="h-8 w-[8.5rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SPONSORSHIP_BENEFIT_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {SPONSORSHIP_BENEFIT_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {canManage ? "Cancel" : "Close"}
          </Button>
          {canManage ? (
            <Button onClick={() => void handleSave()} disabled={saving || loading}>
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Sponsorship"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
