import type { DiscountCode } from "@/lib/mock-data"

export type CheckoutFieldType =
  | "text"
  | "email"
  | "phone"
  | "address"
  | "textarea"
  | "select"
  | "checkbox"
  | "number"

export type CheckoutFormField = {
  id: string
  name: string
  type: CheckoutFieldType
  required: boolean
  enabled: boolean
  options?: string[]
  placeholder?: string
}

export type AttendeeQuestion = {
  id: string
  question: string
  type: "text" | "textarea" | "select" | "checkbox" | "number"
  required: boolean
  options?: string[]
  perAttendee: boolean
}

export type EventCheckoutConfig = {
  useOrganizationDefault: boolean
  fields: CheckoutFormField[]
  attendeeQuestions: AttendeeQuestion[]
}

export type TicketingDiscountCode = DiscountCode & {
  scope: "organization" | "event"
  eventId?: string
  eventName?: string
}

export const DEFAULT_ORG_CHECKOUT_FIELDS: CheckoutFormField[] = [
  { id: "f1", name: "First Name", type: "text", required: true, enabled: true },
  { id: "f2", name: "Last Name", type: "text", required: true, enabled: true },
  { id: "f3", name: "Email", type: "email", required: true, enabled: true },
  { id: "f4", name: "Phone", type: "phone", required: false, enabled: true },
  { id: "f5", name: "Address", type: "address", required: false, enabled: false },
  { id: "f6", name: "Company", type: "text", required: false, enabled: false },
  { id: "f7", name: "Special Requests", type: "textarea", required: false, enabled: true },
]

export const ORGANIZATION_DISCOUNT_CODES: TicketingDiscountCode[] = []

const EVENT_CHECKOUT_BY_EVENT_ID: Record<string, EventCheckoutConfig> = {}

export const EVENT_DISCOUNT_CODES: TicketingDiscountCode[] = []

/** Events that use a custom checkout form (for settings summary links). */
export const EVENTS_WITH_CUSTOM_CHECKOUT: { eventId: string; eventName: string }[] = []

export function getDefaultEventCheckoutConfig(eventId: string): EventCheckoutConfig {
  const saved = EVENT_CHECKOUT_BY_EVENT_ID[eventId]
  if (saved) {
    return {
      useOrganizationDefault: saved.useOrganizationDefault,
      fields: saved.fields.map((field) => ({ ...field })),
      attendeeQuestions: saved.attendeeQuestions.map((question) => ({ ...question })),
    }
  }

  return {
    useOrganizationDefault: true,
    fields: DEFAULT_ORG_CHECKOUT_FIELDS.map((field) => ({ ...field })),
    attendeeQuestions: [],
  }
}

export function getEventDiscountCodes(eventId: string) {
  return EVENT_DISCOUNT_CODES.filter((code) => code.eventId === eventId)
}
