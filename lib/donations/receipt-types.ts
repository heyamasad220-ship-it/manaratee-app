export const RECEIPT_STATUSES = ["not_sent", "sent", "resent", "failed"] as const
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number]

export const RECEIPT_TYPES = ["payment", "annual_statement"] as const
export type ReceiptType = (typeof RECEIPT_TYPES)[number]

export type DonationReceiptSettings = {
  organization_id: string
  legal_name: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  tax_id: string | null
  receipt_footer_text: string | null
  authorized_signer_name: string | null
  authorized_signer_title: string | null
  receipt_email_template: string | null
  year_end_statement_email_template: string | null
  receipt_number_prefix: string
  receipt_number_format: string
  next_receipt_sequence: number
  auto_generate_receipts: boolean
  email_receipts_automatically: boolean
  generate_year_end_statements: boolean
  year_end_statement_threshold: number
  enable_pledge_reminders: boolean
  pledge_reminder_message: string | null
  pledge_reminder_subject: string | null
  pledge_reminder_schedule: import("@/lib/donations/pledge-reminder-types").PledgeReminderSchedule
  pledge_reminder_days_before_due: number | null
  pledge_reminder_footer_text: string | null
  pledge_payment_instructions: string | null
}

export type PaymentReceiptLineItem = {
  paymentId: string
  paymentDate: string
  amount: number
  paymentMethod: string
  campaignName: string | null
  fundName: string | null
  memo: string | null
}

export type PaymentReceiptPayload = {
  receiptNumber: string
  receiptDate: string
  donorName: string
  donorEmail: string | null
  organizationName: string
  organizationAddress: string
  taxId: string | null
  paymentDate: string
  amount: number
  paymentMethod: string
  campaignName: string | null
  fundName: string | null
  taxDisclaimer: string
  signerName: string | null
  signerTitle: string | null
  footerText: string | null
}

export type AnnualGivingStatementPayload = {
  receiptNumber: string
  statementDate: string
  taxYear: number
  donorName: string
  donorEmail: string | null
  organizationName: string
  organizationAddress: string
  taxId: string | null
  lineItems: PaymentReceiptLineItem[]
  totalGiving: number
  footerText: string | null
  signerName: string | null
  signerTitle: string | null
}

export type DonorGivingTotals = {
  lifetimeGiving: number
  currentYearGiving: number
  previousYearGiving: number
  currentYear: number
  previousYear: number
}

export const DEFAULT_RECEIPT_FOOTER =
  "Thank you for your generous donation. No goods or services were provided in exchange for this contribution. Your donation is tax-deductible to the extent allowed by law."

export const DEFAULT_RECEIPT_EMAIL_TEMPLATE =
  "Dear {{donor_name}},\n\nThank you for your donation of {{amount}} on {{payment_date}}. Your receipt number is {{receipt_number}}.\n\n{{organization_name}}"

export const DEFAULT_YEAR_END_STATEMENT_EMAIL_TEMPLATE =
  "Dear {{donor_name}},\n\nPlease find your {{tax_year}} year-end giving statement attached. Your total giving was {{total_giving}}.\n\nThank you for your generous support.\n\n{{organization_name}}"

export function formatReceiptNumber(
  format: string,
  prefix: string,
  sequence: number,
  year: number
): string {
  return format
    .replaceAll("{prefix}", prefix)
    .replaceAll("{year}", String(year))
    .replaceAll("{sequence}", String(sequence).padStart(5, "0"))
}

export function formatOrganizationAddress(settings: DonationReceiptSettings): string {
  const parts = [
    settings.address_line1,
    settings.address_line2,
    [settings.city, settings.state].filter(Boolean).join(", "),
    settings.postal_code,
  ].filter(Boolean)
  return parts.join("\n")
}

export function isVoidedPaymentForReceipt(status: string | null | undefined): boolean {
  return String(status || "").toLowerCase() === "voided"
}
