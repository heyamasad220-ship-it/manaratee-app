import type { EventAttendanceMode } from "@/lib/events/event-workspace-features"

export type TicketingSalesStatus = "published" | "draft" | "sales_closed"

export type EventTicketingConfig = {
  salesOpenAt?: string | null
  salesCloseAt?: string | null
  currency?: string
  salesStatus?: TicketingSalesStatus
  /** How attendees join: paid / free / mix / open public. */
  attendanceMode?: EventAttendanceMode
  /** Optional donations campaign for fundraiser events. */
  linkedCampaignId?: string | null
  /** Event-level checkout form override (when not using org default). */
  checkout?: {
    useOrganizationDefault: boolean
    fields: Array<{
      id: string
      name: string
      type: string
      required: boolean
      enabled: boolean
      options?: string[]
      placeholder?: string
    }>
    attendeeQuestions: Array<{
      id: string
      question: string
      type: string
      required: boolean
      options?: string[]
      perAttendee: boolean
      ticketTypeIds?: string[]
    }>
  }
  /** Optional per-event confirmation / reservation email copy. */
  communications?: EventTicketingCommunications
}

export type EventTicketingCommunications = {
  /** Subject for paid/free confirmation emails (leave blank for default). */
  confirmationSubject?: string | null
  /** Extra paragraph after the standard confirmation intro. */
  confirmationMessage?: string | null
  /** Subject for pay-at-event reservation emails. */
  reservationSubject?: string | null
  /** Extra paragraph after the standard reservation intro. */
  reservationMessage?: string | null
}

export function parseEventTicketingCommunications(
  value: unknown
): EventTicketingCommunications {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  const row = value as Record<string, unknown>
  const trimOrNull = (key: string) => {
    const raw = row[key]
    if (typeof raw !== "string") return null
    const trimmed = raw.trim()
    return trimmed || null
  }
  return {
    confirmationSubject: trimOrNull("confirmationSubject"),
    confirmationMessage: trimOrNull("confirmationMessage"),
    reservationSubject: trimOrNull("reservationSubject"),
    reservationMessage: trimOrNull("reservationMessage"),
  }
}

export const TICKETING_SALES_STATUS_LABELS: Record<TicketingSalesStatus, string> = {
  published: "Published",
  draft: "Draft",
  sales_closed: "Sales closed",
}

export type EventTicketType = {
  id: string
  organization_id: string
  internal_event_id: string
  name: string
  description: string | null
  price_cents: number
  quantity_total: number | null
  quantity_sold: number
  sort_order: number
  sales_start_at: string | null
  sales_end_at: string | null
  is_active: boolean
  offering_kind?: "standard" | "complimentary" | "youth_linked"
  visibility?: string
  min_per_order?: number
  max_per_order?: number | null
  created_at: string
  updated_at: string
}

export type EventTicketTypeInput = {
  id?: string
  name: string
  description?: string | null
  priceCents: number
  quantityTotal?: number | null
  sortOrder?: number
  offeringKind?: "standard" | "complimentary" | "youth_linked"
  visibility?: "public" | "unlisted" | "private"
  minPerOrder?: number
  maxPerOrder?: number | null
  salesStartAt?: string | null
  salesEndAt?: string | null
}

export type EventTicketingFormState = {
  requiresTicketing: boolean
  salesOpenAt: string
  salesCloseAt: string
  ticketTypes: EventTicketTypeFormRow[]
}

export type EventTicketTypeFormRow = {
  id: string
  name: string
  price: string
  quantity: string
  description: string
  /** standard | complimentary — free/paid mix support */
  offeringKind: "standard" | "complimentary"
  visibility: "public" | "unlisted" | "private"
  minPerOrder: string
  maxPerOrder: string
  /** Optional YYYY-MM-DD; empty = use event sales window */
  salesStartAt: string
  salesEndAt: string
}

export const DEFAULT_EVENT_TICKETING_FORM: EventTicketingFormState = {
  requiresTicketing: false,
  salesOpenAt: "",
  salesCloseAt: "",
  ticketTypes: [],
}

export function ticketingFormFromEvent(input: {
  requires_ticketing?: boolean
  ticketing_config?: EventTicketingConfig | null
  ticketTypes?: EventTicketType[]
}): EventTicketingFormState {
  const config = input.ticketing_config || {}

  return {
    requiresTicketing: input.requires_ticketing === true,
    salesOpenAt: config.salesOpenAt ? toDatetimeLocal(config.salesOpenAt) : "",
    salesCloseAt: config.salesCloseAt ? toDatetimeLocal(config.salesCloseAt) : "",
    ticketTypes: (input.ticketTypes || []).map((type, index) => ({
      id: type.id,
      name: type.name,
      price: (type.price_cents / 100).toFixed(2),
      quantity: type.quantity_total == null ? "" : String(type.quantity_total),
      description: type.description || "",
      offeringKind:
        type.offering_kind === "complimentary" || type.price_cents === 0
          ? ("complimentary" as const)
          : ("standard" as const),
      visibility:
        type.visibility === "unlisted" || type.visibility === "private"
          ? type.visibility
          : ("public" as const),
      minPerOrder: String(type.min_per_order ?? 1),
      maxPerOrder:
        type.max_per_order != null ? String(type.max_per_order) : "",
      salesStartAt: toDateInput(type.sales_start_at),
      salesEndAt: toDateInput(type.sales_end_at),
    })),
  }
}

export function buildTicketingPayload(form: EventTicketingFormState): {
  requires_ticketing: boolean
  ticketing_config: EventTicketingConfig
  ticketTypes: EventTicketTypeInput[]
} {
  const ticketTypes = form.requiresTicketing
    ? form.ticketTypes
        .filter((row) => row.name.trim())
        .map((row, index) => {
          const complimentary = row.offeringKind === "complimentary"
          const priceCents = complimentary
            ? 0
            : Math.round(Number.parseFloat(row.price || "0") * 100)
          const minPerOrder = Math.max(
            1,
            Number.parseInt(row.minPerOrder || "1", 10) || 1
          )
          const maxPerOrderRaw = row.maxPerOrder.trim()
          const maxPerOrder = maxPerOrderRaw
            ? Number.parseInt(maxPerOrderRaw, 10)
            : null
          return {
            id: row.id.startsWith("new-") ? undefined : row.id,
            name: row.name.trim(),
            description: row.description.trim() || null,
            priceCents: Number.isFinite(priceCents) ? Math.max(0, priceCents) : 0,
            quantityTotal: row.quantity.trim()
              ? Number.parseInt(row.quantity, 10)
              : null,
            sortOrder: index,
            offeringKind: complimentary
              ? ("complimentary" as const)
              : ("standard" as const),
            visibility: row.visibility || "public",
            minPerOrder,
            maxPerOrder:
              maxPerOrder != null && Number.isFinite(maxPerOrder)
                ? Math.max(minPerOrder, maxPerOrder)
                : null,
            salesStartAt: row.salesStartAt.trim()
              ? startOfDayIso(row.salesStartAt.trim())
              : null,
            salesEndAt: row.salesEndAt.trim()
              ? endOfDayIso(row.salesEndAt.trim())
              : null,
          }
        })
    : []

  return {
    requires_ticketing: form.requiresTicketing,
    ticketing_config: form.requiresTicketing
      ? {
          salesOpenAt: form.salesOpenAt ? new Date(form.salesOpenAt).toISOString() : null,
          salesCloseAt: form.salesCloseAt ? new Date(form.salesCloseAt).toISOString() : null,
          currency: "USD",
        }
      : {},
    ticketTypes,
  }
}

function toDatetimeLocal(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function toDateInput(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function startOfDayIso(date: string) {
  return new Date(`${date}T00:00:00`).toISOString()
}

function endOfDayIso(date: string) {
  return new Date(`${date}T23:59:59.999`).toISOString()
}

export type TicketOfferingSaleStatus = {
  onSale: boolean
  reason?: string
  salesStartAt: string | null
  salesEndAt: string | null
}

/** Effective per-offering sales window (offering dates override event window when set). */
export function getTicketOfferingSaleStatus(input: {
  eventConfig?: EventTicketingConfig | null
  offeringSalesStartAt?: string | null
  offeringSalesEndAt?: string | null
  now?: Date
}): TicketOfferingSaleStatus {
  const config = input.eventConfig || {}
  const now = input.now ?? new Date()
  const nowMs = now.getTime()

  if (config.salesStatus === "sales_closed") {
    return {
      onSale: false,
      reason: "Registration is closed for this event.",
      salesStartAt: config.salesOpenAt ?? null,
      salesEndAt: config.salesCloseAt ?? null,
    }
  }

  if (config.salesStatus === "draft") {
    return {
      onSale: false,
      reason: "Registration is not published yet.",
      salesStartAt: config.salesOpenAt ?? null,
      salesEndAt: config.salesCloseAt ?? null,
    }
  }

  const salesStartAt = input.offeringSalesStartAt ?? config.salesOpenAt ?? null
  const salesEndAt = input.offeringSalesEndAt ?? config.salesCloseAt ?? null

  const startMs = salesStartAt ? new Date(salesStartAt).getTime() : null
  const endMs = salesEndAt ? new Date(salesEndAt).getTime() : null

  if (startMs != null && nowMs < startMs) {
    return {
      onSale: false,
      reason: "Registration for this offering has not opened yet.",
      salesStartAt,
      salesEndAt,
    }
  }

  if (endMs != null && nowMs > endMs) {
    return {
      onSale: false,
      reason: "Registration for this offering has closed.",
      salesStartAt,
      salesEndAt,
    }
  }

  return { onSale: true, salesStartAt, salesEndAt }
}

export function formatTicketPrice(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}
