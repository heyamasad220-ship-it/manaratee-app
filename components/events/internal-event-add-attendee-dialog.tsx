"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

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
import { addManualEventAttendee } from "@/lib/tickets/ticket-order-actions"
import type { EventTicketType } from "@/lib/tickets/ticket-types"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

export function InternalEventAddAttendeeDialog({
  open,
  onOpenChange,
  eventId,
  ticketTypes,
  waitlistEnabled,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  ticketTypes: EventTicketType[]
  waitlistEnabled: boolean
  onAdded: () => void
}) {
  const activeTypes = ticketTypes.filter((type) => type.is_active)
  const [ticketTypeId, setTicketTypeId] = useState("")
  const [attendeeName, setAttendeeName] = useState("")
  const [attendeeEmail, setAttendeeEmail] = useState("")
  const [purchaserName, setPurchaserName] = useState("")
  const [purchaserEmail, setPurchaserEmail] = useState("")
  const [forceRegister, setForceRegister] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setTicketTypeId(activeTypes[0]?.id ?? "")
    setAttendeeName("")
    setAttendeeEmail("")
    setPurchaserName("")
    setPurchaserEmail("")
    setForceRegister(false)
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      resetForm()
    }
    onOpenChange(next)
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await addManualEventAttendee({
        eventId,
        ticketTypeId: ticketTypeId || activeTypes[0]?.id || "",
        attendeeName,
        attendeeEmail,
        purchaserName: purchaserName || null,
        purchaserEmail: purchaserEmail || null,
        forceRegister,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      onAdded()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add attendee</DialogTitle>
          <DialogDescription>
            Manually register someone for this event. They appear on the
            attendees list immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {activeTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add ticket types in Settings → Tickets first.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Ticket type</Label>
                <Select
                  value={ticketTypeId || activeTypes[0]?.id}
                  onValueChange={setTicketTypeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTypes.map((type) => {
                      const remaining =
                        type.quantity_total != null
                          ? Math.max(
                              0,
                              type.quantity_total - Number(type.quantity_sold || 0)
                            )
                          : null
                      return (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                          {type.price_cents === 0
                            ? " · Free"
                            : ` · ${formatTicketPrice(type.price_cents)}`}
                          {remaining != null ? ` · ${remaining} left` : ""}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="add-attendee-name">Attendee name</Label>
                  <Input
                    id="add-attendee-name"
                    value={attendeeName}
                    onChange={(event) => setAttendeeName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-attendee-email">Attendee email</Label>
                  <Input
                    id="add-attendee-email"
                    type="email"
                    value={attendeeEmail}
                    onChange={(event) => setAttendeeEmail(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="add-purchaser-name">Purchaser name (optional)</Label>
                  <Input
                    id="add-purchaser-name"
                    value={purchaserName}
                    onChange={(event) => setPurchaserName(event.target.value)}
                    placeholder="Same as attendee"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-purchaser-email">Purchaser email (optional)</Label>
                  <Input
                    id="add-purchaser-email"
                    type="email"
                    value={purchaserEmail}
                    onChange={(event) => setPurchaserEmail(event.target.value)}
                    placeholder="Same as attendee"
                  />
                </div>
              </div>

              {!waitlistEnabled ? (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={forceRegister}
                    onCheckedChange={(checked) =>
                      setForceRegister(checked === true)
                    }
                  />
                  <span>
                    Register anyway when capacity is full (staff override)
                  </span>
                </label>
              ) : (
                <p className="text-xs text-muted-foreground">
                  When capacity is full, new registrations go to the waitlist.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || activeTypes.length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding…
              </>
            ) : (
              "Add attendee"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
