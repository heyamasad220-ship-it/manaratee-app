export type VendorAnnouncementType =
  | "published"
  | "update"
  | "reminder"
  | "cancellation"
  | "general"

export type VendorAnnouncementAudience = "all_approved_vendors" | "event_participants"

export type VendorAnnouncementRecord = {
  id: string
  organizationId: string
  eventId: string
  eventName: string
  announcementType: VendorAnnouncementType
  audience: VendorAnnouncementAudience
  subject: string
  body: string
  recipientCount: number
  createdAt: string
}

export type VendorInboxMessage = {
  id: string
  recipientId: string
  announcementId: string
  eventId: string
  eventName: string
  organizationName: string
  announcementType: VendorAnnouncementType
  subject: string
  body: string
  readAt: string | null
  createdAt: string
}

export const VENDOR_ANNOUNCEMENT_TYPE_LABELS: Record<VendorAnnouncementType, string> = {
  published: "Event published",
  update: "Event update",
  reminder: "Reminder",
  cancellation: "Cancellation",
  general: "General message",
}

export const VENDOR_ANNOUNCEMENT_TEMPLATES: Record<
  Exclude<VendorAnnouncementType, "published">,
  { subject: string; body: string }
> = {
  update: {
    subject: "Update for {eventName}",
    body: "There has been an update to {eventName}. Please sign in to My Bazaars for the latest details.",
  },
  reminder: {
    subject: "Reminder: {eventName} is coming up",
    body: "This is a reminder about {eventName}. Please review your booth reservation and payment status in My Bazaars.",
  },
  cancellation: {
    subject: "{eventName} has been cancelled",
    body: "We regret to inform you that {eventName} has been cancelled. The organizer will follow up regarding any booth fees or refunds.",
  },
  general: {
    subject: "Message from {eventName}",
    body: "",
  },
}

export function fillAnnouncementTemplate(
  template: string,
  values: { eventName: string; organizationName?: string }
) {
  return template
    .replaceAll("{eventName}", values.eventName)
    .replaceAll("{organizationName}", values.organizationName ?? "your community")
}
