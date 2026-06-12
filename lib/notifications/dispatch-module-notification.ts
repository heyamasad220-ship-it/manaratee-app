import { getAppBaseUrl } from "@/lib/app/get-app-base-url"
import {
  buildModuleNotificationEmailHtml,
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "@/lib/email/transactional-email"
import { isModuleNotificationEnabled } from "./module-notification-settings-queries"
import { getModuleNotificationSettings } from "./module-notification-settings-queries"
import type { ModuleNotificationKey } from "./module-notification-settings-types"

export type ModuleNotificationPayload = {
  organizationId: string
  moduleKey: ModuleNotificationKey
  eventKey: string
  audience: "staff" | "customer"
  subject: string
  summary: string
  recipientEmails?: string[]
  metadata?: Record<string, unknown>
  organizationName?: string | null
  actionLabel?: string
  actionUrl?: string
}

export type ModuleNotificationEmailResult = {
  email: string
  sent: boolean
  error?: string
}

export type ModuleNotificationDispatchResult = {
  dispatched: boolean
  reason: "disabled" | "no_recipients" | "sent" | "partial" | "failed" | "logged"
  emailResults: ModuleNotificationEmailResult[]
  emailConfigured: boolean
}

function defaultActionForModule(moduleKey: ModuleNotificationKey) {
  if (moduleKey === "vendor_hub") {
    return {
      actionLabel: "Open My Bazaars",
      actionUrl: `${getAppBaseUrl()}/customer/bazaars`,
    }
  }

  return {
    actionLabel: undefined,
    actionUrl: undefined,
  }
}

export async function dispatchModuleNotification(
  payload: ModuleNotificationPayload
): Promise<ModuleNotificationDispatchResult> {
  const enabled = await isModuleNotificationEnabled({
    moduleKey: payload.moduleKey,
    audience: payload.audience,
    eventKey: payload.eventKey,
    organizationId: payload.organizationId,
  })

  const recipientEmails = [...new Set((payload.recipientEmails ?? []).filter(Boolean))]

  if (!enabled) {
    return {
      dispatched: false,
      reason: "disabled",
      emailResults: recipientEmails.map((email) => ({ email, sent: false })),
      emailConfigured: isTransactionalEmailConfigured(),
    }
  }

  if (recipientEmails.length === 0) {
    return {
      dispatched: true,
      reason: "no_recipients",
      emailResults: [],
      emailConfigured: isTransactionalEmailConfigured(),
    }
  }

  const settings = await getModuleNotificationSettings(
    payload.moduleKey,
    payload.organizationId
  )

  const replyTo =
    payload.audience === "customer"
      ? settings.customerReplyToEmail.trim() || undefined
      : settings.staffAdditionalEmails.split(",")[0]?.trim() || undefined

  const defaults = defaultActionForModule(payload.moduleKey)
  const actionLabel = payload.actionLabel ?? defaults.actionLabel
  const actionUrl = payload.actionUrl ?? defaults.actionUrl

  const html = buildModuleNotificationEmailHtml({
    subject: payload.subject,
    summary: payload.summary,
    actionLabel,
    actionUrl,
    organizationName: payload.organizationName,
  })

  const emailResult = await sendTransactionalEmail({
    to: recipientEmails,
    subject: payload.subject,
    html,
    text: payload.summary,
    replyTo,
  })

  const emailResults: ModuleNotificationEmailResult[] = emailResult.results.map((row) => ({
    email: row.email,
    sent: row.sent,
    error: row.error,
  }))

  const sentCount = emailResults.filter((row) => row.sent).length

  if (!emailResult.configured) {
    console.info("[module-notification]", {
      module: payload.moduleKey,
      audience: payload.audience,
      event: payload.eventKey,
      subject: payload.subject,
      recipients: recipientEmails,
      metadata: payload.metadata ?? {},
    })
  }

  let reason: ModuleNotificationDispatchResult["reason"] = "sent"
  if (sentCount === 0) {
    reason = emailResult.configured ? "failed" : "logged"
  } else if (sentCount < emailResults.length) {
    reason = "partial"
  }

  return {
    dispatched: sentCount > 0 || !emailResult.configured,
    reason,
    emailResults,
    emailConfigured: emailResult.configured,
  }
}

export function fireModuleNotifications(payloads: ModuleNotificationPayload[]) {
  for (const payload of payloads) {
    void dispatchModuleNotification(payload).catch((error) => {
      console.error("module notification dispatch failed", error)
    })
  }
}
