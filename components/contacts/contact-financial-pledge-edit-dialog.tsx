"use client"

import { useEffect, useState } from "react"

import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields"
import { PledgeContactPicker } from "@/components/donations/pledge-contact-picker"
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
import type { PledgeDisplayStatus } from "@/lib/donations/donation-status"
import { getPledgeForEditAction, updatePledgeAction } from "@/lib/donations/pledge-admin-actions"

type ContactFinancialPledgeEditDialogProps = {
  pledgeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

export function ContactFinancialPledgeEditDialog({
  pledgeId,
  open,
  onOpenChange,
  onUpdated,
}: ContactFinancialPledgeEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [editAmount, setEditAmount] = useState("")
  const [editPledgeDate, setEditPledgeDate] = useState("")
  const [editFrequency, setEditFrequency] = useState("One-Time")
  const [editStatus, setEditStatus] = useState<PledgeDisplayStatus>("Open")
  const [editNotes, setEditNotes] = useState("")
  const [editContactId, setEditContactId] = useState("")
  const [editContactLabel, setEditContactLabel] = useState("")
  const [editAttribution, setEditAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  )

  useEffect(() => {
    if (!open || !pledgeId) return

    let cancelled = false

    void (async () => {
      setLoading(true)
      setError(null)

      const result = await getPledgeForEditAction(pledgeId)
      if (cancelled) return

      setLoading(false)

      if (!result.success) {
        setError(result.error)
        return
      }

      setOrganizationId(result.organizationId)
      setEditAmount(String(result.pledge.amountPledged))
      setEditPledgeDate(result.pledge.pledgeDate)
      setEditFrequency(result.pledge.frequency)
      setEditStatus(result.pledge.status)
      setEditNotes(result.pledge.notes)
      setEditContactId(result.pledge.contactId || "")
      setEditContactLabel(result.pledge.donorName || "")
      setEditAttribution({
        campaignId: result.pledge.campaignId,
        categoryId: result.pledge.categoryId,
        subcategoryId: result.pledge.subcategoryId,
      })
    })()

    return () => {
      cancelled = true
    }
  }, [open, pledgeId])

  async function handleSave() {
    setSaving(true)
    setError(null)

    const result = await updatePledgeAction({
      pledgeId,
      amountPledged: Number(editAmount),
      pledgeDate: editPledgeDate,
      frequency: editFrequency,
      status: editStatus,
      campaignId: editAttribution.campaignId || null,
      categoryId: editAttribution.categoryId || null,
      subcategoryId: editAttribution.subcategoryId || null,
      notes: editNotes,
      contactId: editContactId || null,
    })

    setSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onOpenChange(false)
    onUpdated?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Pledge</DialogTitle>
          <DialogDescription>
            Update pledge details without leaving this contact profile.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading pledge...</p>
        ) : (
          <div className="space-y-4 py-2">
            <PledgeContactPicker
              organizationId={organizationId}
              contactId={editContactId}
              contactLabel={editContactLabel}
              onChange={(contactId, label) => {
                setEditContactId(contactId)
                setEditContactLabel(label)
              }}
              disabled={saving}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-pledge-edit-amount">Total Amount</Label>
                <Input
                  id="contact-pledge-edit-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editAmount}
                  onChange={(event) => setEditAmount(event.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-pledge-edit-date">Pledge Date</Label>
                <Input
                  id="contact-pledge-edit-date"
                  type="date"
                  value={editPledgeDate}
                  onChange={(event) => setEditPledgeDate(event.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <DonationAttributionFields
              organizationId={organizationId}
              value={editAttribution}
              onChange={setEditAttribution}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-pledge-edit-frequency">Frequency</Label>
                <Select value={editFrequency} onValueChange={setEditFrequency} disabled={saving}>
                  <SelectTrigger id="contact-pledge-edit-frequency">
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
              <div className="space-y-2">
                <Label htmlFor="contact-pledge-edit-status">Status</Label>
                <Select
                  value={editStatus}
                  onValueChange={(value) => setEditStatus(value as PledgeDisplayStatus)}
                  disabled={saving}
                >
                  <SelectTrigger id="contact-pledge-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Fulfilled">Fulfilled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-pledge-edit-notes">Notes</Label>
              <Textarea
                id="contact-pledge-edit-notes"
                rows={3}
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                disabled={saving}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
