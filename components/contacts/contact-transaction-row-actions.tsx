"use client"

import { useState } from "react"
import { Download, Mail, MoreHorizontal, RotateCcw } from "lucide-react"

import { DonationPaymentRowActions } from "@/components/donations/donation-payment-row-actions"
import type { DonationHistoryRow } from "@/components/donations/donor-donation-history-table"
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
import type { ContactFinancialTimelineEvent } from "@/lib/contacts/contact-financial-types"
import { downloadReceiptPdf, openReceiptPrintWindow } from "@/lib/donations/receipt-pdf"
import { refundProgramSchedulePaymentAction } from "@/lib/programs/program-payment-refund-actions"

type ContactTransactionRowActionsProps = {
  event: ContactFinancialTimelineEvent
  contactName: string
  contactEmail?: string | null
  donationRow?: DonationHistoryRow | null
  onLinkToPledge?: () => void
  onUpdated?: () => void
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function buildModuleReceiptHtml(input: {
  contactName: string
  contactEmail?: string | null
  event: ContactFinancialTimelineEvent
}) {
  const amount = Number(input.event.amount || 0)
  const dateLabel = new Date(input.event.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payment Receipt</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; padding: 24px; }
    .title { font-size: 18px; margin: 24px 0 16px; text-align: center; letter-spacing: 1px; }
    .meta { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .meta td { padding: 8px 0; vertical-align: top; }
    .meta .label { width: 160px; color: #555; }
    .amount { font-size: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="title">PAYMENT RECEIPT</div>
  <table class="meta">
    <tr><td class="label">Payee</td><td>${escapeHtml(input.contactName)}</td></tr>
    ${
      input.contactEmail
        ? `<tr><td class="label">Email</td><td>${escapeHtml(input.contactEmail)}</td></tr>`
        : ""
    }
    <tr><td class="label">Date</td><td>${escapeHtml(dateLabel)}</td></tr>
    <tr><td class="label">Type</td><td>${escapeHtml(input.event.eventType)}</td></tr>
    <tr><td class="label">Description</td><td>${escapeHtml(input.event.description)}</td></tr>
    <tr><td class="label">Amount</td><td class="amount">${escapeHtml(formatMoney(amount))}</td></tr>
    <tr><td class="label">Status</td><td>${escapeHtml(input.event.status || "Succeeded")}</td></tr>
  </table>
</body>
</html>`
}

function getProgramScheduleId(event: ContactFinancialTimelineEvent) {
  if (!event.id.startsWith("program-payment-")) return null
  const id = event.id.slice("program-payment-".length)
  // Enrollment-id fallback rows are not schedule ids; refund action validates UUID ownership.
  return id || null
}

export function ContactTransactionRowActions({
  event,
  contactName,
  contactEmail,
  donationRow,
  onLinkToPledge,
  onUpdated,
}: ContactTransactionRowActionsProps) {
  if (donationRow) {
    return (
      <DonationPaymentRowActions
        row={donationRow}
        onLinkToPledge={onLinkToPledge}
        onUpdated={onUpdated}
        emailReceiptLabel="Email Receipt"
        alwaysShowRefund
      />
    )
  }

  return (
    <ModuleTransactionRowActions
      event={event}
      contactName={contactName}
      contactEmail={contactEmail}
      onUpdated={onUpdated}
    />
  )
}

function ModuleTransactionRowActions({
  event,
  contactName,
  contactEmail,
  onUpdated,
}: {
  event: ContactFinancialTimelineEvent
  contactName: string
  contactEmail?: string | null
  onUpdated?: () => void
}) {
  const [refundOpen, setRefundOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refundAmount, setRefundAmount] = useState(String(event.amount || 0))
  const [refundReason, setRefundReason] = useState("")
  const [refundFull, setRefundFull] = useState(true)

  const amount = Number(event.amount || 0)
  const scheduleId = getProgramScheduleId(event)
  const canProgramRefund =
    event.sourceModule === "programs" && Boolean(scheduleId) && amount > 0

  async function handleDownloadReceipt() {
    setBusy(true)
    const html = buildModuleReceiptHtml({ contactName, contactEmail, event })
    try {
      await downloadReceiptPdf(
        `receipt-${event.id}.pdf`,
        html
      )
    } catch {
      openReceiptPrintWindow(html)
    } finally {
      setBusy(false)
    }
  }

  async function handleEmailReceipt() {
    if (!contactEmail) {
      alert("This contact does not have an email address on file.")
      return
    }

    setBusy(true)
    const html = buildModuleReceiptHtml({ contactName, contactEmail, event })
    const subject = encodeURIComponent(`Payment receipt — ${event.description}`)
    const body = encodeURIComponent(
      `Hello ${contactName},\n\nPlease find your payment receipt details below.\n\nDate: ${new Date(event.date).toLocaleDateString()}\nAmount: ${formatMoney(amount)}\nDescription: ${event.description}\n\n(A printable receipt was also opened for download.)`
    )
    openReceiptPrintWindow(html)
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`
    setBusy(false)
  }

  function openRefundDialog() {
    if (!canProgramRefund) {
      alert(
        event.sourceModule === "programs"
          ? "This payment cannot be refunded from here. Open the registration to manage fees."
          : "Refunds for this transaction type are managed from the source module record."
      )
      return
    }
    setError(null)
    setRefundReason("")
    setRefundFull(true)
    setRefundAmount(String(amount))
    setRefundOpen(true)
  }

  async function handleRefund() {
    if (!scheduleId) return
    setSaving(true)
    setError(null)

    const result = await refundProgramSchedulePaymentAction({
      scheduleId,
      refundAmount: refundFull ? amount : Number(refundAmount),
      reason: refundReason,
    })

    setSaving(false)
    if (!result.success) {
      setError(result.error || "Could not refund payment")
      return
    }

    setRefundOpen(false)
    onUpdated?.()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={(eventClick) => eventClick.stopPropagation()}
            disabled={busy || saving}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Transaction actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(eventClick) => eventClick.stopPropagation()}>
          <DropdownMenuItem
            onClick={(eventClick) => {
              eventClick.preventDefault()
              eventClick.stopPropagation()
              openRefundDialog()
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Refund
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy}
            onClick={(eventClick) => {
              eventClick.preventDefault()
              eventClick.stopPropagation()
              void handleDownloadReceipt()
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Receipt
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy}
            onClick={(eventClick) => {
              eventClick.preventDefault()
              eventClick.stopPropagation()
              void handleEmailReceipt()
            }}
          >
            <Mail className="mr-2 h-4 w-4" />
            Email Receipt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={refundOpen} onOpenChange={(open) => !open && setRefundOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refund</DialogTitle>
            <DialogDescription>
              Record a refund for this program payment. Up to {formatMoney(amount)} can be refunded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={refundFull ? "default" : "outline"}
                onClick={() => {
                  setRefundFull(true)
                  setRefundAmount(String(amount))
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
                <Label htmlFor={`module-refund-amount-${event.id}`}>Refund amount</Label>
                <Input
                  id={`module-refund-amount-${event.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundAmount}
                  onChange={(eventChange) => setRefundAmount(eventChange.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`module-refund-reason-${event.id}`}>Reason (optional)</Label>
              <Textarea
                id={`module-refund-reason-${event.id}`}
                rows={3}
                value={refundReason}
                onChange={(eventChange) => setRefundReason(eventChange.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleRefund()} disabled={saving}>
              {saving ? "Processing..." : "Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
