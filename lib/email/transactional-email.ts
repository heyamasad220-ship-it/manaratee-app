import { getEmailProvider, isTransactionalEmailConfigured } from "@/lib/email/get-email-provider"
import type {
  EmailAttachment,
  SendEmailInput,
  SendEmailResult,
} from "@/lib/email/email-provider-types"

export type SendTransactionalEmailInput = {
  to: string[]
  subject: string
  html: string
  text?: string
  replyTo?: string | null
  attachments?: EmailAttachment[]
}

export type TransactionalEmailRecipientResult = {
  email: string
  sent: boolean
  messageId?: string
  error?: string
}

export type SendTransactionalEmailResult = {
  configured: boolean
  provider: "resend" | "console"
  results: TransactionalEmailRecipientResult[]
}

export { isTransactionalEmailConfigured }

function uniqueEmails(emails: string[]) {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))]
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendTransactionalEmailResult> {
  const provider = getEmailProvider()
  const recipients = uniqueEmails(input.to)
  const results: TransactionalEmailRecipientResult[] = []

  for (const email of recipients) {
    const payload: SendEmailInput = {
      to: email,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      attachments: input.attachments,
    }

    const result: SendEmailResult = await provider.send(payload)
    results.push({
      email,
      sent: result.sent,
      messageId: result.messageId,
      error: result.error,
    })
  }

  return {
    configured: provider.isConfigured(),
    provider: provider.name,
    results,
  }
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export function buildModuleNotificationEmailHtml(input: {
  subject: string
  summary: string
  actionLabel?: string
  actionUrl?: string
  organizationName?: string | null
}) {
  const safeSubject = escapeHtml(input.subject)
  const safeSummary = escapeHtml(input.summary).replaceAll("\n", "<br />")
  const safeOrg = input.organizationName ? escapeHtml(input.organizationName) : null
  const safeActionLabel = input.actionLabel ? escapeHtml(input.actionLabel) : undefined
  const safeActionUrl = input.actionUrl ? escapeHtml(input.actionUrl) : undefined

  const actionBlock =
    safeActionUrl && safeActionLabel
      ? `<p style="margin:24px 0 0;"><a href="${safeActionUrl}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;">${safeActionLabel}</a></p>`
      : ""

  const orgLine = safeOrg
    ? `<p style="color:#64748b;font-size:14px;margin:0 0 16px;">From ${safeOrg}</p>`
    : ""

  return `<!DOCTYPE html>
<html>
  <body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#0f172a;margin:0;padding:24px;background:#f8fafc;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;">
      ${orgLine}
      <h1 style="font-size:20px;margin:0 0 16px;">${safeSubject}</h1>
      <p style="margin:0;">${safeSummary}</p>
      ${actionBlock}
    </div>
  </body>
</html>`
}
