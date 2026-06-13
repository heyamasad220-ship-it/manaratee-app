import type { EmailProvider, SendEmailInput, SendEmailResult } from "@/lib/email/email-provider-types"

function buildPlainText(subject: string, html: string, text?: string) {
  if (text?.trim()) return text.trim()
  return `${subject}\n\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`
}

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console" as const

  isConfigured() {
    return false
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const recipient = input.to.trim().toLowerCase()
    if (!recipient) {
      return {
        sent: false,
        provider: "console",
        configured: false,
        error: "Recipient email is required",
      }
    }

    console.info("[transactional-email:console]", {
      to: recipient,
      subject: input.subject,
      replyTo: input.replyTo ?? null,
      attachments: input.attachments?.map((a) => a.filename) ?? [],
      preview: buildPlainText(input.subject, input.html, input.text).slice(0, 500),
    })

    return {
      sent: true,
      provider: "console",
      configured: false,
      messageId: `console_${Date.now()}`,
    }
  }
}
