export type TicketingSalesStatus = "published" | "draft" | "sales_closed"

export type EventTicketingConfig = {
  salesOpenAt?: string | null
  salesCloseAt?: string | null
  currency?: string
  salesStatus?: TicketingSalesStatus
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
        .map((row, index) => ({
          id: row.id.startsWith("new-") ? undefined : row.id,
          name: row.name.trim(),
          description: row.description.trim() || null,
          priceCents: Math.round(Number.parseFloat(row.price || "0") * 100),
          quantityTotal: row.quantity.trim()
            ? Number.parseInt(row.quantity, 10)
            : null,
          sortOrder: index,
        }))
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

export function formatTicketPrice(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}
