"use client"

import { useEffect, useState } from "react"

import { QuickAddContactDialog } from "@/components/contacts/quick-add-contact-dialog"
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
import { Textarea } from "@/components/ui/textarea"
import {
  campaignProspectAskAmount,
  type CampaignProspectListItem,
} from "@/lib/donations/campaign-prospect-types"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"

export type FundraisingPlanSaveInput = {
  contact_id: string
  suggested_ask_amount: number | null
  assigned_to_contact_id: string | null
  assigned_to_name: string | null
  last_contacted_at: string | null
  next_follow_up_at: string | null
  notes: string | null
}

type FormState = {
  contactId: string
  contactLabel: string
  askAmount: string
  assignedToName: string
  lastContactedAt: string
  nextFollowUpAt: string
  notes: string
}

function emptyForm(): FormState {
  return {
    contactId: "",
    contactLabel: "",
    askAmount: "",
    assignedToName: "",
    lastContactedAt: "",
    nextFollowUpAt: "",
    notes: "",
  }
}

function dateInputValue(value: string | null | undefined) {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || ""
}

function parseAskAmount(value: string): number | null {
  const trimmed = value.trim().replace(/[$,]/g, "")
  if (!trimmed) return null
  const amount = Number(trimmed)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100) / 100
}

function formFromProspect(prospect: CampaignProspectListItem): FormState {
  const amount = campaignProspectAskAmount(prospect)
  return {
    contactId: prospect.contact_id,
    contactLabel: prospect.contactName,
    askAmount: amount == null ? "" : String(amount),
    assignedToName: prospect.assignedToName || prospect.assigned_to_name || "",
    lastContactedAt: dateInputValue(prospect.last_contacted_at),
    nextFollowUpAt: dateInputValue(prospect.next_follow_up_at),
    notes: prospect.notes || "",
  }
}

export function CampaignFundraisingPlanDialog({
  open,
  onOpenChange,
  organizationId,
  prospect,
  canManage,
  saving,
  errorMessage,
  onSave,
  onDelete,
  onRecordPledge,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  prospect: CampaignProspectListItem | null
  canManage: boolean
  saving: boolean
  errorMessage: string | null
  onSave: (input: FundraisingPlanSaveInput) => Promise<boolean>
  onDelete: () => Promise<boolean>
  onRecordPledge: () => void
}) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [quickAddQuery, setQuickAddQuery] = useState("")
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const editing = Boolean(prospect)
  const readOnly = !canManage
  const askInvalid = form.askAmount.trim() !== "" && parseAskAmount(form.askAmount) == null

  useEffect(() => {
    if (!open) return
    setForm(prospect ? formFromProspect(prospect) : emptyForm())
    setShowQuickAdd(false)
  }, [open, prospect])

  async function handleSave() {
    if (!form.contactId || askInvalid) return
    const saved = await onSave({
      contact_id: form.contactId,
      suggested_ask_amount: parseAskAmount(form.askAmount),
      assigned_to_contact_id: null,
      assigned_to_name: form.assignedToName.trim() || null,
      last_contacted_at: form.lastContactedAt || null,
      next_follow_up_at: form.nextFollowUpAt || null,
      notes: form.notes.trim() || null,
    })
    if (saved) onOpenChange(false)
  }

  async function handleDelete() {
    if (!prospect) return
    if (!confirm(`Remove ${prospect.contactName} from this plan?`)) return
    const deleted = await onDelete()
    if (deleted) onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit prospect" : "Add prospect"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this outreach row, record a pledge, or remove it from the plan."
                : "Search the donor, enter the ask, and type who is assigned. Dates are optional."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

            <PledgeContactPicker
              organizationId={organizationId}
              contactId={form.contactId}
              contactLabel={form.contactLabel}
              label="Prospect"
              inputId="plan-dialog-prospect"
              disabled={readOnly || editing}
              onChange={(contactId, label) =>
                setForm((current) => ({ ...current, contactId, contactLabel: label }))
              }
              onQueryChange={setQuickAddQuery}
              onCreateClick={
                readOnly || editing
                  ? undefined
                  : () => setShowQuickAdd(true)
              }
              createLabel="Create contact"
            />

            {editing && prospect?.pledgeAmount != null ? (
              <p className="text-sm text-muted-foreground">
                Pledged {formatDonationCurrency(prospect.pledgeAmount)}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-dialog-ask">Ask level</Label>
              <Input
                id="plan-dialog-ask"
                type="text"
                inputMode="decimal"
                disabled={readOnly}
                value={form.askAmount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, askAmount: event.target.value }))
                }
                placeholder="Amount"
              />
              {askInvalid ? (
                <p className="text-sm text-red-600">Enter a valid ask amount.</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-dialog-assignee">Assigned to</Label>
              <Input
                id="plan-dialog-assignee"
                type="text"
                disabled={readOnly}
                value={form.assignedToName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, assignedToName: event.target.value }))
                }
                placeholder="Type a name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-dialog-last-contact">Last contact</Label>
                <Input
                  id="plan-dialog-last-contact"
                  type="date"
                  disabled={readOnly}
                  value={form.lastContactedAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, lastContactedAt: event.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-dialog-follow-up">Next follow-up</Label>
                <Input
                  id="plan-dialog-follow-up"
                  type="date"
                  disabled={readOnly}
                  value={form.nextFollowUpAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-dialog-notes">Notes</Label>
              <Textarea
                id="plan-dialog-notes"
                disabled={readOnly}
                rows={4}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional notes"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {editing && canManage && !prospect?.converted_pledge_id ? (
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:text-red-700"
                disabled={saving}
                onClick={() => void handleDelete()}
              >
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {editing && canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={onRecordPledge}
                >
                  {prospect?.converted_pledge_id ? "View pledge" : "Record pledge"}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {canManage ? (
                <Button
                  type="button"
                  disabled={saving || !form.contactId || askInvalid}
                  onClick={() => void handleSave()}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddContactDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        searchHint={quickAddQuery}
        onCreated={(contact) => {
          const label = contact.full_name || contact.email || "New contact"
          setForm((current) => ({
            ...current,
            contactId: contact.contactId,
            contactLabel: label,
          }))
          setShowQuickAdd(false)
        }}
      />
    </>
  )
}
