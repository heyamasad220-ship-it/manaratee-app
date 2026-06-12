export type SendTransactionalEmailInput = {
  to: string[]
  subject: string
  html: string
  text?: string
  replyTo?: string | null
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

function uniqueEmails(emails: string[]) {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))]
}

export function isTransactionalEmailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.TRANSACTIONAL_EMAIL_FROM?.trim()
  )
}

function buildPlainText(subject: string, html: string, text?: string) {
  if (text?.trim()) {
    return text.trim()
  }

  return `${subject}\n\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`
}

async function sendViaResend(input: SendTransactionalEmailInput): Promise<SendTransactionalEmailResult> {
  const apiKey = process.env.RESEND_API_KEY!.trim()
  const from = process.env.TRANSACTIONAL_EMAIL_FROM!.trim()
  const recipients = uniqueEmails(input.to)

  if (recipients.length === 0) {
    return { configured: true, provider: "resend", results: [] }
  }

  const results: TransactionalEmailRecipientResult[] = []

  for (const email of recipients) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: input.subject,
          html: input.html,
          text: buildPlainText(input.subject, input.html, input.text),
          ...(input.replyTo?.trim() ? { reply_to: input.replyTo.trim() } : {}),
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        id?: string
        message?: string
      }

      if (!response.ok) {
        results.push({
          email,
          sent: false,
          error: payload.message || `Resend HTTP ${response.status}`,
        })
        continue
      }

      results.push({
        email,
        sent: true,
        messageId: payload.id,
      })
    } catch (error) {
      results.push({
        email,
        sent: false,
        error: error instanceof Error ? error.message : "Email send failed",
      })
    }
  }

  return { configured: true, provider: "resend", results }
}

function sendViaConsole(input: SendTransactionalEmailInput): SendTransactionalEmailResult {
  const recipients = uniqueEmails(input.to)

  console.info("[transactional-email]", {
    to: recipients,
    subject: input.subject,
    replyTo: input.replyTo ?? null,
    preview: buildPlainText(input.subject, input.html, input.text).slice(0, 500),
  })

  return {
    configured: false,
    provider: "console",
    results: recipients.map((email) => ({ email, sent: true })),
  }
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendTransactionalEmailResult> {
  if (isTransactionalEmailConfigured()) {
    return sendViaResend(input)
  }

  return sendViaConsole(input)
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
