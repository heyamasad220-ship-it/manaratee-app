import type { SupabaseClient } from "@supabase/supabase-js"

import { dispatchModuleNotification } from "@/lib/notifications/dispatch-module-notification"
import { resolveVendorAnnouncementRecipients } from "@/lib/vendor-hub/vendor-announcement-recipients"
import type {
  VendorAnnouncementAudience,
  VendorAnnouncementType,
} from "@/lib/vendor-hub/vendor-announcement-types"

const ANNOUNCEMENT_EVENT_KEY: Record<VendorAnnouncementType, string> = {
  published: "event_published",
  update: "event_updated",
  reminder: "event_reminder",
  cancellation: "event_cancelled",
  general: "event_message",
}

async function updateRecipientDeliveryStatuses(input: {
  supabase: SupabaseClient
  announcementId: string
  recipientEmails: Array<{ contactId: string; email: string | null }>
  dispatchResult: Awaited<ReturnType<typeof dispatchModuleNotification>>
}) {
  const emailStatus = new Map(
    input.dispatchResult.emailResults.map((row) => [row.email.toLowerCase(), row])
  )

  for (const recipient of input.recipientEmails) {
    let deliveryStatus: "queued" | "sent" | "failed" | "skipped" = "skipped"

    if (!recipient.email) {
      deliveryStatus = "skipped"
    } else if (!input.dispatchResult.dispatched && input.dispatchResult.reason === "disabled") {
      deliveryStatus = "skipped"
    } else if (input.dispatchResult.emailConfigured) {
      const result = emailStatus.get(recipient.email.toLowerCase())
      deliveryStatus = result?.sent ? "sent" : "failed"
    } else {
      deliveryStatus = "sent"
    }

    await input.supabase
      .from("vendor_hub_announcement_recipients")
      .update({ delivery_status: deliveryStatus })
      .eq("announcement_id", input.announcementId)
      .eq("contact_id", recipient.contactId)
  }
}

export async function deliverVendorEventAnnouncement(input: {
  supabase: SupabaseClient
  eventId: string
  organizationId: string
  announcementType: VendorAnnouncementType
  audience: VendorAnnouncementAudience
  subject: string
  body: string
  sentBy?: string | null
  organizationName?: string | null
}) {
  const subject = input.subject.trim()
  const body = input.body.trim()

  if (!subject || !body) {
    throw new Error("Subject and message are required.")
  }

  const { data: event, error: eventError } = await input.supabase
    .from("vendor_hub_events")
    .select("id, name")
    .eq("id", input.eventId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  if (eventError || !event) {
    throw new Error("Bazaar event not found.")
  }

  const recipients = await resolveVendorAnnouncementRecipients({
    supabase: input.supabase,
    organizationId: input.organizationId,
    eventId: input.eventId,
    audience: input.audience,
  })

  const { data: announcement, error: announcementError } = await input.supabase
    .from("vendor_hub_announcements")
    .insert({
      organization_id: input.organizationId,
      vendor_hub_event_id: input.eventId,
      announcement_type: input.announcementType,
      audience: input.audience,
      subject,
      body,
      sent_by: input.sentBy ?? null,
    })
    .select("id")
    .single()

  if (announcementError || !announcement) {
    if (announcementError?.code === "42P01") {
      throw new Error(
        "Vendor announcements require migration 083_vendor_hub_announcements.sql in Supabase."
      )
    }
    throw new Error(announcementError?.message || "Failed to create announcement.")
  }

  if (recipients.length > 0) {
    const recipientRows = recipients.map((recipient) => ({
      announcement_id: announcement.id,
      contact_id: recipient.contactId,
      email: recipient.email,
      delivery_status: recipient.email ? "queued" : "skipped",
    }))

    const { error: recipientError } = await input.supabase
      .from("vendor_hub_announcement_recipients")
      .insert(recipientRows)

    if (recipientError) {
      console.error("deliverVendorEventAnnouncement recipients:", recipientError)
    }
  }

  const emails = recipients.map((row) => row.email).filter(Boolean) as string[]

  const dispatchResult = await dispatchModuleNotification({
    organizationId: input.organizationId,
    moduleKey: "vendor_hub",
    eventKey: ANNOUNCEMENT_EVENT_KEY[input.announcementType],
    audience: "customer",
    subject,
    summary: body,
    recipientEmails: emails,
    organizationName: input.organizationName,
    metadata: {
      vendorHubEventId: input.eventId,
      announcementId: announcement.id,
      announcementType: input.announcementType,
      audience: input.audience,
    },
  })

  if (recipients.length > 0) {
    await updateRecipientDeliveryStatuses({
      supabase: input.supabase,
      announcementId: announcement.id as string,
      recipientEmails: recipients,
      dispatchResult,
    })
  }

  return {
    announcementId: announcement.id as string,
    recipientCount: recipients.length,
    emailCount: emails.length,
    dispatched: dispatchResult.dispatched,
    emailResults: dispatchResult.emailResults,
  }
}
