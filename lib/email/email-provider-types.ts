export type EmailProviderName = "resend" | "console"

export type EmailAttachment = {
  filename: string
  content: string
  contentType?: string
}

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string | null
  attachments?: EmailAttachment[]
}

export type SendEmailResult = {
  sent: boolean
  messageId?: string
  error?: string
  provider: EmailProviderName
  configured: boolean
}

export interface EmailProvider {
  readonly name: EmailProviderName
  isConfigured(): boolean
  send(input: SendEmailInput): Promise<SendEmailResult>
}
