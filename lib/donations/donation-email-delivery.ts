import type { SupabaseClient } from "@supabase/supabase-js"

import {
  renderGroupPledgeConfirmationEmail,
  renderPledgeReminderEmail,
  renderProspectFollowUpReminderEmail,
  renderReceiptEmail,
  renderYearEndStatementEmail,
} from "@/lib/donations/donation-email-templates"
import { loadDonationReceiptSettings } from "@/lib/donations/receipt-settings"
import {
  buildAnnualStatementPdfBase64,
  buildPaymentReceiptPdfBase64,
} from "@/lib/donations/receipt-pdf-server"
import type {
  AnnualGivingStatementPayload,
  PaymentReceiptPayload,
  ReceiptStatus,
} from "@/lib/donations/receipt-types"
import type { PledgeReminderMessage } from "@/lib/donations/pledge-reminder-types"
import { getTransactionalEmailReplyTo } from "@/lib/email/get-email-provider"
import { sendTransactionalEmail } from "@/lib/email/transactional-email"

export type DonationEmailTemplate =
  | "receipt"
  | "year_end_statement"
  | "pledge_reminder"
  | "group_pledge_confirmation"
  | "prospect_follow_up_reminder"

export type DonationEmailDeliveryResult = {
  sent: boolean
  recipient: string | null
  provider: "resend" | "console"
  configured: boolean
  providerMessageId?: string
  error?: string
  logId?: string
}

async function resolveDonorEmail(
  supabase: SupabaseClient,
  input: {
    donorId?: string | null
    contactId?: string | null
    fallbackEmail?: string | null
  }
): Promise<string | null> {
  if (input.fallbackEmail?.trim()) {
    return input.fallbackEmail.trim().toLowerCase()
  }

  if (input.donorId) {
    const { data: donor } = await supabase
      .from("donors")
      .select("email, contact_id")
      .eq("id", input.donorId)
      .maybeSingle()

    if (donor?.email?.trim()) return donor.email.trim().toLowerCase()

    const contactId = donor?.contact_id ?? input.contactId
    if (contactId) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("email")
        .eq("id", contactId)
        .maybeSingle()
      if (contact?.email?.trim()) return contact.email.trim().toLowerCase()
    }
  }

  if (input.contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("email")
      .eq("id", input.contactId)
      .maybeSingle()
    if (contact?.email?.trim()) return contact.email.trim().toLowerCase()
  }

  return null
}

async function logTransactionalEmail(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    recipient: string
    template: DonationEmailTemplate
    status: "sent" | "failed"
    provider: "resend" | "console"
    providerMessageId?: string | null
    relatedEntityType?: "donation_receipt" | "pledge_reminder" | "pledge" | "campaign_prospect"
    relatedEntityId?: string | null
    errorMessage?: string | null
  }
) {
  const { data, error } = await supabase
    .from("transactional_email_log")
    .insert({
      organization_id: input.organizationId,
      recipient: input.recipient,
      template: input.template,
      status: input.status,
      provider: input.provider,
      provider_message_id: input.providerMessageId ?? null,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      error_message: input.errorMessage ?? null,
      sent_at: input.status === "sent" ? new Date().toISOString() : null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("Failed to log transactional email:", error.message)
    return null
  }

  return data.id as string
}

async function sendDonationEmail(input: {
  organizationId: string
  recipient: string | null
  template: DonationEmailTemplate
  subject: string
  html: string
  text: string
  attachments?: Array<{ filename: string; content: string; contentType?: string }>
  relatedEntityType?: "donation_receipt" | "pledge_reminder" | "pledge" | "campaign_prospect"
  relatedEntityId?: string | null
  supabase: SupabaseClient
}): Promise<DonationEmailDeliveryResult> {
  if (!input.recipient) {
    const logId = await logTransactionalEmail(input.supabase, {
      organizationId: input.organizationId,
      recipient: "(missing)",
      template: input.template,
      status: "failed",
      provider: "console",
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      errorMessage: "No recipient email address",
    })

    return {
      sent: false,
      recipient: null,
      provider: "console",
      configured: false,
      error: "No recipient email address",
      logId: logId ?? undefined,
    }
  }

  const delivery = await sendTransactionalEmail({
    to: [input.recipient],
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: getTransactionalEmailReplyTo(),
    attachments: input.attachments,
  })

  const result = delivery.results[0]
  const sent = Boolean(result?.sent)
  const logId = await logTransactionalEmail(input.supabase, {
    organizationId: input.organizationId,
    recipient: input.recipient,
    template: input.template,
    status: sent ? "sent" : "failed",
    provider: delivery.provider,
    providerMessageId: result?.messageId ?? null,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    errorMessage: sent ? null : result?.error || "Email delivery failed",
  })

  return {
    sent,
    recipient: input.recipient,
    provider: delivery.provider,
    configured: delivery.configured,
    providerMessageId: result?.messageId,
    error: sent ? undefined : result?.error || "Email delivery failed",
    logId: logId ?? undefined,
  }
}

export async function sendReceiptEmail(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    receiptId: string
    payload: PaymentReceiptPayload
    donorId?: string | null
    contactId?: string | null
    resend?: boolean
    sentBy?: string | null
  }
): Promise<DonationEmailDeliveryResult> {
  const settings = await loadDonationReceiptSettings(supabase, input.organizationId)
  const rendered = renderReceiptEmail(settings, input.payload)
  const recipient = await resolveDonorEmail(supabase, {
    donorId: input.donorId,
    contactId: input.contactId,
    fallbackEmail: input.payload.donorEmail,
  })

  const delivery = await sendDonationEmail({
    supabase,
    organizationId: input.organizationId,
    recipient,
    template: "receipt",
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    relatedEntityType: "donation_receipt",
    relatedEntityId: input.receiptId,
    attachments: [
      {
        filename: `receipt-${input.payload.receiptNumber}.pdf`,
        content: buildPaymentReceiptPdfBase64(input.payload),
        contentType: "application/pdf",
      },
    ],
  })

  const status: ReceiptStatus = delivery.sent
    ? input.resend
      ? "resent"
      : "sent"
    : "failed"

  await supabase
    .from("donation_receipts")
    .update({
      status,
      sent_at: delivery.sent ? new Date().toISOString() : null,
      sent_by: delivery.sent ? input.sentBy ?? null : null,
    })
    .eq("id", input.receiptId)
    .eq("organization_id", input.organizationId)

  return delivery
}

export async function sendYearEndStatementEmail(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    receiptId: string
    payload: AnnualGivingStatementPayload
    donorId?: string | null
    contactId?: string | null
    resend?: boolean
    sentBy?: string | null
  }
): Promise<DonationEmailDeliveryResult> {
  const settings = await loadDonationReceiptSettings(supabase, input.organizationId)
  const rendered = renderYearEndStatementEmail(settings, input.payload)
  const recipient = await resolveDonorEmail(supabase, {
    donorId: input.donorId,
    contactId: input.contactId,
    fallbackEmail: input.payload.donorEmail,
  })

  const delivery = await sendDonationEmail({
    supabase,
    organizationId: input.organizationId,
    recipient,
    template: "year_end_statement",
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    relatedEntityType: "donation_receipt",
    relatedEntityId: input.receiptId,
    attachments: [
      {
        filename: `giving-statement-${input.payload.taxYear}-${input.payload.receiptNumber}.pdf`,
        content: buildAnnualStatementPdfBase64(input.payload),
        contentType: "application/pdf",
      },
    ],
  })

  const status: ReceiptStatus = delivery.sent
    ? input.resend
      ? "resent"
      : "sent"
    : "failed"

  await supabase
    .from("donation_receipts")
    .update({
      status,
      sent_at: delivery.sent ? new Date().toISOString() : null,
      sent_by: delivery.sent ? input.sentBy ?? null : null,
    })
    .eq("id", input.receiptId)
    .eq("organization_id", input.organizationId)

  return delivery
}

export async function sendPledgeReminderEmail(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    reminderId: string
    recipient: string | null
    message: PledgeReminderMessage
  }
): Promise<DonationEmailDeliveryResult> {
  const rendered = renderPledgeReminderEmail(input.message)

  const delivery = await sendDonationEmail({
    supabase,
    organizationId: input.organizationId,
    recipient: input.recipient,
    template: "pledge_reminder",
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    relatedEntityType: "pledge_reminder",
    relatedEntityId: input.reminderId,
  })

  await supabase
    .from("pledge_reminders")
    .update({
      status: delivery.sent ? "sent" : "failed",
      delivered_externally: delivery.sent,
      sent_at: delivery.sent ? new Date().toISOString() : null,
    })
    .eq("id", input.reminderId)
    .eq("organization_id", input.organizationId)

  return delivery
}

export async function sendGroupPledgeConfirmationEmail(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    pledgeId: string
    donorId?: string | null
    contactId?: string | null
    fallbackEmail?: string | null
    organizationName: string
    donorName: string
    groupName: string
    campaignName: string
    amount: number
    payLater: boolean
  }
): Promise<DonationEmailDeliveryResult> {
  const recipient = await resolveDonorEmail(supabase, {
    donorId: input.donorId,
    contactId: input.contactId,
    fallbackEmail: input.fallbackEmail,
  })
  const rendered = renderGroupPledgeConfirmationEmail({
    organizationName: input.organizationName,
    donorName: input.donorName,
    groupName: input.groupName,
    campaignName: input.campaignName,
    amount: input.amount,
    payLater: input.payLater,
  })

  return sendDonationEmail({
    supabase,
    organizationId: input.organizationId,
    recipient,
    template: "group_pledge_confirmation",
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    relatedEntityType: "pledge",
    relatedEntityId: input.pledgeId,
  })
}

export async function sendProspectFollowUpReminderEmail(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    recipient: string
    organizationName: string
    assigneeName: string
    overdueCount: number
    items: Array<{
      prospectName: string
      campaignName: string
      followUpDate: string
      href: string
    }>
  }
): Promise<DonationEmailDeliveryResult> {
  const rendered = renderProspectFollowUpReminderEmail({
    organizationName: input.organizationName,
    assigneeName: input.assigneeName,
    overdueCount: input.overdueCount,
    items: input.items,
  })

  return sendDonationEmail({
    supabase,
    organizationId: input.organizationId,
    recipient: input.recipient,
    template: "prospect_follow_up_reminder",
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    relatedEntityType: "campaign_prospect",
    relatedEntityId: null,
  })
}

export async function deliverPaymentReceiptById(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    receiptId: string
    resend?: boolean
    sentBy?: string | null
  }
): Promise<DonationEmailDeliveryResult> {
  const { data: receipt, error } = await supabase
    .from("donation_receipts")
    .select("id, receipt_type, payload, donor_id, contact_id")
    .eq("id", input.receiptId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  if (error || !receipt) {
    return {
      sent: false,
      recipient: null,
      provider: "console",
      configured: false,
      error: error?.message || "Receipt not found",
    }
  }

  if (receipt.receipt_type === "annual_statement") {
    return sendYearEndStatementEmail(supabase, {
      organizationId: input.organizationId,
      receiptId: input.receiptId,
      payload: receipt.payload as AnnualGivingStatementPayload,
      donorId: receipt.donor_id,
      contactId: receipt.contact_id,
      resend: input.resend,
      sentBy: input.sentBy,
    })
  }

  return sendReceiptEmail(supabase, {
    organizationId: input.organizationId,
    receiptId: input.receiptId,
    payload: receipt.payload as PaymentReceiptPayload,
    donorId: receipt.donor_id,
    contactId: receipt.contact_id,
    resend: input.resend,
    sentBy: input.sentBy,
  })
}

export { resolveDonorEmail }
