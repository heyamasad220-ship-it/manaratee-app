"use client"

import { useEffect, useMemo, useState } from "react"

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
import { Textarea } from "@/components/ui/textarea"
import {
  dollarsToTicketCents,
  ticketCentsToDollarInput,
  ticketOrderRemainingCents,
} from "@/lib/tickets/ticket-refund-math"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

export type CancelRefundTicket = {
  id: string
  ticketCode: string
  ticketTypeName: string
  attendeeName: string | null
  status: string
  priceCents: number
}

const REFUNDABLE_STATUSES = new Set(["valid", "checked_in", "waitlisted"])

export function TicketOrderCancelRefundDialog({
  open,
  onOpenChange,
  orderNumber,
  orderStatus,
  totalCents,
  refundedCents,
  currency,
  tickets,
  pending,
  error,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderNumber: string
  orderStatus: string
  totalCents: number
  refundedCents: number
  currency: string
  tickets: CancelRefundTicket[]
  pending: boolean
  error: string | null
  onConfirm: (input: {
    ticketIds: string[]
    amountCents: number
    note: string
    notifyCustomer: boolean
  }) => void
}) {
  const remainingCents = ticketOrderRemainingCents({
    status: orderStatus,
    totalCents,
    refundedAmountCents: refundedCents,
  })
  const isPaid =
    orderStatus === "completed" || orderStatus === "partially_refunded"
  const refundableTickets = useMemo(
    () => tickets.filter((ticket) => REFUNDABLE_STATUSES.has(ticket.status)),
    [tickets]
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [amountInput, setAmountInput] = useState("0.00")
  const [note, setNote] = useState("")
  const [notifyCustomer, setNotifyCustomer] = useState(true)

  const selectedTickets = refundableTickets.filter((ticket) =>
    selectedIds.includes(ticket.id)
  )
  const selectedPriceCents = selectedTickets.reduce(
    (sum, ticket) => sum + ticket.priceCents,
    0
  )

  function suggestedRefundCents(ticketIds: string[]) {
    if (!isPaid) return 0
    if (ticketIds.length === 0) return 0
    if (ticketIds.length === refundableTickets.length) return remainingCents
    const selectedPrice = refundableTickets
      .filter((ticket) => ticketIds.includes(ticket.id))
      .reduce((sum, ticket) => sum + ticket.priceCents, 0)
    return Math.min(selectedPrice, remainingCents)
  }

  useEffect(() => {
    if (!open) return
    const ids = refundableTickets.map((ticket) => ticket.id)
    setSelectedIds(ids)
    setAmountInput(ticketCentsToDollarInput(suggestedRefundCents(ids)))
    setNote("")
    setNotifyCustomer(true)
  }, [open, refundableTickets, remainingCents, isPaid])

  function toggleTicket(ticketId: string, checked: boolean) {
    const nextIds = checked
      ? [...selectedIds, ticketId]
      : selectedIds.filter((id) => id !== ticketId)
    setSelectedIds(nextIds)
    if (isPaid) {
      setAmountInput(ticketCentsToDollarInput(suggestedRefundCents(nextIds)))
    }
  }

  function handleConfirm() {
    if (selectedIds.length === 0) return
    const amountCents = isPaid
      ? Math.min(dollarsToTicketCents(amountInput) || 0, remainingCents)
      : 0
    onConfirm({
      ticketIds: selectedIds,
      amountCents,
      note,
      notifyCustomer,
    })
  }

  const canSubmit = selectedIds.length > 0 && !pending

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isPaid ? "Cancel or refund" : "Cancel"} order {orderNumber}
          </DialogTitle>
          <DialogDescription>
            {isPaid
              ? `Remaining balance ${formatTicketPrice(remainingCents, currency)} of ${formatTicketPrice(totalCents, currency)}. Unchecked tickets stay valid.`
              : "This unpaid order will be canceled. Selected tickets will no longer be valid."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {refundableTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              There are no remaining tickets to cancel on this order.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Tickets to cancel</Label>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-2">
                {refundableTickets.map((ticket) => (
                  <label
                    key={ticket.id}
                    className="flex items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.includes(ticket.id)}
                      disabled={pending}
                      onCheckedChange={(checked) =>
                        toggleTicket(ticket.id, checked === true)
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{ticket.ticketTypeName}</span>
                      {ticket.attendeeName ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {ticket.attendeeName}
                        </span>
                      ) : null}
                      <span className="block font-mono text-xs text-muted-foreground">
                        {ticket.ticketCode}
                      </span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatTicketPrice(ticket.priceCents, currency)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {isPaid ? (
            <div className="space-y-2">
              <Label htmlFor="ticket-cancel-refund-amount">Refund amount</Label>
              <Input
                id="ticket-cancel-refund-amount"
                type="number"
                min="0"
                step="0.01"
                value={amountInput}
                disabled={pending}
                onChange={(event) => setAmountInput(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Suggested{" "}
                {formatTicketPrice(
                  suggestedRefundCents(selectedIds),
                  currency
                )}
                {selectedIds.length === refundableTickets.length &&
                remainingCents > selectedPriceCents
                  ? " (includes fees so the remaining balance is refunded)"
                  : " from selected ticket prices"}
                . You can edit the amount. Pay-at-event orders are recorded in
                Manaratee only.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="ticket-cancel-note">Note</Label>
            <Textarea
              id="ticket-cancel-note"
              value={note}
              disabled={pending}
              placeholder="Optional note for staff and the customer email"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={notifyCustomer}
              disabled={pending}
              onCheckedChange={(checked) => setNotifyCustomer(checked === true)}
            />
            <span>Email the customer about this cancellation</span>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Close
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            {pending
              ? "Processing..."
              : isPaid
                ? "Refund selected"
                : "Cancel selected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
