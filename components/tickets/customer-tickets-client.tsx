"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Download, Loader2, QrCode, Ticket } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resumeCustomerTicketCheckout, cancelCustomerPendingTicketOrder } from "@/lib/tickets/customer-ticket-actions"
import {
  buildTicketCodeQrUrl,
  customerOrderStatusLabel,
  customerTicketStatusLabel,
  type CustomerTicketOrder,
} from "@/lib/tickets/customer-ticket-types"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

function formatWhen(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function partitionOrders(orders: CustomerTicketOrder[]) {
  const now = Date.now()
  const upcoming: CustomerTicketOrder[] = []
  const past: CustomerTicketOrder[] = []
  for (const order of orders) {
    const startMs = order.eventStartAt ? new Date(order.eventStartAt).getTime() : null
    if (startMs != null && startMs < now) past.push(order)
    else upcoming.push(order)
  }
  return { upcoming, past }
}

function OrderCard({
  order,
  onPay,
  onCancel,
  busyOrderId,
}: {
  order: CustomerTicketOrder
  onPay: (orderId: string) => void
  onCancel: (orderId: string) => void
  busyOrderId: string | null
}) {
  const busy = busyOrderId === order.id
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function copyCode(ticketId: string, code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(ticketId)
    } catch {
      setCopiedId(null)
    }
  }

  async function downloadQr(ticketId: string, code: string) {
    setDownloadingId(ticketId)
    try {
      const response = await fetch(buildTicketCodeQrUrl(code, 480))
      if (!response.ok) throw new Error("Could not download QR image.")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `ticket-${code}.png`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      window.open(buildTicketCodeQrUrl(code, 480), "_blank", "noopener,noreferrer")
    } finally {
      setDownloadingId(null)
    }
  }
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{order.eventName}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatWhen(order.eventStartAt) || "Date to be announced"}
            </p>
            {order.eventLocation ? (
              <p className="text-sm text-muted-foreground">{order.eventLocation}</p>
            ) : null}
          </div>
          <Badge variant={order.status === "pending" ? "outline" : "secondary"}>
            {customerOrderStatusLabel(order.status)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Order {order.orderNumber}
          {order.totalCents > 0
            ? ` · ${formatTicketPrice(order.totalCents, order.currency)}`
            : " · Free"}
          {order.paymentMethod ? ` · ${order.paymentMethod}` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.status === "pending" ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Payment is still due. Complete card checkout if available, or pay at
            the event.
          </p>
        ) : null}
        {order.status === "refunded" ? (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            This order was refunded. These tickets are no longer valid for check-in.
          </p>
        ) : null}
        {order.status === "partially_refunded" ? (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            A partial refund of{" "}
            {formatTicketPrice(order.refundedCents, order.currency)} was issued.
            These tickets remain valid for check-in.
          </p>
        ) : null}

        <ul className="grid gap-4 sm:grid-cols-2">
          {order.tickets.map((ticket) => {
            const inactive =
              ticket.status === "refunded" || ticket.status === "canceled"
            return (
            <li
              key={ticket.id}
              className="flex gap-3 rounded-lg border border-border p-3"
            >
              {ticket.ticketCode && !inactive ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={buildTicketCodeQrUrl(ticket.ticketCode)}
                  alt={`QR code for ${ticket.ticketCode}`}
                  className="h-24 w-24 shrink-0 rounded-md bg-white"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-md bg-muted">
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium">{ticket.ticketTypeName}</p>
                <p className="text-sm text-muted-foreground">
                  {ticket.attendeeName || "Guest"}
                </p>
                <p className="mt-1 font-mono text-sm tracking-wide">
                  {ticket.ticketCode || "—"}
                </p>
                {ticket.ticketCode ? (
                  <div className="mt-1 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="text-xs font-medium text-teal-800 hover:underline"
                      onClick={() => copyCode(ticket.id, ticket.ticketCode)}
                    >
                      {copiedId === ticket.id ? "Copied" : "Copy code"}
                    </button>
                    {!inactive ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:underline"
                        onClick={() => downloadQr(ticket.id, ticket.ticketCode)}
                        disabled={downloadingId === ticket.id}
                      >
                        {downloadingId === ticket.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        Download QR
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <Badge variant="secondary" className="mt-2">
                  {customerTicketStatusLabel(ticket.status)}
                </Badge>
              </div>
            </li>
            )
          })}
        </ul>

        <div className="flex flex-wrap gap-2">
          {order.canResumeCheckout ? (
            <Button
              type="button"
              disabled={busy}
              onClick={() => onPay(order.id)}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Working…
                </>
              ) : (
                "Complete payment"
              )}
            </Button>
          ) : null}
          {order.status === "pending" ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onCancel(order.id)}
            >
              Cancel reservation
            </Button>
          ) : null}
          {order.publicEventPath ? (
            <Button asChild type="button" variant="outline">
              <Link href={order.publicEventPath}>Event page</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function CustomerTicketsClient({
  orders,
  checkout,
  orderNumber,
}: {
  orders: CustomerTicketOrder[]
  checkout?: string
  orderNumber?: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { upcoming, past } = useMemo(() => partitionOrders(orders), [orders])

  function handlePay(orderId: string) {
    setError(null)
    setBusyOrderId(orderId)
    startTransition(async () => {
      const result = await resumeCustomerTicketCheckout({ orderId })
      setBusyOrderId(null)
      if (!result.success) {
        setError(result.error)
        return
      }
      window.location.assign(result.checkoutUrl)
    })
  }

  function handleCancel(orderId: string) {
    if (!window.confirm("Cancel this unpaid reservation and release the seats?")) {
      return
    }
    setError(null)
    setBusyOrderId(orderId)
    startTransition(async () => {
      const result = await cancelCustomerPendingTicketOrder({ orderId })
      setBusyOrderId(null)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Tickets</h1>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          Bring your ticket code or QR to check in. Paid orders stay listed here
          after checkout.
        </p>
      </div>

      {checkout === "success" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Payment received
          {orderNumber ? ` for order ${orderNumber}` : ""}. Your tickets are
          below.
        </div>
      ) : null}
      {checkout === "cancelled" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Checkout was cancelled. Complete payment here, or cancel the
          reservation to release the seats.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[240px] flex-col items-center justify-center p-8 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">No tickets yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              When you register for a public event, your tickets and QR codes
              will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Upcoming</h2>
              {upcoming.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPay={handlePay}
                  onCancel={handleCancel}
                  busyOrderId={isPending ? busyOrderId : null}
                />
              ))}
            </section>
          ) : null}
          {past.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Past</h2>
              {past.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPay={handlePay}
                  onCancel={handleCancel}
                  busyOrderId={isPending ? busyOrderId : null}
                />
              ))}
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
