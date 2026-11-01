"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Mail, Phone, Eye } from "lucide-react"
import {
  markPledgeContactedAction,
  getPledgeReminderHistoryAction,
  previewPledgeReminderAction,
  sendPledgeReminderAction,
} from "@/lib/donations/pledge-reminder-actions"
import {
  pledgeContactMethodLabel,
  type PledgeContactMethod,
  type PledgeReminderMessage,
  type PledgeReminderRecord,
} from "@/lib/donations/pledge-reminder-types"

type PledgeReminderControls = {
  loading: boolean
  previewOpen: boolean
  setPreviewOpen: (open: boolean) => void
  contactOpen: boolean
  setContactOpen: (open: boolean) => void
  preview: PledgeReminderMessage | null
  contactNotes: string
  setContactNotes: (value: string) => void
  contactedOn: string
  setContactedOn: (value: string) => void
  contactMethod: PledgeContactMethod | ""
  setContactMethod: (value: PledgeContactMethod | "") => void
  handlePreview: () => Promise<void>
  handleSend: () => Promise<void>
  handleMarkContacted: () => Promise<void>
}

type PledgeReminderMenuItemsProps = {
  pledgeId: string
  donorName: string
  onUpdated?: () => void
}

export function PledgeReminderDropdownItems({
  controls,
}: {
  controls: PledgeReminderControls
}) {
  const { loading, handlePreview, setContactOpen } = controls

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => void handlePreview()} disabled={loading}>
        <Eye className="mr-2 size-4" />
        Remind
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setContactOpen(true)} disabled={loading}>
        <Phone className="mr-2 size-4" />
        Mark Contacted
      </DropdownMenuItem>
    </>
  )
}

export function PledgeReminderDialogs({
  controls,
  donorName,
}: {
  controls: PledgeReminderControls
  donorName: string
}) {
  const {
    loading,
    previewOpen,
    setPreviewOpen,
    contactOpen,
    setContactOpen,
    preview,
    contactNotes,
    setContactNotes,
    contactedOn,
    setContactedOn,
    contactMethod,
    setContactMethod,
    handleSend,
    handleMarkContacted,
  } = controls

  return (
    <>
      <ReminderPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
        onSend={handleSend}
        loading={loading}
      />
      <MarkContactedDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        donorName={donorName}
        contactNotes={contactNotes}
        onContactNotesChange={setContactNotes}
        contactedOn={contactedOn}
        onContactedOnChange={setContactedOn}
        contactMethod={contactMethod}
        onContactMethodChange={setContactMethod}
        onSave={handleMarkContacted}
        loading={loading}
      />
    </>
  )
}

function todayDateOnly() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function usePledgeReminderControls(
  pledgeId: string,
  onUpdated?: () => void,
  onContactLogged?: () => void
): PledgeReminderControls {
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [preview, setPreview] = useState<PledgeReminderMessage | null>(null)
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null)
  const [contactNotes, setContactNotes] = useState("")
  const [contactedOn, setContactedOn] = useState(todayDateOnly)
  const [contactMethod, setContactMethod] = useState<PledgeContactMethod | "">("")

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
    const result = await markPledgeContactedAction(
      pledgeId,
      contactNotes,
      contactedOn,
      contactMethod
    )
    setLoading(false)

    if (!result.success) {
      alert(result.error || "Could not log contact")
      return
    }

    setContactOpen(false)
    setContactNotes("")
    setContactedOn(todayDateOnly())
    setContactMethod("")
    onUpdated?.()
    onContactLogged?.()
  }

  return {
    loading,
    previewOpen,
    setPreviewOpen,
    contactOpen,
    setContactOpen,
    preview,
    contactNotes,
    setContactNotes,
    contactedOn,
    setContactedOn,
    contactMethod,
    setContactMethod,
    handlePreview,
    handleSend,
    handleMarkContacted,
  }
}

export function PledgeOutreachDialog({
  open,
  onOpenChange,
  pledgeId,
  donorName,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pledgeId: string | null
  donorName: string
  onUpdated?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Remind / Contact</DialogTitle>
          <DialogDescription>
            Email reminders and call or text logs save immediately for {donorName}. This does not
            change the pledge.
          </DialogDescription>
        </DialogHeader>
        {open && pledgeId ? (
          <PledgeReminderActions
            pledgeId={pledgeId}
            donorName={donorName}
            onUpdated={onUpdated}
            onContactLogged={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

type PledgeReminderActionsProps = {
  pledgeId: string
  donorName: string
  onUpdated?: () => void
  onContactLogged?: () => void
  compact?: boolean
}

function formatContactedDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function PledgeReminderActions({
  pledgeId,
  donorName,
  onUpdated,
  onContactLogged,
  compact = false,
}: PledgeReminderActionsProps) {
  const [contactLogs, setContactLogs] = useState<PledgeReminderRecord[]>([])

  const loadContactLogs = useCallback(async () => {
    const result = await getPledgeReminderHistoryAction({ pledgeId, limit: 20 })
    if (!result.success) return
    setContactLogs(result.history.filter((row) => row.reminder_type === "contacted"))
  }, [pledgeId])

  useEffect(() => {
    if (compact) return
    void loadContactLogs()
  }, [compact, loadContactLogs])

  const controls = usePledgeReminderControls(
    pledgeId,
    () => {
      void loadContactLogs()
      onUpdated?.()
    },
    onContactLogged
  )
  const {
    loading,
    previewOpen,
    setPreviewOpen,
    contactOpen,
    setContactOpen,
    preview,
    contactNotes,
    setContactNotes,
    contactedOn,
    setContactedOn,
    contactMethod,
    setContactMethod,
    handlePreview,
    handleSend,
    handleMarkContacted,
  } = controls

  if (compact) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => void handlePreview()} disabled={loading}>
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
        <Button variant="outline" size="sm" onClick={() => void handlePreview()} disabled={loading}>
          <Eye className="mr-2 h-4 w-4" />
          Preview Reminder
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleSend()} disabled={loading}>
          <Mail className="mr-2 h-4 w-4" />
          Send Reminder Email
        </Button>
        <Button variant="outline" size="sm" onClick={() => setContactOpen(true)} disabled={loading}>
          <Phone className="mr-2 h-4 w-4" />
          Mark Contacted
        </Button>
      </div>
      {contactLogs.length > 0 ? (
        <div className="space-y-2">
          {contactLogs.map((row) => (
            <div key={row.id} className="rounded-md border px-3 py-2 text-sm">
              <p className="font-medium">
                {pledgeContactMethodLabel(row.contact_method) || "Contacted"}{" "}
                {formatContactedDate(row.sent_at || row.created_at)}
              </p>
              {row.contact_notes ? (
                <p className="mt-1 text-muted-foreground">{row.contact_notes}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <ReminderPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
        onSend={handleSend}
        loading={loading}
      />

      <MarkContactedDialog
        open={contactOpen}
        onOpenChange={setContactOpen}
        donorName={donorName}
        contactNotes={contactNotes}
        onContactNotesChange={setContactNotes}
        contactedOn={contactedOn}
        onContactedOnChange={setContactedOn}
        contactMethod={contactMethod}
        onContactMethodChange={setContactMethod}
        onSave={handleMarkContacted}
        loading={loading}
      />
    </>
  )
}

/** @deprecated Use usePledgeReminderControls with PledgeReminderDropdownItems + PledgeReminderDialogs */
export function PledgeReminderMenuItems({
  pledgeId,
  donorName,
  onUpdated,
}: PledgeReminderMenuItemsProps) {
  const controls = usePledgeReminderControls(pledgeId, onUpdated)

  return (
    <>
      <PledgeReminderDropdownItems controls={controls} />
      <PledgeReminderDialogs controls={controls} donorName={donorName} />
    </>
  )
}

function MarkContactedDialog({
  open,
  onOpenChange,
  donorName,
  contactNotes,
  onContactNotesChange,
  contactedOn,
  onContactedOnChange,
  contactMethod,
  onContactMethodChange,
  onSave,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  donorName: string
  contactNotes: string
  onContactNotesChange: (value: string) => void
  contactedOn: string
  onContactedOnChange: (value: string) => void
  contactMethod: PledgeContactMethod | ""
  onContactMethodChange: (value: PledgeContactMethod | "") => void
  onSave: () => Promise<void>
  loading: boolean
}) {
  useEffect(() => {
    if (!open) return
    onContactedOnChange(todayDateOnly())
    onContactMethodChange("")
  }, [open, onContactedOnChange, onContactMethodChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as Contacted</DialogTitle>
          <DialogDescription>
            Log manual outreach for {donorName}. This does not send email.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label>How did you reach them?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={contactMethod === "call" ? "default" : "outline"}
                onClick={() => onContactMethodChange("call")}
              >
                Call
              </Button>
              <Button
                type="button"
                variant={contactMethod === "text" ? "default" : "outline"}
                onClick={() => onContactMethodChange("text")}
              >
                Text
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contacted-on">Date contacted</Label>
            <Input
              id="contacted-on"
              type="date"
              value={contactedOn}
              onChange={(e) => onContactedOnChange(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-notes">Contact Notes (optional)</Label>
            <Textarea
              id="contact-notes"
              rows={4}
              value={contactNotes}
              onChange={(e) => onContactNotesChange(e.target.value)}
              placeholder="Left a voicemail, sent a text, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSave()} disabled={loading || !contactMethod}>
            Save Contact Log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
