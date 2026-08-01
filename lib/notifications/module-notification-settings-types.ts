export type ModuleNotificationKey = "event_management" | "venue_rentals" | "vendor_hub"

export type NotificationAudience = "staff" | "customer"

export type NotificationEventDefinition = {
  key: string
  label: string
  description: string
  defaultEnabled: boolean
}

export type ModuleNotificationSettings = {
  staff: Record<string, boolean>
  customer: Record<string, boolean>
  staffAdditionalEmails: string
  customerReplyToEmail: string
}

export const EVENT_MANAGEMENT_NOTIFICATION_EVENTS: NotificationEventDefinition[] = [
  {
    key: "request_submitted",
    label: "Request submitted",
    description: "Notify staff when a new internal event request is submitted.",
    defaultEnabled: true,
  },
  {
    key: "request_approved",
    label: "Request approved",
    description: "Notify staff when an event request is approved.",
    defaultEnabled: true,
  },
  {
    key: "request_declined",
    label: "Request declined",
    description: "Notify staff when an event request is declined.",
    defaultEnabled: true,
  },
  {
    key: "event_updated",
    label: "Event updated",
    description: "Notify staff when event details change after approval.",
    defaultEnabled: true,
  },
  {
    key: "event_cancelled",
    label: "Event cancelled",
    description: "Notify staff when an event is cancelled.",
    defaultEnabled: true,
  },
]

export const EVENT_MANAGEMENT_CUSTOMER_NOTIFICATION_EVENTS: NotificationEventDefinition[] =
  [
    {
      key: "request_received",
      label: "Request received",
      description: "Confirm to the requester that their event request was received.",
      defaultEnabled: true,
    },
    {
      key: "request_approved",
      label: "Request approved",
      description: "Notify the requester when their event is approved.",
      defaultEnabled: true,
    },
    {
      key: "request_declined",
      label: "Request declined",
      description: "Notify the requester when their event is declined.",
      defaultEnabled: true,
    },
    {
      key: "event_updated",
      label: "Event updated",
      description: "Notify the requester when event details change.",
      defaultEnabled: true,
    },
    {
      key: "event_cancelled",
      label: "Event cancelled",
      description: "Notify the requester when an event is cancelled.",
      defaultEnabled: true,
    },
    {
      key: "event_reminder",
      label: "Event reminder",
      description: "Send a reminder before the event start time.",
      defaultEnabled: true,
    },
  ]

export const VENUE_RENTAL_STAFF_NOTIFICATION_EVENTS: NotificationEventDefinition[] = [
  {
    key: "request_submitted",
    label: "Rental request submitted",
    description: "Notify staff when a customer submits a venue rental request.",
    defaultEnabled: true,
  },
  {
    key: "policies_agreed",
    label: "Policies agreed",
    description: "Notify staff when a customer agrees to policies and is ready for review.",
    defaultEnabled: true,
  },
  {
    key: "payment_received",
    label: "Payment received",
    description: "Notify staff when a rental payment is recorded.",
    defaultEnabled: true,
  },
  {
    key: "hold_expiring",
    label: "Hold expiring",
    description: "Alert staff when a temporary hold is about to expire.",
    defaultEnabled: true,
  },
  {
    key: "rental_cancelled",
    label: "Rental cancelled",
    description: "Notify staff when a rental is cancelled.",
    defaultEnabled: true,
  },
]

export const VENUE_RENTAL_CUSTOMER_NOTIFICATION_EVENTS: NotificationEventDefinition[] =
  [
    {
      key: "policies_documents_sent",
      label: "Policies documents sent",
      description:
        "Notify the customer to review and agree to policies/pricing after a request is submitted.",
      defaultEnabled: true,
    },
    {
      key: "request_received",
      label: "Request received",
      description: "Confirm to the customer that their rental request was received.",
      defaultEnabled: true,
    },
    {
      key: "request_approved",
      label: "Approved — payment needed",
      description: "Notify the customer when their rental is approved and payment is due.",
      defaultEnabled: true,
    },
    {
      key: "request_declined",
      label: "Request declined",
      description: "Notify the customer when their rental request is declined.",
      defaultEnabled: true,
    },
    {
      key: "payment_received",
      label: "Payment received",
      description: "Confirm payment to the customer.",
      defaultEnabled: true,
    },
    {
      key: "hold_extended",
      label: "Hold extended",
      description: "Notify the customer when their hold is extended.",
      defaultEnabled: true,
    },
    {
      key: "balance_reminder",
      label: "Balance reminder",
      description: "Remind the customer about an outstanding balance before the event.",
      defaultEnabled: true,
    },
    {
      key: "rental_confirmed",
      label: "Rental confirmed",
      description: "Notify the customer when the rental is fully confirmed.",
      defaultEnabled: true,
    },
    {
      key: "rental_cancelled",
      label: "Rental cancelled",
      description: "Notify the customer when a rental is cancelled.",
      defaultEnabled: true,
    },
  ]

export const VENDOR_HUB_CUSTOMER_NOTIFICATION_EVENTS: NotificationEventDefinition[] = [
  {
    key: "event_published",
    label: "Bazaar published",
    description: "Notify approved vendors when a bazaar opens for booth reservations.",
    defaultEnabled: true,
  },
  {
    key: "event_updated",
    label: "Event update",
    description: "Notify vendors when organizers send an event update.",
    defaultEnabled: true,
  },
  {
    key: "event_reminder",
    label: "Event reminder",
    description: "Notify vendors before the bazaar date.",
    defaultEnabled: true,
  },
  {
    key: "event_cancelled",
    label: "Event cancelled",
    description: "Notify vendors when a bazaar is cancelled.",
    defaultEnabled: true,
  },
  {
    key: "event_message",
    label: "General message",
    description: "Notify vendors when organizers send a custom message.",
    defaultEnabled: true,
  },
]

export function getNotificationCatalog(moduleKey: ModuleNotificationKey) {
  if (moduleKey === "event_management") {
    return {
      staffEvents: EVENT_MANAGEMENT_NOTIFICATION_EVENTS,
      customerEvents: EVENT_MANAGEMENT_CUSTOMER_NOTIFICATION_EVENTS,
    }
  }

  if (moduleKey === "vendor_hub") {
    return {
      staffEvents: [],
      customerEvents: VENDOR_HUB_CUSTOMER_NOTIFICATION_EVENTS,
    }
  }

  return {
    staffEvents: VENUE_RENTAL_STAFF_NOTIFICATION_EVENTS,
    customerEvents: VENUE_RENTAL_CUSTOMER_NOTIFICATION_EVENTS,
  }
}

export function buildDefaultModuleNotificationSettings(
  moduleKey: ModuleNotificationKey
): ModuleNotificationSettings {
  const catalog = getNotificationCatalog(moduleKey)

  const staff: Record<string, boolean> = {}
  for (const event of catalog.staffEvents) {
    staff[event.key] = event.defaultEnabled
  }

  const customer: Record<string, boolean> = {}
  for (const event of catalog.customerEvents) {
    customer[event.key] = event.defaultEnabled
  }

  return {
    staff,
    customer,
    staffAdditionalEmails: "",
    customerReplyToEmail: "",
  }
}

export function mergeModuleNotificationSettings(
  moduleKey: ModuleNotificationKey,
  stored: Partial<ModuleNotificationSettings> | null | undefined
): ModuleNotificationSettings {
  const defaults = buildDefaultModuleNotificationSettings(moduleKey)

  return {
    staff: { ...defaults.staff, ...(stored?.staff ?? {}) },
    customer: { ...defaults.customer, ...(stored?.customer ?? {}) },
    staffAdditionalEmails: stored?.staffAdditionalEmails ?? defaults.staffAdditionalEmails,
    customerReplyToEmail: stored?.customerReplyToEmail ?? defaults.customerReplyToEmail,
  }
}
