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
import { ensureGroupMembershipForDonationAction } from "@/lib/contacts/group-giving-actions"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import { getSelectedOrganizationIdClient } from "@/lib/organizations/get-selected-organization-id-client"

type ContactReceivePaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName: string
  organizationId?: string | null
  onSuccess?: () => void
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

  useEffect(() => {
    if (!open) return
    setAmount("")
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setSource("cash")
    setMemo("")
    setAttribution(EMPTY_DONATION_ATTRIBUTION_VALUE)
    setGroupContactId(null)
    setGroupLabel("")

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive Payment</DialogTitle>
          <DialogDescription>
            Record a payment for {contactName || "this contact"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label>Contact</Label>
            <Input value={contactName || "Unnamed contact"} disabled />
          </div>

          <DonationGroupPicker
            groupContactId={groupContactId}
            groupLabel={groupLabel}
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

          <DonationAttributionFields
            organizationId={organizationId}
            value={attribution}
            onChange={setAttribution}
          />

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
