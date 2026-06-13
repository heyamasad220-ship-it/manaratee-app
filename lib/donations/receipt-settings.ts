import type { SupabaseClient } from "@supabase/supabase-js"
import {
  DEFAULT_RECEIPT_EMAIL_TEMPLATE,
  DEFAULT_RECEIPT_FOOTER,
  DEFAULT_YEAR_END_STATEMENT_EMAIL_TEMPLATE,
  type DonationReceiptSettings,
} from "@/lib/donations/receipt-types"
import {
  DEFAULT_PLEDGE_PAYMENT_INSTRUCTIONS,
  DEFAULT_PLEDGE_REMINDER_FOOTER,
  DEFAULT_PLEDGE_REMINDER_MESSAGE,
  DEFAULT_PLEDGE_REMINDER_SUBJECT,
} from "@/lib/donations/pledge-reminder-types"

export const DEFAULT_DONATION_RECEIPT_SETTINGS: Omit<
  DonationReceiptSettings,
  "organization_id"
> = {
  legal_name: null,
  address_line1: null,
  address_line2: null,
  city: null,
  state: null,
  postal_code: null,
  tax_id: null,
  receipt_footer_text: DEFAULT_RECEIPT_FOOTER,
  authorized_signer_name: null,
  authorized_signer_title: null,
  receipt_email_template: DEFAULT_RECEIPT_EMAIL_TEMPLATE,
  year_end_statement_email_template: DEFAULT_YEAR_END_STATEMENT_EMAIL_TEMPLATE,
  receipt_number_prefix: "REC",
  receipt_number_format: "{prefix}-{year}-{sequence}",
  next_receipt_sequence: 1,
  auto_generate_receipts: false,
  email_receipts_automatically: false,
  generate_year_end_statements: true,
  year_end_statement_threshold: 0,
  enable_pledge_reminders: false,
  pledge_reminder_message: DEFAULT_PLEDGE_REMINDER_MESSAGE,
  pledge_reminder_subject: DEFAULT_PLEDGE_REMINDER_SUBJECT,
  pledge_reminder_schedule: "manual",
  pledge_reminder_days_before_due: null,
  pledge_reminder_footer_text: DEFAULT_PLEDGE_REMINDER_FOOTER,
  pledge_payment_instructions: DEFAULT_PLEDGE_PAYMENT_INSTRUCTIONS,
}

export async function loadDonationReceiptSettings(
  supabase: SupabaseClient,
  organizationId: string
): Promise<DonationReceiptSettings> {
  const { data, error } = await supabase
    .from("donation_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error && error.code !== "42P01") {
    throw new Error(error.message)
  }

  if (!data) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle()

    return {
      organization_id: organizationId,
      ...DEFAULT_DONATION_RECEIPT_SETTINGS,
      legal_name: org?.name ?? null,
    }
  }

  return {
    organization_id: organizationId,
    legal_name: data.legal_name ?? null,
    address_line1: data.address_line1 ?? null,
    address_line2: data.address_line2 ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    postal_code: data.postal_code ?? null,
    tax_id: data.tax_id ?? null,
    receipt_footer_text: data.receipt_footer_text ?? DEFAULT_RECEIPT_FOOTER,
    authorized_signer_name: data.authorized_signer_name ?? null,
    authorized_signer_title: data.authorized_signer_title ?? null,
    receipt_email_template: data.receipt_email_template ?? DEFAULT_RECEIPT_EMAIL_TEMPLATE,
    year_end_statement_email_template:
      data.year_end_statement_email_template ?? DEFAULT_YEAR_END_STATEMENT_EMAIL_TEMPLATE,
    receipt_number_prefix: data.receipt_number_prefix ?? "REC",
    receipt_number_format: data.receipt_number_format ?? "{prefix}-{year}-{sequence}",
    next_receipt_sequence: Number(data.next_receipt_sequence ?? 1),
    auto_generate_receipts: Boolean(data.auto_generate_receipts),
    email_receipts_automatically: Boolean(data.email_receipts_automatically),
    generate_year_end_statements: Boolean(data.generate_year_end_statements ?? true),
    year_end_statement_threshold: Number(data.year_end_statement_threshold ?? 0),
    enable_pledge_reminders: Boolean(data.enable_pledge_reminders),
    pledge_reminder_message: data.pledge_reminder_message ?? DEFAULT_PLEDGE_REMINDER_MESSAGE,
    pledge_reminder_subject: data.pledge_reminder_subject ?? DEFAULT_PLEDGE_REMINDER_SUBJECT,
    pledge_reminder_schedule: data.pledge_reminder_schedule ?? "manual",
    pledge_reminder_days_before_due:
      data.pledge_reminder_days_before_due != null
        ? Number(data.pledge_reminder_days_before_due)
        : null,
    pledge_reminder_footer_text: data.pledge_reminder_footer_text ?? DEFAULT_PLEDGE_REMINDER_FOOTER,
    pledge_payment_instructions:
      data.pledge_payment_instructions ?? DEFAULT_PLEDGE_PAYMENT_INSTRUCTIONS,
  }
}

export async function saveDonationReceiptSettings(
  supabase: SupabaseClient,
  settings: DonationReceiptSettings
): Promise<void> {
  const { error } = await supabase.from("donation_settings").upsert(
    {
      organization_id: settings.organization_id,
      legal_name: settings.legal_name,
      address_line1: settings.address_line1,
      address_line2: settings.address_line2,
      city: settings.city,
      state: settings.state,
      postal_code: settings.postal_code,
      tax_id: settings.tax_id,
      receipt_footer_text: settings.receipt_footer_text,
      authorized_signer_name: settings.authorized_signer_name,
      authorized_signer_title: settings.authorized_signer_title,
      receipt_email_template: settings.receipt_email_template,
      year_end_statement_email_template: settings.year_end_statement_email_template,
      receipt_number_prefix: settings.receipt_number_prefix,
      receipt_number_format: settings.receipt_number_format,
      next_receipt_sequence: settings.next_receipt_sequence,
      auto_generate_receipts: settings.auto_generate_receipts,
      email_receipts_automatically: settings.email_receipts_automatically,
      generate_year_end_statements: settings.generate_year_end_statements,
      year_end_statement_threshold: settings.year_end_statement_threshold,
      enable_pledge_reminders: settings.enable_pledge_reminders,
      pledge_reminder_message: settings.pledge_reminder_message,
      pledge_reminder_subject: settings.pledge_reminder_subject,
      pledge_reminder_schedule: settings.pledge_reminder_schedule,
      pledge_reminder_days_before_due: settings.pledge_reminder_days_before_due,
      pledge_reminder_footer_text: settings.pledge_reminder_footer_text,
      pledge_payment_instructions: settings.pledge_payment_instructions,
    },
    { onConflict: "organization_id" }
  )

  if (error) throw new Error(error.message)
}
