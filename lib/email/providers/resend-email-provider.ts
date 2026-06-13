import type { EmailProvider, SendEmailInput, SendEmailResult } from "@/lib/email/email-provider-types"

function buildPlainText(subject: string, html: string, text?: string) {
  if (text?.trim()) return text.trim()
  return `${subject}\n\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const

  isConfigured() {
    return Boolean(
      process.env.RESEND_API_KEY?.trim() && process.env.TRANSACTIONAL_EMAIL_FROM?.trim()
    )
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const recipient = input.to.trim().toLowerCase()
    if (!recipient) {
      return {
        sent: false,
        provider: "resend",
        configured: true,
        error: "Recipient email is required",
      }
    }

    const apiKey = process.env.RESEND_API_KEY!.trim()
    const from = process.env.TRANSACTIONAL_EMAIL_FROM!.trim()

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject: input.subject,
          html: input.html,
          text: buildPlainText(input.subject, input.html, input.text),
          ...(input.replyTo?.trim() ? { reply_to: input.replyTo.trim() } : {}),
          ...(input.attachments?.length
            ? {
                attachments: input.attachments.map((attachment) => ({
                  filename: attachment.filename,
                  content: attachment.content,
                  ...(attachment.contentType
                    ? { content_type: attachment.contentType }
                    : {}),
                })),
              }
            : {}),
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        id?: string
        message?: string
      }

      if (!response.ok) {
        return {
          sent: false,
          provider: "resend",
          configured: true,
          error: payload.message || `Resend HTTP ${response.status}`,
        }
      }

      return {
        sent: true,
        provider: "resend",
        configured: true,
        messageId: payload.id,
      }
    } catch (error) {
      return {
        sent: false,
        provider: "resend",
        configured: true,
        error: error instanceof Error ? error.message : "Email send failed",
      }
    }
  }
}
