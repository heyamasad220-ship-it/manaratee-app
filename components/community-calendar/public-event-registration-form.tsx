"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createPublicEventRegistration } from "@/lib/tickets/ticket-order-actions"
import type { PublicEventOffering } from "@/lib/community-calendar/public-queries"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

export function PublicEventRegistrationForm({
  orgSlug,
  eventId,
  offerings,
  defaultName,
  defaultEmail,
}: {
  orgSlug: string
  eventId: string
  offerings: PublicEventOffering[]
  defaultName: string
  defaultEmail: string
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(offerings.map((row) => [row.id, "0"]))
  )
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const buyable = offerings.filter((row) => row.onSale)
  const estimatedTotal = useMemo(() => {
    return offerings.reduce((sum, row) => {
      const qty = Number.parseInt(quantities[row.id] || "0", 10)
      if (!Number.isFinite(qty) || qty <= 0) return sum
      return sum + row.priceCents * qty
    }, 0)
  }, [offerings, quantities])

  if (buyable.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-500">
        Registration is not open for any offerings right now.
      </p>
    )
  }

  function handleSubmit() {
    setError(null)
    setSuccess(null)
    const lines = offerings
      .map((row) => ({
        ticketTypeId: row.id,
        quantity: Number.parseInt(quantities[row.id] || "0", 10) || 0,
      }))
      .filter((line) => line.quantity > 0)

    startTransition(async () => {
      const result = await createPublicEventRegistration({
        orgSlug,
        eventId,
        purchaserName: name,
        purchaserEmail: email,
        lines,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl)
        return
      }
      const parts = [`Order ${result.orderNumber} confirmed.`]
      if (result.pendingPayment) {
        parts.push("Paid tickets are reserved — payment will be collected at the event.")
      }
      if (result.waitlisted) {
        parts.push("Some seats were waitlisted because this offering is full.")
      }
      setSuccess(parts.join(" "))
      setQuantities(Object.fromEntries(offerings.map((row) => [row.id, "0"])))
    })
  }

  return (
    <div className="mt-5 space-y-4">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p>{success}</p>
          <p className="mt-1">
            <Link href="/customer/tickets" className="font-medium underline">
              View my tickets
            </Link>
          </p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {offerings.map((row) => {
          const maxQty =
            row.maxPerOrder ??
            (row.quantityRemaining != null ? row.quantityRemaining : 20)
          return (
            <li
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900">{row.name}</p>
                <p className="text-sm text-zinc-600">
                  {row.priceCents === 0 ? "Free" : formatTicketPrice(row.priceCents)}
                  {row.quantityRemaining != null
                    ? ` · ${row.quantityRemaining} left`
                    : ""}
                </p>
                {row.description ? (
                  <p className="mt-1 text-xs text-zinc-500">{row.description}</p>
                ) : null}
                {!row.onSale && row.closedReason ? (
                  <p className="mt-1 text-xs text-amber-700">{row.closedReason}</p>
                ) : null}
              </div>
              <div className="w-24">
                <Label htmlFor={`qty-${row.id}`} className="sr-only">
                  Quantity for {row.name}
                </Label>
                <Input
                  id={`qty-${row.id}`}
                  type="number"
                  min={0}
                  max={Math.max(0, maxQty)}
                  disabled={!row.onSale || isPending}
                  value={quantities[row.id] ?? "0"}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [row.id]: event.target.value,
                    }))
                  }
                />
              </div>
            </li>
          )
        })}
      </ul>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="reg-name">Name</Label>
          <Input
            id="reg-name"
            value={name}
            disabled={isPending}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-email">Email</Label>
          <Input
            id="reg-email"
            type="email"
            value={email}
            disabled={isPending}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-800">
          Total {formatTicketPrice(estimatedTotal)}
        </p>
        <Button
          type="button"
          className="bg-teal-800 hover:bg-teal-900"
          disabled={isPending}
          onClick={handleSubmit}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registering…
            </>
          ) : (
            estimatedTotal > 0 ? "Continue to payment" : "Complete registration"
          )}
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        Free tickets are confirmed immediately. Paid tickets go to secure card
        checkout when the organization has Stripe connected; otherwise they are
        reserved for payment at the event.
      </p>
    </div>
  )
}
