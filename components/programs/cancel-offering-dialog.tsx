"use client"

import { useEffect, useState } from "react"

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
import { Label } from "@/components/ui/label"
import {
  cancelOfferingWithStudentsAction,
  getCancelOfferingImpactAction,
  type CancelOfferingImpact,
} from "@/lib/programs/cancel-offering-with-students-actions"

function money(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function CancelOfferingDialog({
  offeringId,
  offeringName,
  open,
  onOpenChange,
  onCancelled,
}: {
  offeringId: string | null
  offeringName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCancelled: (message: string) => void
}) {
  const [impact, setImpact] = useState<CancelOfferingImpact | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refundPayments, setRefundPayments] = useState(true)

  useEffect(() => {
    if (!open || !offeringId) {
      setImpact(null)
      setError(null)
      setRefundPayments(true)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void getCancelOfferingImpactAction(offeringId).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.success) {
        setError(result.error)
        setImpact(null)
        return
      }
      setImpact(result.data)
      setRefundPayments(result.data.received > 0.009)
    })
    return () => {
      cancelled = true
    }
  }, [open, offeringId])

  const previewNames = impact?.students.slice(0, 8) ?? []
  const extraCount = Math.max((impact?.studentCount ?? 0) - previewNames.length, 0)

  async function handleConfirm() {
    if (!offeringId) return
    setBusy(true)
    setError(null)
    const result = await cancelOfferingWithStudentsAction({
      offeringId,
      refundPayments: Boolean(impact && impact.received > 0.009 && refundPayments),
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    const refunded =
      impact && impact.received > 0.009 && refundPayments
        ? ` Refunded ${money(impact.received)}.`
        : ""
    onCancelled(
      result.unenrolled > 0
        ? `Cancelled ${offeringName} and unenrolled ${result.unenrolled} student${result.unenrolled === 1 ? "" : "s"}.${refunded}`
        : `Cancelled ${offeringName}.`
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel offering</DialogTitle>
          <DialogDescription>
            Families will no longer see {offeringName}. This cannot be undone from
            this screen.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking enrollments…</p>
        ) : impact ? (
          <div className="space-y-3 text-sm">
            <p>
              {impact.studentCount === 0
                ? "No enrolled students."
                : `${impact.studentCount} student${impact.studentCount === 1 ? "" : "s"} will be unenrolled.`}
              {impact.waitlistCount > 0
                ? ` ${impact.waitlistCount} waitlisted ${impact.waitlistCount === 1 ? "person" : "people"} will be removed.`
                : ""}
            </p>
            {previewNames.length > 0 ? (
              <ul className="max-h-40 overflow-y-auto rounded-md border px-3 py-2 text-muted-foreground">
                {previewNames.map((row) => (
                  <li key={row.enrollmentId} className="flex justify-between gap-3 py-0.5">
                    <span>{row.name}</span>
                    <span className="tabular-nums">
                      {row.paid > 0.009 ? money(row.paid) : "—"}
                    </span>
                  </li>
                ))}
                {extraCount > 0 ? (
                  <li className="pt-1">and {extraCount} more</li>
                ) : null}
              </ul>
            ) : null}
            {impact.received > 0.009 ? (
              <div className="flex items-start gap-2 rounded-md border p-3">
                <Checkbox
                  id="refund-offering-payments"
                  checked={refundPayments}
                  onCheckedChange={(value) => setRefundPayments(value === true)}
                  disabled={busy}
                />
                <Label htmlFor="refund-offering-payments" className="leading-snug">
                  Refund {money(impact.received)} received
                  {impact.outstanding > 0.009
                    ? `. Remaining balances (${money(impact.outstanding)}) will be written off.`
                    : "."}
                </Label>
              </div>
            ) : impact.outstanding > 0.009 ? (
              <p className="text-muted-foreground">
                Unpaid balances ({money(impact.outstanding)}) will be written off.
              </p>
            ) : null}
            {impact.received > 0.009 && !refundPayments ? (
              <p className="text-muted-foreground">
                Payments already received will stay on the account. Remaining
                balances will be written off.
              </p>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Keep offering
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={busy || loading || !impact}
          >
            {busy ? "Cancelling…" : "Cancel offering"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
