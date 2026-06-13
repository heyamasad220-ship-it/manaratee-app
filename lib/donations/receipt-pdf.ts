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

export function buildPaymentReceiptHtml(payload: PaymentReceiptPayload): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Donation Receipt ${payload.receiptNumber}</title>
  <style>
    @page { size: letter; margin: 0.75in; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; padding: 24px; }
    .header { text-align: center; margin-bottom: 32px; }
    .org { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
    .address { font-size: 12px; color: #444; white-space: pre-line; }
    .title { font-size: 18px; margin: 24px 0 16px; text-align: center; letter-spacing: 1px; }
    .meta { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .meta td { padding: 8px 0; vertical-align: top; }
    .meta .label { width: 160px; color: #555; }
    .amount { font-size: 20px; font-weight: bold; }
    .footer { margin-top: 40px; font-size: 12px; color: #444; line-height: 1.5; }
    .signature { margin-top: 48px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="org">${escapeHtml(payload.organizationName)}</div>
    <div class="address">${escapeHtml(payload.organizationAddress)}</div>
    ${payload.taxId ? `<div class="address">Tax ID: ${escapeHtml(payload.taxId)}</div>` : ""}
  </div>
  <div class="title">DONATION RECEIPT</div>
  <table class="meta">
    <tr><td class="label">Receipt Number</td><td>${escapeHtml(payload.receiptNumber)}</td></tr>
    <tr><td class="label">Receipt Date</td><td>${escapeHtml(payload.receiptDate)}</td></tr>
    <tr><td class="label">Donor</td><td>${escapeHtml(payload.donorName)}</td></tr>
    <tr><td class="label">Payment Date</td><td>${escapeHtml(payload.paymentDate)}</td></tr>
    <tr><td class="label">Amount</td><td class="amount">${formatMoney(payload.amount)}</td></tr>
    <tr><td class="label">Payment Method</td><td>${escapeHtml(payload.paymentMethod)}</td></tr>
    ${payload.campaignName ? `<tr><td class="label">Campaign</td><td>${escapeHtml(payload.campaignName)}</td></tr>` : ""}
    ${payload.fundName ? `<tr><td class="label">Fund</td><td>${escapeHtml(payload.fundName)}</td></tr>` : ""}
  </table>
  <div class="footer">${escapeHtml(payload.taxDisclaimer || "")}</div>
  ${
    payload.signerName
      ? `<div class="signature">${escapeHtml(payload.signerName)}${payload.signerTitle ? `<br/>${escapeHtml(payload.signerTitle)}` : ""}</div>`
      : ""
  }
</body>
</html>`
}

export function buildAnnualStatementHtml(payload: AnnualGivingStatementPayload): string {
  const rows = payload.lineItems
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.paymentDate)}</td><td style="text-align:right">${formatMoney(item.amount)}</td></tr>`
    )
    .join("")

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${payload.taxYear} Giving Statement</title>
  <style>
    @page { size: letter; margin: 0.75in; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; padding: 24px; }
    .header { text-align: center; margin-bottom: 28px; }
    .org { font-size: 22px; font-weight: bold; }
    .address { font-size: 12px; color: #444; white-space: pre-line; }
    .title { font-size: 18px; margin: 20px 0; text-align: center; }
    .donor { margin: 16px 0; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 8px 4px; border-bottom: 1px solid #ddd; }
    th { text-align: left; color: #555; font-weight: normal; }
    .total { font-weight: bold; font-size: 16px; margin-top: 20px; }
    .footer { margin-top: 36px; font-size: 12px; color: #444; }
  </style>
</head>
<body>
  <div class="header">
    <div class="org">${escapeHtml(payload.organizationName)}</div>
    <div class="address">${escapeHtml(payload.organizationAddress)}</div>
    ${payload.taxId ? `<div class="address">Tax ID: ${escapeHtml(payload.taxId)}</div>` : ""}
  </div>
  <div class="title">${payload.taxYear} Giving Statement</div>
  <div class="donor"><strong>Donor:</strong> ${escapeHtml(payload.donorName)}</div>
  <table>
    <thead><tr><th>Date</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total Giving: ${formatMoney(payload.totalGiving)}</div>
  <div class="footer">${escapeHtml(payload.footerText || "")}</div>
</body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export async function downloadReceiptPdf(filename: string, html: string) {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "pt", format: "letter" })
  const container = document.createElement("div")
  container.innerHTML = html
  container.style.position = "fixed"
  container.style.left = "-9999px"
  document.body.appendChild(container)

  await doc.html(container, {
    x: 24,
    y: 24,
    width: 564,
    windowWidth: 800,
    autoPaging: "text",
  })

  document.body.removeChild(container)
  doc.save(filename)
}

export function openReceiptPrintWindow(html: string) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=800,height=1000")
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}
