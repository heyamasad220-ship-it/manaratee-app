export const EVENT_PLANNING_KINDS = ["dinner_venue", "kids_venue", "transport"] as const

export type EventPlanningKind = (typeof EVENT_PLANNING_KINDS)[number]

export const EVENT_PLANNING_KIND_LABELS: Record<EventPlanningKind, string> = {
  dinner_venue: "Dinner venue",
  kids_venue: "Kids program venue",
  transport: "Transportation",
}

export const EVENT_PLANNING_QUOTE_STATUSES = ["considering", "chosen", "passed"] as const

export type EventPlanningQuoteStatus = (typeof EVENT_PLANNING_QUOTE_STATUSES)[number]

export type EventPlanningPlace = {
  id: string
  kind: EventPlanningKind
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  waiverUrl: string | null
  notes: string | null
}

export type EventPlanningQuote = {
  id: string
  placeId: string
  status: EventPlanningQuoteStatus
  priceCents: number | null
  includedNotes: string | null
  referencePriceCents: number | null
  sourceEventId: string | null
  place: EventPlanningPlace
}

export type EventPlanningSheet = {
  expectedHeadcount: number | null
  otherCostCents: number | null
  worksheetNotes: string | null
  whatsappGroupUrl: string | null
  kidsMessage: string | null
  kidsTicketTypeIds: string[]
}

export type EventPlanningPastEvent = {
  id: string
  name: string
  startAt: string | null
}

export function planningCostPerGuest(input: {
  dinnerCents: number | null
  kidsCents: number | null
  transportCents: number | null
  otherCents: number | null
  headcount: number | null
}) {
  if (input.headcount == null || input.headcount < 1) return null
  const parts = [
    input.dinnerCents,
    input.kidsCents,
    input.transportCents,
    input.otherCents,
  ].filter((value): value is number => value != null && value > 0)
  if (parts.length === 0) return null
  const total = parts.reduce((sum, value) => sum + value, 0)
  return Math.round(total / input.headcount)
}

export function dollarsToCents(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const amount = Number.parseFloat(trimmed)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100)
}

export function centsToDollarInput(cents: number | null) {
  if (cents == null) return ""
  return (cents / 100).toFixed(2)
}
