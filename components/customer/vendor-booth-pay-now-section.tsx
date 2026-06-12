"use client"

import { useState, useTransition } from "react"
import { CalendarDays, CreditCard, Loader2, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { payVendorBoothFee } from "@/lib/vendor-hub/vendor-booth-payment-actions"
import type { VendorBoothPaymentDue } from "@/lib/vendor-hub/vendor-portal-types"

function formatDate(value: string | null) {
  if (!value) return "Date not set"
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

export function PayBoothFeeDialog({
  item,
  open,
  onOpenChange,
}: {
  item: VendorBoothPaymentDue
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isFree = item.balanceDue <= 0

  const handlePay = () => {
    setError(null)
    startTransition(async () => {
      try {
        await payVendorBoothFee({
          assignmentId: item.assignmentId,
          paymentMethod: "online",
        })
        onOpenChange(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment could not be completed.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isFree ? "Confirm booth" : "Pay booth fee"}</DialogTitle>
          <DialogDescription>
            {item.eventName} · {item.organizationName}
            {item.boothNumber ? ` · Booth ${item.boothNumber}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Booth fee</span>
            <span className="font-medium">{formatCurrency(item.feeAmount)}</span>
          </div>
          {item.paidAmount > 0 ? (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">Already paid</span>
              <span className="font-medium">{formatCurrency(item.paidAmount)}</span>
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between border-t pt-2">
            <span className="font-medium">{isFree ? "Due today" : "Balance due"}</span>
            <span className="text-lg font-semibold">{formatCurrency(item.balanceDue)}</span>
          </div>
        </div>

        {!isFree ? (
          <p className="text-xs text-muted-foreground">
            Your payment is recorded immediately and appears on the organizer&apos;s payments tab.
            Card processing via Stripe will be added in a future update.
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handlePay} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : isFree ? (
              "Confirm booth"
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PaymentDueRow({ item }: { item: VendorBoothPaymentDue }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const needsAction = item.balanceDue > 0 || item.assignmentStatus === "reserved"

  if (!needsAction) {
    return null
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{item.eventName}</p>
            <Badge variant="outline" className="border-amber-300 bg-white text-amber-800">
              Payment due
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{item.organizationName}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {item.eventDate ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(item.eventDate)}
              </span>
            ) : null}
            {item.boothNumber ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Booth {item.boothNumber}
              </span>
            ) : null}
            <span className="font-medium text-foreground">
              {item.balanceDue > 0
                ? formatCurrency(item.balanceDue)
                : "No fee — confirm to finalize"}
            </span>
          </div>
        </div>
        <Button className="shrink-0" onClick={() => setDialogOpen(true)}>
          {item.balanceDue > 0 ? "Pay now" : "Confirm booth"}
        </Button>
      </div>
      <PayBoothFeeDialog item={item} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

export function VendorPaymentDueSection({ items }: { items: VendorBoothPaymentDue[] }) {
  const actionable = items.filter(
    (item) => item.balanceDue > 0 || item.assignmentStatus === "reserved"
  )

  if (actionable.length === 0) {
    return null
  }

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Complete your reservations
        </CardTitle>
        <CardDescription>
          Pay booth fees to finalize your spot. Unpaid reservations may be released by the
          organizer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {actionable.map((item) => (
          <PaymentDueRow key={item.assignmentId} item={item} />
        ))}
      </CardContent>
    </Card>
  )
}
