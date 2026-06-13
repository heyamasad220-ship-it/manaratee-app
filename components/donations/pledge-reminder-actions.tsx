"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Mail, Phone, Eye } from "lucide-react"
import {
  markPledgeContactedAction,
  previewPledgeReminderAction,
  sendPledgeReminderAction,
} from "@/lib/donations/pledge-reminder-actions"
import type { PledgeReminderMessage } from "@/lib/donations/pledge-reminder-types"

type PledgeReminderActionsProps = {
  pledgeId: string
  donorName: string
  onUpdated?: () => void
  compact?: boolean
}

export function PledgeReminderActions({
  pledgeId,
  donorName,
  onUpdated,
  compact = false,
}: PledgeReminderActionsProps) {
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [preview, setPreview] = useState<PledgeReminderMessage | null>(null)
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null)
  const [contactNotes, setContactNotes] = useState("")

  async function loadPreview() {
    setLoading(true)
    const result = await previewPledgeReminderAction(pledgeId)
    setLoading(false)
    if (!result.success) {
      alert(result.error || "Could not build reminder preview")
      return null
    }
    setPreview(result.message)
    setRecipientEmail(result.recipientEmail ?? null)
    return result.message
  }

  async function handlePreview() {
    const message = await loadPreview()
    if (message) setPreviewOpen(true)
  }

  async function handleSend() {
    const message = preview || (await loadPreview())
    if (!message) return

    if (
      !confirm(
        recipientEmail
          ? `Send pledge reminder email to ${recipientEmail}?`
          : "This donor has no email on file. The reminder will be recorded as failed."
      )
    ) {
      return
    }

    setLoading(true)
    const result = await sendPledgeReminderAction(pledgeId, "manual")
    setLoading(false)

    if (!result.success) {
      alert(result.error || "Could not send pledge reminder")
      return
    }

    setPreviewOpen(false)
    onUpdated?.()
    alert(result.notice || "Pledge reminder sent.")
  }

  async function handleMarkContacted() {
    setLoading(true)
    const result = await markPledgeContactedAction(pledgeId, contactNotes)
    setLoading(false)

    if (!result.success) {
      alert(result.error || "Could not log contact")
      return
    }

    setContactOpen(false)
    setContactNotes("")
    onUpdated?.()
    alert("Contact logged for this pledge.")
  }

  if (compact) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={handlePreview} disabled={loading}>
          <Eye className="mr-2 h-4 w-4" />
          Remind
        </Button>
        <ReminderPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          preview={preview}
          onSend={handleSend}
          loading={loading}
        />
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handlePreview} disabled={loading}>
          <Eye className="mr-2 h-4 w-4" />
          Preview Reminder
        </Button>
        <Button variant="outline" size="sm" onClick={handleSend} disabled={loading}>
          <Mail className="mr-2 h-4 w-4" />
          Send Reminder Email
        </Button>
        <Button variant="outline" size="sm" onClick={() => setContactOpen(true)} disabled={loading}>
          <Phone className="mr-2 h-4 w-4" />
          Mark Contacted
        </Button>
      </div>

      <ReminderPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
        onSend={handleSend}
        loading={loading}
      />

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Contacted</DialogTitle>
            <DialogDescription>
              Log manual outreach for {donorName}. This does not send email.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="contact-notes">Contact Notes (optional)</Label>
            <Textarea
              id="contact-notes"
              rows={4}
              value={contactNotes}
              onChange={(e) => setContactNotes(e.target.value)}
              placeholder="Called donor, left voicemail, etc."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkContacted} disabled={loading}>
              Save Contact Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReminderPreviewDialog({
  open,
  onOpenChange,
  preview,
  onSend,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: PledgeReminderMessage | null
  onSend: () => void
  loading: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pledge Reminder Preview</DialogTitle>
          <DialogDescription>
            Review the message before sending to the donor.
          </DialogDescription>
        </DialogHeader>
        {preview && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
            <div>
              <span className="font-medium">Subject:</span> {preview.subject}
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm">{preview.body}</pre>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onSend} disabled={loading}>
            Send Reminder Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
