"use client"

import { useEffect, useState } from "react"

import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields"
import { WishlistItemPicker } from "@/components/donations/wishlist-item-picker"
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
import { Textarea } from "@/components/ui/textarea"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  convertCampaignProspectToPledgeAction,
  getCampaignProspectForConversionAction,
} from "@/lib/donations/campaign-prospect-actions"
import type { CampaignProspectListItem } from "@/lib/donations/campaign-prospect-types"

function getTodayPlainDate() {
  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset() * 60 * 1000
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

type CampaignProspectRecordPledgeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prospectId: string | null
  organizationId: string
  onConverted: (result: {
    pledgeId: string
    amountPledged: number
    suggestedAskAmount: number | null
  }) => void
}

export function CampaignProspectRecordPledgeDialog({
  open,
  onOpenChange,
  prospectId,
  organizationId,
  onConverted,
}: CampaignProspectRecordPledgeDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [prospect, setProspect] = useState<CampaignProspectListItem | null>(null)
  const [campaignName, setCampaignName] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [pledgeDate, setPledgeDate] = useState(getTodayPlainDate())
  const [frequency, setFrequency] = useState("One-Time")
  const [notes, setNotes] = useState("")
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null)
  const [attribution, setAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  )

  useEffect(() => {
    if (!open || !prospectId) return

    let cancelled = false
    setLoading(true)
    setErrorMessage(null)

    void (async () => {
      const result = await getCampaignProspectForConversionAction(prospectId)
      if (cancelled) return

      if (!result.success) {
        setErrorMessage(result.error)
        setProspect(null)
        setLoading(false)
        return
      }

      setProspect(result.prospect)
      setCampaignName(result.campaignName)
      setAmount(
        result.prospect.suggested_ask_amount != null
          ? String(result.prospect.suggested_ask_amount)
          : ""
      )
      setPledgeDate(getTodayPlainDate())
      setFrequency("One-Time")
      setNotes("")
      setWishlistItemId(null)
      setAttribution({
        ...EMPTY_DONATION_ATTRIBUTION_VALUE,
        campaignId: result.prospect.campaign_id,
      })
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [open, prospectId])

  async function handleSave() {
    if (!prospectId) return
    if (!amount || Number(amount) <= 0) {
      alert("Enter the actual pledge amount.")
      return
    }

    setSaving(true)
    const result = await convertCampaignProspectToPledgeAction({
      prospectId,
      amountPledged: Number(amount),
      pledgeDate,
      frequency,
      notes,
      categoryId: attribution.categoryId || null,
      subcategoryId: attribution.subcategoryId || null,
      wishlistItemId,
    })
    setSaving(false)

    if (!result.success) {
      alert(result.error)
      return
    }

    onConverted({
      pledgeId: result.pledgeId,
      amountPledged: result.amountPledged,
      suggestedAskAmount: result.suggestedAskAmount,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Pledge</DialogTitle>
          <DialogDescription>
            Creates one pledge in the existing ledger and marks this prospect as Pledged.
            Suggested ask is kept for history.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading prospect…</p>
        ) : errorMessage ? (
          <p className="py-6 text-sm text-red-600">{errorMessage}</p>
        ) : prospect ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <p>
                <span className="text-muted-foreground">Donor: </span>
                <span className="font-medium">{prospect.contactName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Campaign: </span>
                <span className="font-medium">{campaignName || "—"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Suggested Ask: </span>
                <span className="font-medium tabular-nums">
                  {prospect.suggested_ask_amount != null
                    ? formatDonationCurrency(prospect.suggested_ask_amount)
                    : "—"}
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="actual-pledge-amount">Actual Pledge Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="actual-pledge-amount"
                  type="number"
                  className="pl-7"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter what they committed. This does not change the suggested ask.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="convert-pledge-date">Pledge Date</Label>
                <Input
                  id="convert-pledge-date"
                  type="date"
                  value={pledgeDate}
                  onChange={(event) => setPledgeDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="One-Time">One-Time</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DonationAttributionFields
              organizationId={organizationId}
              value={attribution}
              showCampaign={false}
              onChange={(next) =>
                setAttribution({
                  ...next,
                  campaignId: prospect.campaign_id,
                })
              }
            />

            <WishlistItemPicker
              campaignId={prospect.campaign_id}
              value={wishlistItemId}
              onChange={setWishlistItemId}
            />

            <div className="flex flex-col gap-2">
              <Label htmlFor="convert-notes">Notes</Label>
              <Textarea
                id="convert-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving || loading || !prospect}
          >
            {saving ? "Saving..." : "Create Pledge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
