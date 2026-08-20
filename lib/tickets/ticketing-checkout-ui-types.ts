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
  /**
   * Ticket type ids this question applies to.
   * Empty = all ticket types on the event.
   */
  ticketTypeIds: string[]
}

export type EventCheckoutConfig = {
  /** Buyer contact fields only — org default vs event custom. */
  useOrganizationDefault: boolean
  fields: CheckoutFormField[]
  /** Event attendee questions (optionally scoped to ticket types). */
  attendeeQuestions: AttendeeQuestion[]
}

export type TicketingDiscountCode = DiscountCode & {
  scope: "organization" | "event"
  eventId?: string
  eventName?: string
}

export type TicketTypeOptionForQuestions = {
  id: string
  name: string
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

/** Preset pack for youth / kids ticket types (under 17). */
export const YOUTH_ATTENDEE_QUESTION_PACK: Array<
  Omit<AttendeeQuestion, "id" | "ticketTypeIds">
> = [
  {
    question: "Child's age",
    type: "number",
    required: true,
    perAttendee: true,
  },
  {
    question: "Grade level",
    type: "text",
    required: true,
    perAttendee: true,
  },
  {
    question: "Emergency contact (name & phone)",
    type: "text",
    required: true,
    perAttendee: true,
  },
  {
    question: "Allergies or medical notes",
    type: "textarea",
    required: true,
    perAttendee: true,
  },
  {
    question: "Photo consent",
    type: "checkbox",
    required: true,
    perAttendee: true,
  },
]

export const ORGANIZATION_DISCOUNT_CODES: TicketingDiscountCode[] = []

const EVENT_CHECKOUT_BY_EVENT_ID: Record<string, EventCheckoutConfig> = {}

export const EVENT_DISCOUNT_CODES: TicketingDiscountCode[] = []

/** Events that use a custom checkout form (for settings summary links). */
export const EVENTS_WITH_CUSTOM_CHECKOUT: { eventId: string; eventName: string }[] = []

function normalizeAttendeeQuestion(
  question: Partial<AttendeeQuestion> & { question?: string }
): AttendeeQuestion {
  return {
    id: question.id || `aq-${Date.now()}`,
    question: (question.question || "").trim(),
    type: (question.type as AttendeeQuestion["type"]) || "text",
    required: Boolean(question.required),
    options: question.options,
    perAttendee: question.perAttendee !== false,
    ticketTypeIds: Array.isArray(question.ticketTypeIds)
      ? question.ticketTypeIds.filter(Boolean)
      : [],
  }
}

export function getDefaultEventCheckoutConfig(eventId: string): EventCheckoutConfig {
  const saved = EVENT_CHECKOUT_BY_EVENT_ID[eventId]
  if (saved) {
    return {
      useOrganizationDefault: saved.useOrganizationDefault,
      fields: saved.fields.map((field) => ({ ...field })),
      attendeeQuestions: saved.attendeeQuestions.map((question) =>
        normalizeAttendeeQuestion(question)
      ),
    }
  }

  return {
    useOrganizationDefault: true,
    fields: DEFAULT_ORG_CHECKOUT_FIELDS.map((field) => ({ ...field })),
    attendeeQuestions: [],
  }
}

/** Prefer checkout stored on the event `ticketing_config`, else in-memory defaults. */
export function getEventCheckoutConfigFromTicketing(
  eventId: string,
  ticketingConfig?: { checkout?: EventCheckoutConfig | null } | null
): EventCheckoutConfig {
  const saved = ticketingConfig?.checkout
  if (saved) {
    return {
      useOrganizationDefault: saved.useOrganizationDefault !== false,
      fields: (saved.fields || []).map((field) => ({ ...field })),
      attendeeQuestions: (saved.attendeeQuestions || []).map((question) =>
        normalizeAttendeeQuestion(question)
      ),
    }
  }
  return getDefaultEventCheckoutConfig(eventId)
}

export function getEventDiscountCodes(eventId: string) {
  return EVENT_DISCOUNT_CODES.filter((code) => code.eventId === eventId)
}

/** Empty ticketTypeIds means the question applies to every ticket type. */
export function questionAppliesToTicketType(
  question: AttendeeQuestion,
  ticketTypeId: string
) {
  if (!question.ticketTypeIds || question.ticketTypeIds.length === 0) {
    return true
  }
  return question.ticketTypeIds.includes(ticketTypeId)
}

export function getQuestionsForTicketType(
  questions: AttendeeQuestion[],
  ticketTypeId: string
) {
  return questions.filter((question) =>
    questionAppliesToTicketType(question, ticketTypeId)
  )
}

/**
 * Expand questions for a cart: one slot per attendee for each matching ticket quantity.
 * Used by checkout UIs when collecting youth / per-ticket answers.
 */
export function expandAttendeeQuestionSlots(
  questions: AttendeeQuestion[],
  lines: Array<{ ticketTypeId: string; quantity: number; ticketTypeName?: string }>
) {
  const slots: Array<{
    ticketTypeId: string
    ticketTypeName: string
    attendeeIndex: number
    questions: AttendeeQuestion[]
  }> = []

  for (const line of lines) {
    const qty = Math.max(0, Math.floor(line.quantity))
    if (qty === 0) continue
    const applicable = getQuestionsForTicketType(questions, line.ticketTypeId).filter(
      (question) => question.perAttendee
    )
    if (applicable.length === 0) continue
    for (let index = 0; index < qty; index += 1) {
      slots.push({
        ticketTypeId: line.ticketTypeId,
        ticketTypeName: line.ticketTypeName || "Ticket",
        attendeeIndex: index,
        questions: applicable,
      })
    }
  }

  return slots
}

export function buildYouthAttendeeQuestionPack(ticketTypeIds: string[]): AttendeeQuestion[] {
  const stamp = Date.now()
  return YOUTH_ATTENDEE_QUESTION_PACK.map((template, index) =>
    normalizeAttendeeQuestion({
      ...template,
      id: `aq-youth-${stamp}-${index}`,
      ticketTypeIds: [...ticketTypeIds],
    })
  )
}
