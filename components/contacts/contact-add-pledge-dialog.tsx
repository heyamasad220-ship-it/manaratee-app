"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  toAttributionIds,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields"
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
import { WishlistItemPicker } from "@/components/donations/wishlist-item-picker"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import { getSelectedOrganizationIdClient } from "@/lib/organizations/get-selected-organization-id-client"

function getTodayPlainDate() {
  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset() * 60 * 1000
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function normalizeDateInput(date?: string | null) {
  if (!date) return null
  return date.slice(0, 10)
}

type ContactAddPledgeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName: string
  organizationId?: string | null
  onSuccess?: () => void
}

export function ContactAddPledgeDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  organizationId: organizationIdProp,
  onSuccess,
}: ContactAddPledgeDialogProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(organizationIdProp ?? null)
  const [amount, setAmount] = useState("")
  const [pledgeDate, setPledgeDate] = useState("")
  const [frequency, setFrequency] = useState("One-Time")
  const [notes, setNotes] = useState("")
  const [attribution, setAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  )
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAmount("")
    setPledgeDate(getTodayPlainDate())
    setFrequency("One-Time")
    setNotes("")
    setAttribution(EMPTY_DONATION_ATTRIBUTION_VALUE)
    setWishlistItemId(null)

    if (!organizationIdProp) {
      void (async () => {
        const orgId = await getSelectedOrganizationIdClient()
        setOrganizationId(orgId)
      })()
    } else {
      setOrganizationId(organizationIdProp)
    }
  }, [open, organizationIdProp])

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

    const donorId = await ensureDonorExtensionForContact(orgId, contactId)
    if (!donorId) {
      setSaving(false)
      alert("Could not resolve a donor record for this contact.")
      return
    }

    const { error } = await supabase.from("pledges").insert({
      organization_id: orgId,
      donor_id: donorId,
      ...toAttributionIds(attribution),
      wishlist_item_id: attribution.campaignId ? wishlistItemId : null,
      amount_pledged: Number(amount),
      pledge_date: normalizeDateInput(pledgeDate) || getTodayPlainDate(),
      pledge_type: frequency.toLowerCase().replace("-", "_"),
      frequency: frequency.toLowerCase().replace("-", "_"),
      status: "open",
      notes: notes || null,
    })

    setSaving(false)

    if (error) {
      alert(error.message)
      return
    }

    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Pledge</DialogTitle>
          <DialogDescription>
            Create a pledge commitment for {contactName || "this contact"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label>Contact</Label>
            <Input value={contactName || "Unnamed contact"} disabled />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-pledge-amount">Total Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="contact-pledge-amount"
                type="number"
                placeholder="0.00"
                className="pl-7"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </div>

          <DonationAttributionFields
            organizationId={organizationId}
            value={attribution}
            onChange={(value) => {
              setAttribution(value)
              if (!value.campaignId) setWishlistItemId(null)
            }}
          />
          <WishlistItemPicker
            campaignId={attribution.campaignId || null}
            value={wishlistItemId}
            onChange={setWishlistItemId}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-pledge-date">Pledge Date</Label>
              <Input
                id="contact-pledge-date"
                type="date"
                value={pledgeDate}
                onChange={(event) => setPledgeDate(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-pledge-type">Pledge Type</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="contact-pledge-type">
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
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-pledge-notes">Notes (Optional)</Label>
            <Textarea
              id="contact-pledge-notes"
              placeholder="Add any additional notes..."
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Add Pledge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
