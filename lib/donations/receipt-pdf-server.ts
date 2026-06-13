import { jsPDF } from "jspdf"

import type {
  AnnualGivingStatementPayload,
  PaymentReceiptPayload,
} from "@/lib/donations/receipt-types"

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number) {
  const lines = doc.splitTextToSize(text, maxWidth)
  doc.text(lines, x, y)
  return y + lines.length * 14
}

export function buildPaymentReceiptPdfBase64(payload: PaymentReceiptPayload): string {
  const doc = new jsPDF({ unit: "pt", format: "letter" })
  let y = 48

  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.text(payload.organizationName, 48, y)
  y += 22

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  for (const line of payload.organizationAddress.split("\n")) {
    y = addWrappedText(doc, line, 48, y, 500)
  }

  if (payload.taxId) {
    y += 6
    y = addWrappedText(doc, `Tax ID: ${payload.taxId}`, 48, y, 500)
  }

  y += 18
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text("DONATION RECEIPT", 48, y)
  y += 24

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  const rows: Array<[string, string]> = [
    ["Receipt Number", payload.receiptNumber],
    ["Receipt Date", payload.receiptDate],
    ["Donor", payload.donorName],
    ["Payment Date", payload.paymentDate],
    ["Amount", formatMoney(payload.amount)],
    ["Payment Method", payload.paymentMethod],
  ]

  if (payload.campaignName) rows.push(["Campaign", payload.campaignName])
  if (payload.fundName) rows.push(["Fund", payload.fundName])

  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold")
    doc.text(`${label}:`, 48, y)
    doc.setFont("helvetica", "normal")
    y = addWrappedText(doc, value, 180, y, 360)
    y += 4
  }

  y += 12
  y = addWrappedText(doc, payload.taxDisclaimer || "", 48, y, 500)

  if (payload.signerName) {
    y += 24
    doc.text(payload.signerName, 48, y)
    if (payload.signerTitle) {
      y += 14
      doc.text(payload.signerTitle, 48, y)
    }
  }

  return doc.output("datauristring").split(",")[1] || ""
}

export function buildAnnualStatementPdfBase64(payload: AnnualGivingStatementPayload): string {
  const doc = new jsPDF({ unit: "pt", format: "letter" })
  let y = 48

  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.text(payload.organizationName, 48, y)
  y += 22

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  for (const line of payload.organizationAddress.split("\n")) {
    y = addWrappedText(doc, line, 48, y, 500)
  }

  y += 18
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(`${payload.taxYear} Giving Statement`, 48, y)
  y += 20

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  y = addWrappedText(doc, `Donor: ${payload.donorName}`, 48, y, 500)
  y += 16

  doc.setFont("helvetica", "bold")
  doc.text("Date", 48, y)
  doc.text("Amount", 480, y, { align: "right" })
  y += 14
  doc.setFont("helvetica", "normal")

  for (const item of payload.lineItems) {
    doc.text(item.paymentDate, 48, y)
    doc.text(formatMoney(item.amount), 480, y, { align: "right" })
    y += 14
    if (y > 700) {
      doc.addPage()
      y = 48
    }
  }

  y += 10
  doc.setFont("helvetica", "bold")
  doc.text(`Total Giving: ${formatMoney(payload.totalGiving)}`, 48, y)

  if (payload.footerText) {
    y += 24
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    y = addWrappedText(doc, payload.footerText, 48, y, 500)
  }

  return doc.output("datauristring").split(",")[1] || ""
}
