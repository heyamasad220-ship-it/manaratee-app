"use client"

import { useState } from "react"
import { Download, Link2, Mail, MoreHorizontal, RotateCcw } from "lucide-react"

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { DonationHistoryRow } from "@/components/donations/donor-donation-history-table"
import {
  generatePaymentReceiptAction,
  getPaymentReceiptAction,
  markReceiptSentAction,
} from "@/lib/donations/receipt-actions"
import type { PaymentReceiptPayload } from "@/lib/donations/receipt-types"
import {
  buildPaymentReceiptHtml,
  downloadReceiptPdf,
  openReceiptPrintWindow,
} from "@/lib/donations/receipt-pdf"
import {
  recordPaymentRefundAction,
  stripeRefundPaymentAction,
} from "@/lib/donations/payment-admin-actions"
import {
  paymentRefundConfirmLabel,
  paymentRefundDialogDescription,
  paymentRefundDialogTitle,
  paymentRefundMenuLabel,
} from "@/lib/donations/payment-admin-copy"

type DonationPaymentRowActionsProps = {
  row: DonationHistoryRow
  onLinkToPledge?: () => void
  onUpdated?: () => void
}

function formatMoney(value: number) {
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function DonationPaymentRowActions({
  row,
  onLinkToPledge,
  onUpdated,
}: DonationPaymentRowActionsProps) {
  const [refundOpen, setRefundOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [refundFull, setRefundFull] = useState(true)

  const { capabilities } = row
  const hasRefund = capabilities.canStripeRefund || capabilities.canRecordRefund
  const refundTitle = paymentRefundDialogTitle()
  const refundMenuLabel = paymentRefundMenuLabel()
  const refundConfirmLabel = paymentRefundConfirmLabel()
  const refundDescription = paymentRefundDialogDescription({
    remainingRefundable: capabilities.remainingRefundable,
    canStripeRefund: capabilities.canStripeRefund,
    stripeRefundBlockedReason: capabilities.stripeRefundBlockedReason,
    formatMoney,
  })

  function openRefundDialog() {
    setError(null)
    setRefundReason("")
    setRefundFull(true)
    setRefundAmount(String(capabilities.remainingRefundable))
    setRefundOpen(true)
  }

  function closeRefundDialog() {
    setRefundOpen(false)
    setError(null)
    setSaving(false)
  }

  async function ensureReceiptPayload(): Promise<PaymentReceiptPayload | null> {
    const existing = await getPaymentReceiptAction(row.id)
    if (existing.success) {
      return existing.payload
    }

    setReceiptLoading(true)
    const generated = await generatePaymentReceiptAction(row.id)
    setReceiptLoading(false)

    if (!generated.success) {
      alert(generated.error || "Could not generate receipt")
      return null
    }

    onUpdated?.()
    return generated.payload
  }

  async function handleDownloadReceipt() {
    const payload = await ensureReceiptPayload()
    if (!payload) return

    const html = buildPaymentReceiptHtml(payload)
    try {
      await downloadReceiptPdf(`receipt-${payload.receiptNumber}.pdf`, html)
    } catch {
      openReceiptPrintWindow(html)
    }
  }

  async function handleEmailReceipt() {
    const payload = await ensureReceiptPayload()
    if (!payload) return

    const existing = await getPaymentReceiptAction(row.id)
    if (!existing.success) return

    setReceiptLoading(true)
    const result = await markReceiptSentAction(
      existing.receipt.id,
      existing.receipt.status === "sent" || existing.receipt.status === "resent"
    )
    setReceiptLoading(false)

    if (!result.success) {
      alert(result.error || "Could not send receipt email")
      return
    }

    onUpdated?.()
    alert("Receipt email sent.")
  }

  async function handleRefund() {
    setSaving(true)
    setError(null)

    const amount = refundFull
      ? capabilities.remainingRefundable
      : Number(refundAmount)

    const result = capabilities.canStripeRefund
      ? await stripeRefundPaymentAction({
          paymentId: row.id,
          refundAmount: amount,
          reason: refundReason,
        })
      : await recordPaymentRefundAction({
          paymentId: row.id,
          refundAmount: amount,
          reason: refundReason,
        })

    setSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    closeRefundDialog()
    onUpdated?.()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={(event) => event.stopPropagation()}
            disabled={receiptLoading || saving}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Payment actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
          {hasRefund ? (
            <DropdownMenuItem
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                openRefundDialog()
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {refundMenuLabel}
            </DropdownMenuItem>
          ) : null}
          {capabilities.canAllocate && onLinkToPledge ? (
            <DropdownMenuItem
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onLinkToPledge()
              }}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Link to Pledge
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={receiptLoading}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void handleDownloadReceipt()
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Receipt
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={receiptLoading}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void handleEmailReceipt()
            }}
          >
            <Mail className="mr-2 h-4 w-4" />
            Email Receipt to Donor
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={refundOpen} onOpenChange={(open) => !open && closeRefundDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{refundTitle}</DialogTitle>
            <DialogDescription>{refundDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={refundFull ? "default" : "outline"}
                onClick={() => {
                  setRefundFull(true)
                  setRefundAmount(String(capabilities.remainingRefundable))
                }}
              >
                Full refund
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!refundFull ? "default" : "outline"}
                onClick={() => setRefundFull(false)}
              >
                Partial refund
              </Button>
            </div>
            {!refundFull ? (
              <div className="space-y-2">
                <Label htmlFor={`refund-amount-${row.id}`}>Refund amount</Label>
                <Input
                  id={`refund-amount-${row.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`refund-reason-${row.id}`}>Reason (optional)</Label>
              <Textarea
                id={`refund-reason-${row.id}`}
                rows={3}
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRefundDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleRefund()} disabled={saving}>
              {saving ? "Processing..." : refundConfirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
