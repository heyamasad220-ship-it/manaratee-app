"use client"

import { useEffect, useRef, useState } from "react"

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
  listCampaignProspectActivitiesAction,
  logCampaignProspectActivityAction,
} from "@/lib/donations/campaign-prospect-actions"
import {
  campaignProspectAskAmount,
  type CampaignProspectActivityRow,
  type CampaignProspectListItem,
} from "@/lib/donations/campaign-prospect-types"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"

export type FundraisingPlanSaveInput = {
  contact_id: string
  suggested_ask_amount: number | null
  assigned_to_contact_id: string | null
  assigned_to_name: string | null
  next_follow_up_at: string | null
  notes: string | null
}

type FormState = {
  contactId: string
  contactLabel: string
  askAmount: string
  assignedToName: string
  nextFollowUpAt: string
  notes: string
}

function emptyForm(): FormState {
  return {
    contactId: "",
    contactLabel: "",
    askAmount: "",
    assignedToName: "",
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

function formatContactStamp(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatContactLogHeading(activity: CampaignProspectActivityRow) {
  const stamp = formatContactStamp(activity.created_at || activity.activity_date)
  const name = activity.created_by_name?.trim()
  return name ? `${name} · ${stamp}` : stamp
}

function formFromProspect(prospect: CampaignProspectListItem): FormState {
  const amount = campaignProspectAskAmount(prospect)
  return {
    contactId: prospect.contact_id,
    contactLabel: prospect.contactName,
    askAmount: amount == null ? "" : String(amount),
    assignedToName: prospect.assignedToName || prospect.assigned_to_name || "",
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
  onContactLogged,
  onAttached,
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
  onSave: (input: FundraisingPlanSaveInput) => Promise<CampaignProspectListItem | null>
  onContactLogged: (prospectId: string, lastContactedAt: string | null) => void
  onAttached: (prospect: CampaignProspectListItem) => void
  onDelete: () => Promise<boolean>
  onRecordPledge: () => void
}) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [quickAddQuery, setQuickAddQuery] = useState("")
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [activities, setActivities] = useState<CampaignProspectActivityRow[]>([])
  const [logNote, setLogNote] = useState("")
  const [logError, setLogError] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  const editing = Boolean(prospect)
  const readOnly = !canManage
  const askInvalid = form.askAmount.trim() !== "" && parseAskAmount(form.askAmount) == null
  const openedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      openedFor.current = null
      return
    }
    const key = prospect?.id ?? "new"
    if (openedFor.current === "new" && prospect?.id) {
      openedFor.current = key
      return
    }
    if (openedFor.current === key) return
    openedFor.current = key
    setForm(prospect ? formFromProspect(prospect) : emptyForm())
    setShowQuickAdd(false)
    setLogNote("")
    setLogError(null)
    setActivities([])
  }, [open, prospect])

  useEffect(() => {
    if (!open || !prospect) return
    let cancelled = false
    void listCampaignProspectActivitiesAction(prospect.id).then((result) => {
      if (cancelled) return
      setActivities(result.success ? result.activities : [])
    })
    return () => {
      cancelled = true
    }
  }, [open, prospect?.id])

  async function writeContactLog(prospectId: string, note: string) {
    const result = await logCampaignProspectActivityAction(prospectId, {
      activity_type: "note",
      notes: note,
    })
    if (!result.success) {
      setLogError(result.error)
      return false
    }
    setActivities((current) => [result.activity, ...current])
    setLogNote("")
    setLogError(null)
    onContactLogged(prospectId, result.lastContactedAt)
    return true
  }

  async function handleLogContact() {
    if (!prospect || !logNote.trim()) return
    setLogging(true)
    await writeContactLog(prospect.id, logNote.trim())
    setLogging(false)
  }

  async function handleSave() {
    if (!form.contactId || askInvalid) return
    const saved = await onSave({
      contact_id: form.contactId,
      suggested_ask_amount: parseAskAmount(form.askAmount),
      assigned_to_contact_id: null,
      assigned_to_name: form.assignedToName.trim() || null,
      next_follow_up_at: form.nextFollowUpAt || null,
      notes: form.notes.trim() || null,
    })
    if (!saved) return
    const note = logNote.trim()
    if (!note) {
      onOpenChange(false)
      return
    }
    setLogging(true)
    const logged = await writeContactLog(saved.id, note)
    setLogging(false)
    if (!logged) {
      if (!prospect) onAttached(saved)
      return
    }
    onOpenChange(false)
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
                ? "Update the ask, log each contact, or record a pledge."
                : "Search the donor, enter the ask, and type who is assigned. A contact note is saved with the current time."}
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-dialog-contact-log">Contact log</Label>
              <p className="text-sm text-muted-foreground">
                Your name and the time are added automatically. Write the notes for this contact.
              </p>
              {editing && activities.length > 0 ? (
                <ul className="flex max-h-40 flex-col gap-3 overflow-y-auto rounded-md border p-3">
                  {activities.map((activity) => (
                    <li key={activity.id}>
                      <p className="text-xs text-muted-foreground">
                        {formatContactLogHeading(activity)}
                      </p>
                      {activity.notes ? <p className="text-sm">{activity.notes}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : editing ? (
                <p className="text-sm text-muted-foreground">No contacts logged yet.</p>
              ) : null}
              {canManage ? (
                <>
                  <Textarea
                    id="plan-dialog-contact-log"
                    disabled={readOnly || logging}
                    rows={3}
                    value={logNote}
                    onChange={(event) => setLogNote(event.target.value)}
                    placeholder="What happened on this contact"
                  />
                  {logError ? <p className="text-sm text-red-600">{logError}</p> : null}
                  {editing ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={logging || saving || !logNote.trim()}
                        onClick={() => void handleLogContact()}
                      >
                        {logging ? "Logging..." : "Log contact"}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : null}
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
                  disabled={saving || logging || !form.contactId || askInvalid}
                  onClick={() => void handleSave()}
                >
                  {saving || logging ? "Saving..." : "Save"}
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
