"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileText, Mail, MoreHorizontal, Download, Eye } from "lucide-react"
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

type PaymentReceiptActionsProps = {
  paymentId: string
  receiptNumber?: string | null
  receiptStatus?: string | null
  onUpdated?: () => void
  compact?: boolean
}

export function PaymentReceiptActions({
  paymentId,
  receiptNumber,
  receiptStatus,
  onUpdated,
  compact = false,
}: PaymentReceiptActionsProps) {
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewPayload, setPreviewPayload] = useState<PaymentReceiptPayload | null>(null)
  const [localReceiptNumber, setLocalReceiptNumber] = useState(receiptNumber)
  const [localStatus, setLocalStatus] = useState(receiptStatus)

  async function ensurePayload(): Promise<PaymentReceiptPayload | null> {
    const existing = await getPaymentReceiptAction(paymentId)
    if (existing.success) {
      setLocalReceiptNumber(existing.receipt.receipt_number)
      setLocalStatus(existing.receipt.status)
      return existing.payload
    }

    setLoading(true)
    const generated = await generatePaymentReceiptAction(paymentId)
    setLoading(false)

    if (!generated.success) {
      alert(generated.error || "Could not generate receipt")
      return null
    }

    setLocalReceiptNumber(generated.receipt.receipt_number)
    setLocalStatus(generated.receipt.status)
    onUpdated?.()
    return generated.payload
  }

  async function handleView() {
    const payload = await ensurePayload()
    if (!payload) return
    setPreviewPayload(payload)
    setPreviewOpen(true)
  }

  async function handleDownload() {
    const payload = await ensurePayload()
    if (!payload) return
    const html = buildPaymentReceiptHtml(payload)
    try {
      await downloadReceiptPdf(`receipt-${payload.receiptNumber}.pdf`, html)
    } catch {
      openReceiptPrintWindow(html)
    }
  }

  async function handleSendEmail() {
    const payload = await ensurePayload()
    if (!payload) return

    const existing = await getPaymentReceiptAction(paymentId)
    if (!existing.success) return

    setLoading(true)
    const result = await markReceiptSentAction(
      existing.receipt.id,
      localStatus === "sent" || localStatus === "resent"
    )
    setLoading(false)

    if (!result.success) {
      alert(result.error || "Could not send receipt email")
      return
    }
    setLocalStatus(result.status)
    onUpdated?.()
    alert("Receipt email sent.")
  }

  const label = localReceiptNumber || "Receipt"

  if (compact) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={handleView} disabled={loading}>
          {label}
        </Button>
        <ReceiptPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          payload={previewPayload}
        />
      </>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading}>
            <MoreHorizontal className="mr-2 h-4 w-4" />
            Receipt
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleView}>
            <Eye className="mr-2 h-4 w-4" />
            View receipt
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSendEmail}>
            <Mail className="mr-2 h-4 w-4" />
            {localStatus === "sent" || localStatus === "resent" ? "Re-send receipt email" : "Send receipt email"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReceiptPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        payload={previewPayload}
      />
    </>
  )
}

export function ReceiptPreviewDialog({
  open,
  onOpenChange,
  payload,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: PaymentReceiptPayload | null
}) {
  if (!payload) return null
  const html = buildPaymentReceiptHtml(payload)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Receipt {payload.receiptNumber}
          </DialogTitle>
        </DialogHeader>
        <iframe
          title="Receipt preview"
          srcDoc={html}
          className="h-[70vh] w-full rounded-md border bg-white"
        />
      </DialogContent>
    </Dialog>
  )
}
