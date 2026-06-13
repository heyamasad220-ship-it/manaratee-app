import type { EmailProvider } from "@/lib/email/email-provider-types"
import { ConsoleEmailProvider } from "@/lib/email/providers/console-email-provider"
import { ResendEmailProvider } from "@/lib/email/providers/resend-email-provider"

let cachedProvider: EmailProvider | null = null

export function getEmailProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider

  const resend = new ResendEmailProvider()
  cachedProvider = resend.isConfigured() ? resend : new ConsoleEmailProvider()
  return cachedProvider
}

export function isTransactionalEmailConfigured() {
  return new ResendEmailProvider().isConfigured()
}

export function getTransactionalEmailFrom() {
  return process.env.TRANSACTIONAL_EMAIL_FROM?.trim() || null
}

export function getTransactionalEmailReplyTo() {
  return process.env.TRANSACTIONAL_EMAIL_REPLY_TO?.trim() || null
}
