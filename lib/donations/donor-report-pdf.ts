import type { DonorSummaryReportRow } from "@/lib/donations/donation-list-actions"
import { downloadReceiptPdf } from "@/lib/donations/receipt-pdf"
import { formatPhoneDisplayOrDash } from "@/lib/ui/format-phone"

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function formatReportDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export type DonorGivingReportPdfInput = {
  organizationName: string
  organizationAddress: string
  taxId?: string | null
  periodLabel: string
  generatedAt: string
  filterSummary: string
  summary: {
    donorCount: number
    totalGiven: number
    giftCount: number
  }
  donors: DonorSummaryReportRow[]
}

export function buildDonorGivingReportHtml(input: DonorGivingReportPdfInput): string {
  const rows = input.donors
    .map(
      (donor) => `<tr>
        <td>${escapeHtml(donor.full_name || "Unnamed")}</td>
        <td>${escapeHtml(donor.email || "—")}</td>
        <td>${escapeHtml(formatPhoneDisplayOrDash(donor.phone))}</td>
        <td style="text-align:right">${formatMoney(Number(donor.total_donations || 0))}</td>
        <td style="text-align:right">${donor.donation_count ?? 0}</td>
        <td>${escapeHtml(formatReportDate(donor.last_donation_date))}</td>
      </tr>`
    )
    .join("")

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Donor Giving Report</title>
  <style>
    @page { size: letter; margin: 0.6in; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 0; padding: 16px; font-size: 11px; }
    .header { text-align: center; margin-bottom: 20px; }
    .org { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
    .address { font-size: 11px; color: #444; white-space: pre-line; }
    .title { font-size: 16px; margin: 16px 0 8px; text-align: center; letter-spacing: 0.5px; }
    .meta { font-size: 11px; color: #555; margin-bottom: 12px; line-height: 1.5; }
    .summary { display: flex; gap: 24px; margin: 12px 0 18px; font-size: 12px; }
    .summary-item strong { display: block; font-size: 14px; color: #111; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px 4px; border-bottom: 1px solid #ddd; vertical-align: top; }
    th { text-align: left; color: #555; font-weight: normal; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
    td.num, th.num { text-align: right; }
    .footer { margin-top: 24px; font-size: 10px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="org">${escapeHtml(input.organizationName)}</div>
    <div class="address">${escapeHtml(input.organizationAddress)}</div>
    ${input.taxId ? `<div class="address">Tax ID: ${escapeHtml(input.taxId)}</div>` : ""}
  </div>
  <div class="title">DONOR GIVING REPORT</div>
  <div class="meta">
    <div><strong>Period:</strong> ${escapeHtml(input.periodLabel)}</div>
    <div><strong>Generated:</strong> ${escapeHtml(new Date(input.generatedAt).toLocaleString("en-US"))}</div>
    <div><strong>Filters:</strong> ${escapeHtml(input.filterSummary)}</div>
  </div>
  <div class="summary">
    <div class="summary-item">Donors<strong>${input.summary.donorCount.toLocaleString()}</strong></div>
    <div class="summary-item">Total Given<strong>${formatMoney(input.summary.totalGiven)}</strong></div>
    <div class="summary-item">Gifts<strong>${input.summary.giftCount.toLocaleString()}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Donor</th>
        <th>Email</th>
        <th>Phone</th>
        <th class="num">Total Given</th>
        <th class="num">Gifts</th>
        <th>Last Gift</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">${input.donors.length} donor(s) shown. Amounts from non-voided payments.</div>
</body>
</html>`
}

export async function downloadDonorGivingReportPdf(
  input: DonorGivingReportPdfInput,
  filename?: string
) {
  const html = buildDonorGivingReportHtml(input)
  const dateStamp = input.generatedAt.slice(0, 10)
  await downloadReceiptPdf(filename || `donor-giving-report-${dateStamp}.pdf`, html)
}
