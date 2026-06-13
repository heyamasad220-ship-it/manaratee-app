import type {
  AnnualGivingStatementPayload,
  DonationReceiptSettings,
  PaymentReceiptPayload,
} from "@/lib/donations/receipt-types"
import {
  DEFAULT_RECEIPT_EMAIL_TEMPLATE,
  DEFAULT_YEAR_END_STATEMENT_EMAIL_TEMPLATE,
} from "@/lib/donations/receipt-types"
import type { PledgeReminderMessage } from "@/lib/donations/pledge-reminder-types"

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function applyTemplate(template: string, replacements: Record<string, string>) {
  let result = template
  for (const [token, value] of Object.entries(replacements)) {
    result = result.replaceAll(token, value)
  }
  return result
}

export function wrapDonationBrandedEmailHtml(input: {
  organizationName: string
  title: string
  bodyHtml: string
  footerText?: string | null
}) {
  const org = escapeHtml(input.organizationName)
  const title = escapeHtml(input.title)
  const footer = input.footerText
    ? `<p style="margin-top:24px;font-size:12px;color:#64748b;">${escapeHtml(input.footerText).replaceAll("\n", "<br />")}</p>`
    : ""

  return `<!DOCTYPE html>
<html>
  <body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#0f172a;margin:0;padding:24px;background:#f8fafc;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;">
      <p style="color:#64748b;font-size:14px;margin:0 0 8px;">${org}</p>
      <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
      <div style="font-size:15px;">${input.bodyHtml}</div>
      ${footer}
    </div>
  </body>
</html>`
}

export function renderReceiptEmail(settings: DonationReceiptSettings, payload: PaymentReceiptPayload) {
  const template =
    settings.receipt_email_template?.trim() || DEFAULT_RECEIPT_EMAIL_TEMPLATE

  const replacements = {
    "{{donor_name}}": payload.donorName,
    "{{amount}}": formatMoney(payload.amount),
    "{{payment_date}}": payload.paymentDate,
    "{{receipt_number}}": payload.receiptNumber,
    "{{organization_name}}": payload.organizationName,
    "{{campaign_name}}": payload.campaignName || "General",
    "{{fund_name}}": payload.fundName || "General Fund",
  }

  const bodyText = applyTemplate(template, replacements)
  const subject = `Donation receipt ${payload.receiptNumber} — ${payload.organizationName}`
  const bodyHtml = escapeHtml(bodyText).replaceAll("\n", "<br />")
  const html = wrapDonationBrandedEmailHtml({
    organizationName: payload.organizationName,
    title: "Thank you for your donation",
    bodyHtml: `<p>${bodyHtml}</p>`,
    footerText: settings.receipt_footer_text,
  })

  return { subject, html, text: bodyText }
}

export function renderYearEndStatementEmail(
  settings: DonationReceiptSettings,
  payload: AnnualGivingStatementPayload
) {
  const template =
    settings.year_end_statement_email_template?.trim() ||
    DEFAULT_YEAR_END_STATEMENT_EMAIL_TEMPLATE

  const replacements = {
    "{{donor_name}}": payload.donorName,
    "{{tax_year}}": String(payload.taxYear),
    "{{total_giving}}": formatMoney(payload.totalGiving),
    "{{organization_name}}": payload.organizationName,
    "{{receipt_number}}": payload.receiptNumber,
  }

  const bodyText = applyTemplate(template, replacements)
  const subject = `${payload.taxYear} Giving Statement — ${payload.organizationName}`
  const bodyHtml = escapeHtml(bodyText).replaceAll("\n", "<br />")
  const html = wrapDonationBrandedEmailHtml({
    organizationName: payload.organizationName,
    title: `${payload.taxYear} Year-End Giving Statement`,
    bodyHtml: `<p>${bodyHtml}</p>`,
    footerText: payload.footerText,
  })

  return { subject, html, text: bodyText }
}

export function renderPledgeReminderEmail(message: PledgeReminderMessage) {
  const subject = message.subject
  const bodyHtml = escapeHtml(message.body).replaceAll("\n", "<br />")
  const html = wrapDonationBrandedEmailHtml({
    organizationName: message.organizationName,
    title: "Pledge Reminder",
    bodyHtml: `<p>${bodyHtml}</p>`,
  })

  return { subject, html, text: message.body }
}
