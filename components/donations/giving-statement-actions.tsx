"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, FileText, Mail } from "lucide-react"
import {
  generateAnnualStatementAction,
  sendAnnualStatementEmailAction,
} from "@/lib/donations/receipt-actions"
import type { AnnualGivingStatementPayload } from "@/lib/donations/receipt-types"
import {
  buildAnnualStatementHtml,
  downloadReceiptPdf,
  openReceiptPrintWindow,
} from "@/lib/donations/receipt-pdf"

type GivingStatementActionsProps = {
  donorId: string
  donorName: string
  defaultYear?: number
}

export function GivingStatementActions({
  donorId,
  donorName,
  defaultYear = new Date().getFullYear(),
}: GivingStatementActionsProps) {
  const [year, setYear] = useState(String(defaultYear))
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [payload, setPayload] = useState<AnnualGivingStatementPayload | null>(null)

  const yearOptions = [defaultYear, defaultYear - 1, defaultYear - 2]

  async function loadStatement() {
    setLoading(true)
    const result = await generateAnnualStatementAction(donorId, Number(year))
    setLoading(false)
    if (!result.success) {
      alert(result.error || "Could not generate giving statement")
      return null
    }
    setPayload(result.payload)
    return result.payload
  }

  async function handleView() {
    const data = await loadStatement()
    if (data) setPreviewOpen(true)
  }

  async function handleDownload() {
    const data = payload || (await loadStatement())
    if (!data) return
    const html = buildAnnualStatementHtml(data)
    try {
      await downloadReceiptPdf(`giving-statement-${donorName}-${data.taxYear}.pdf`, html)
    } catch {
      openReceiptPrintWindow(html)
    }
  }

  async function handleSendEmail() {
    setLoading(true)
    const result = await sendAnnualStatementEmailAction(donorId, Number(year))
    setLoading(false)

    if (!result.success) {
      alert(result.error || "Could not send giving statement email")
      return
    }

    setPayload(result.payload)
    alert("Year-end giving statement email sent.")
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleView} disabled={loading}>
          <FileText className="mr-2 h-4 w-4" />
          View Statement
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleSendEmail} disabled={loading}>
          <Mail className="mr-2 h-4 w-4" />
          Send Email
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {payload?.taxYear} Giving Statement — {donorName}
            </DialogTitle>
          </DialogHeader>
          {payload && (
            <iframe
              title="Giving statement preview"
              srcDoc={buildAnnualStatementHtml(payload)}
              className="h-[70vh] w-full rounded-md border bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
