"use client"

import { useEffect, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, Eye, Mail, MoreHorizontal } from "lucide-react"
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
  /** When set, uses this tax year and hides the local year picker (e.g. Reports → Receipts). */
  year?: number
  /** Icon-only ⋯ menu for table rows. */
  menuOnly?: boolean
}

export function GivingStatementActions({
  donorId,
  donorName,
  defaultYear = new Date().getFullYear(),
  year: controlledYear,
  menuOnly = false,
}: GivingStatementActionsProps) {
  const [internalYear, setInternalYear] = useState(String(controlledYear ?? defaultYear))
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [payload, setPayload] = useState<AnnualGivingStatementPayload | null>(null)

  const taxYear = controlledYear ?? Number(internalYear)
  const yearOptions = [defaultYear, defaultYear - 1, defaultYear - 2]

  useEffect(() => {
    if (controlledYear != null) {
      setInternalYear(String(controlledYear))
    }
  }, [controlledYear])

  async function loadStatement() {
    setLoading(true)
    const result = await generateAnnualStatementAction(donorId, taxYear)
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
    const result = await sendAnnualStatementEmailAction(donorId, taxYear)
    setLoading(false)

    if (!result.success) {
      alert(result.error || "Could not send giving statement email")
      return
    }

    setPayload(result.payload)
    alert("Year-end giving statement email sent.")
  }

  const menu = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={loading}
            aria-label={`Statement actions for ${donorName}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleView}>
            <Eye className="mr-2 h-4 w-4" />
            View statement
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSendEmail}>
            <Mail className="mr-2 h-4 w-4" />
            Send statement email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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

  if (menuOnly) {
    return menu
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {controlledYear == null ? (
        <Select value={internalYear} onValueChange={setInternalYear}>
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
      ) : null}
      {menu}
    </div>
  )
}
