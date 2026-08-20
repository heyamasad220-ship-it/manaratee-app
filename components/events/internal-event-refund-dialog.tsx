"use client"

import { useEffect, useState } from "react"

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
  dollarsToTicketCents,
  ticketCentsToDollarInput,
  ticketOrderRemainingCents,
} from "@/lib/tickets/ticket-refund-math"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

export function InternalEventRefundDialog({
  open,
  onOpenChange,
  orderNumber,
  totalCents,
  refundedCents,
  currency,
  pending,
  error,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderNumber: string
  totalCents: number
  refundedCents: number
  currency: string
  pending: boolean
  error: string | null
  onConfirm: (amountCents: number) => void
}) {
  const remainingCents = ticketOrderRemainingCents({
    totalCents,
    refundedAmountCents: refundedCents,
  })
  const [refundFull, setRefundFull] = useState(true)
  const [amountInput, setAmountInput] = useState(ticketCentsToDollarInput(remainingCents))

  useEffect(() => {
    if (!open) return
    setRefundFull(true)
    setAmountInput(ticketCentsToDollarInput(remainingCents))
  }, [open, remainingCents])

  function handleConfirm() {
    const amountCents = refundFull
      ? remainingCents
      : dollarsToTicketCents(amountInput)
    onConfirm(amountCents)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Refund order {orderNumber}</DialogTitle>
          <DialogDescription>
            Remaining balance {formatTicketPrice(remainingCents, currency)} of{" "}
            {formatTicketPrice(totalCents, currency)}. A partial refund keeps
            tickets valid. Refunding the remaining balance cancels every ticket
            on this order.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={refundFull ? "default" : "outline"}
              disabled={pending}
              onClick={() => {
                setRefundFull(true)
                setAmountInput(ticketCentsToDollarInput(remainingCents))
              }}
            >
              Full refund
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!refundFull ? "default" : "outline"}
              disabled={pending}
              onClick={() => setRefundFull(false)}
            >
              Partial refund
            </Button>
          </div>
          {!refundFull ? (
            <div className="space-y-2">
              <Label htmlFor="ticket-refund-amount">Refund amount</Label>
              <Input
                id="ticket-refund-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amountInput}
                disabled={pending}
                onChange={(event) => setAmountInput(event.target.value)}
              />
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={pending || remainingCents <= 0}>
            {pending ? "Processing..." : "Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
