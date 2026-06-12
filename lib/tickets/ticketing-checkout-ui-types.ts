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

export const ORGANIZATION_DISCOUNT_CODES: TicketingDiscountCode[] = [
  {
    id: "dc1",
    code: "WELCOME10",
    label: "New Customer Welcome",
    type: "Percentage",
    discount: 10,
    usageCount: 45,
    usageLimit: null,
    status: "Active",
    activeFrom: "Jan 1, 2026",
    activeTo: "Dec 31, 2026",
    scope: "organization",
  },
  {
    id: "dc2",
    code: "MEMBER20",
    label: "Member Discount",
    type: "Percentage",
    discount: 20,
    usageCount: 128,
    usageLimit: 500,
    status: "Active",
    activeFrom: "Jan 1, 2026",
    activeTo: "Dec 31, 2026",
    scope: "organization",
  },
  {
    id: "dc3",
    code: "FAMILY15",
    label: "Family Discount",
    type: "Percentage",
    discount: 15,
    usageCount: 67,
    usageLimit: 200,
    status: "Active",
    activeFrom: "Jan 1, 2026",
    activeTo: "Jun 30, 2026",
    scope: "organization",
  },
]

const EVENT_CHECKOUT_BY_EVENT_ID: Record<string, EventCheckoutConfig> = {
  "evt-001": {
    useOrganizationDefault: false,
    fields: [
      { id: "f1", name: "First Name", type: "text", required: true, enabled: true },
      { id: "f2", name: "Last Name", type: "text", required: true, enabled: true },
      { id: "f3", name: "Email", type: "email", required: true, enabled: true },
      { id: "f4", name: "Phone", type: "phone", required: true, enabled: true },
    ],
    attendeeQuestions: [
      {
        id: "aq1",
        question: "T-Shirt Size",
        type: "select",
        required: true,
        options: ["S", "M", "L", "XL", "XXL"],
        perAttendee: true,
      },
      {
        id: "aq2",
        question: "Dietary Restrictions",
        type: "select",
        required: false,
        options: ["None", "Vegetarian", "Vegan", "Halal", "Gluten-Free", "Other"],
        perAttendee: true,
      },
      {
        id: "aq3",
        question: "How did you hear about this event?",
        type: "select",
        required: false,
        options: ["Social Media", "Email", "Friend/Family", "Website", "Flyer", "Other"],
        perAttendee: false,
      },
    ],
  },
  "evt-002": {
    useOrganizationDefault: false,
    fields: DEFAULT_ORG_CHECKOUT_FIELDS,
    attendeeQuestions: [
      {
        id: "aq4",
        question: "Meal Preference",
        type: "select",
        required: true,
        options: ["Chicken", "Fish", "Vegetarian", "Vegan"],
        perAttendee: true,
      },
      {
        id: "aq5",
        question: "Table Seating Request",
        type: "textarea",
        required: false,
        perAttendee: false,
      },
      {
        id: "aq6",
        question: "Would you like to be recognized as a sponsor?",
        type: "checkbox",
        required: false,
        perAttendee: false,
      },
    ],
  },
}

export const EVENT_DISCOUNT_CODES: TicketingDiscountCode[] = [
  {
    id: "edc1",
    code: "EIDBAZAAR25",
    label: "Eid Bazaar Early Bird",
    type: "Percentage",
    discount: 25,
    usageCount: 34,
    usageLimit: 100,
    status: "Active",
    activeFrom: "Feb 1, 2026",
    activeTo: "Mar 25, 2026",
    scope: "event",
    eventId: "evt-001",
    eventName: "Eid Bazaar 2026",
  },
  {
    id: "edc2",
    code: "GALA50OFF",
    label: "Gala VIP Discount",
    type: "Fixed",
    discount: 50,
    usageCount: 12,
    usageLimit: 25,
    status: "Active",
    activeFrom: "Mar 1, 2026",
    activeTo: "Apr 10, 2026",
    scope: "event",
    eventId: "evt-002",
    eventName: "Spring Fundraiser Gala",
  },
  {
    id: "edc3",
    code: "CAMPKIDS10",
    label: "Summer Camp Sibling Discount",
    type: "Percentage",
    discount: 10,
    usageCount: 8,
    usageLimit: 50,
    status: "Active",
    activeFrom: "Apr 1, 2026",
    activeTo: "Jun 10, 2026",
    scope: "event",
    eventId: "evt-003",
    eventName: "Youth Summer Camp",
  },
  {
    id: "edc4",
    code: "IFTAR2026",
    label: "Community Iftar Special",
    type: "Percentage",
    discount: 100,
    usageCount: 15,
    usageLimit: 20,
    status: "Active",
    activeFrom: "Feb 15, 2026",
    activeTo: "Mar 5, 2026",
    scope: "event",
    eventId: "evt-004",
    eventName: "Community Iftar",
  },
]

/** Demo events that use a custom checkout form (for settings summary links). */
export const EVENTS_WITH_CUSTOM_CHECKOUT = [
  { eventId: "evt-001", eventName: "Eid Bazaar 2026" },
  { eventId: "evt-002", eventName: "Spring Fundraiser Gala" },
]

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
