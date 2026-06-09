"use client"

import { useEffect, useState, useTransition } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createTicketOrder,
  getTicketTypesForEvent,
} from "@/lib/tickets/ticket-order-actions"
import type { TicketedEventOption } from "@/lib/tickets/ticket-order-queries"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

type TicketTypeOption = Awaited<ReturnType<typeof getTicketTypesForEvent>>[number]

export function CreateTicketOrderDialog({
  open,
  onOpenChange,
  events,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  events: TicketedEventOption[]
  onCreated: () => void
}) {
  const [eventId, setEventId] = useState("")
  const [ticketTypes, setTicketTypes] = useState<TicketTypeOption[]>([])
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [purchaserName, setPurchaserName] = useState("")
  const [purchaserEmail, setPurchaserEmail] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [paymentReference, setPaymentReference] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) {
      setEventId("")
      setTicketTypes([])
      setQuantities({})
      setPurchaserName("")
      setPurchaserEmail("")
      setPaymentMethod("")
      setPaymentReference("")
      setError(null)
      return
    }

    if (!eventId) {
      setTicketTypes([])
      return
    }

    let cancelled = false
    setLoadingTypes(true)

    void getTicketTypesForEvent(eventId)
      .then((types) => {
        if (cancelled) return
        setTicketTypes(types)
        setQuantities(Object.fromEntries(types.map((type) => [type.id, "0"])))
      })
      .catch(() => {
        if (!cancelled) setTicketTypes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTypes(false)
      })

    return () => {
      cancelled = true
    }
  }, [eventId, open])

  const estimatedTotal = ticketTypes.reduce((sum, type) => {
    const qty = Number.parseInt(quantities[type.id] || "0", 10)
    if (Number.isNaN(qty) || qty <= 0) return sum
    return sum + type.priceCents * qty
  }, 0)

  function handleSubmit() {
    setError(null)

    const lines = ticketTypes
      .map((type) => ({
        ticketTypeId: type.id,
        quantity: Number.parseInt(quantities[type.id] || "0", 10),
      }))
      .filter((line) => line.quantity > 0)

    startTransition(async () => {
      try {
        await createTicketOrder({
          internalEventId: eventId,
          purchaserName,
          purchaserEmail,
          paymentMethod: paymentMethod || null,
          paymentReference: paymentReference || null,
          status: "completed",
          lines,
        })
        onOpenChange(false)
        onCreated()
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Could not create order."
        )
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add new order</DialogTitle>
          <DialogDescription>
            Manually issue tickets and record payment for a ticketed event.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Event</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingTypes ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading ticket types...
            </div>
          ) : eventId && ticketTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This event has no active ticket types. Add ticket types on the event first.
            </p>
          ) : null}

          {ticketTypes.length > 0 ? (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Tickets</p>
              {ticketTypes.map((type) => (
                <div key={type.id} className="grid grid-cols-[1fr_100px] items-center gap-3">
                  <div>
                    <p className="text-sm font-medium">{type.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTicketPrice(type.priceCents)}
                      {type.quantityRemaining != null
                        ? ` · ${type.quantityRemaining} left`
                        : ""}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={quantities[type.id] || "0"}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [type.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <p className="text-sm font-medium">
                Total: {formatTicketPrice(estimatedTotal)}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="order-purchaser-name">Purchaser name</Label>
              <Input
                id="order-purchaser-name"
                value={purchaserName}
                onChange={(event) => setPurchaserName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-purchaser-email">Email</Label>
              <Input
                id="order-purchaser-email"
                type="email"
                value={purchaserEmail}
                onChange={(event) => setPurchaserEmail(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="order-payment-method">Payment method</Label>
              <Input
                id="order-payment-method"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                placeholder="Cash, card, check..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-payment-reference">Transaction ID</Label>
              <Input
                id="order-payment-reference"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !eventId || ticketTypes.length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
