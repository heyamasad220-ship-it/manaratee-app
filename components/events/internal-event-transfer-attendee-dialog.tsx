"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

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
import { transferEventTicketAttendee } from "@/lib/tickets/ticket-order-actions"
import type { EventAttendeeListItem } from "@/lib/tickets/ticket-order-queries"

export function InternalEventTransferAttendeeDialog({
  open,
  onOpenChange,
  attendee,
  onTransferred,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  attendee: EventAttendeeListItem | null
  onTransferred: () => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    if (next && attendee) {
      setName(attendee.attendeeName || attendee.purchaserName || "")
      setEmail(attendee.attendeeEmail || attendee.purchaserEmail || "")
      setError(null)
    }
    onOpenChange(next)
  }

  function handleSubmit() {
    if (!attendee) return
    setError(null)
    startTransition(async () => {
      const result = await transferEventTicketAttendee({
        ticketId: attendee.id,
        attendeeName: name,
        attendeeEmail: email,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      onTransferred()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer registration</DialogTitle>
          <DialogDescription>
            Update who this ticket is registered to. Order and payment stay the same.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="transfer-name">Attendee name</Label>
            <Input
              id="transfer-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transfer-email">Attendee email</Label>
            <Input
              id="transfer-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !attendee}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
