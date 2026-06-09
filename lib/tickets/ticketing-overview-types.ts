import type { TicketingSalesStatus } from "./ticket-types"

export type TicketedEventOverviewRow = {
  id: string
  name: string
  venueName: string | null
  locationLabel: string | null
  startAt: string | null
  endAt: string | null
  salesStatus: TicketingSalesStatus
  ticketsIssued: number
  ticketsCapacity: number | null
  ticketsRemaining: number | null
  revenueCents: number
  currency: string
}

export function formatEventSchedule(startAt: string | null, endAt: string | null) {
  if (!startAt) return "Date TBD"
  const start = new Date(startAt)
  const startLabel = start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  if (!endAt) return startLabel
  const end = new Date(endAt)
  const endTime = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
  return `${startLabel} – ${endTime}`
}

export function isTicketedEventPast(
  event: { startAt: string | null; endAt: string | null },
  now = new Date()
) {
  const end = event.endAt
    ? new Date(event.endAt)
    : event.startAt
      ? new Date(event.startAt)
      : null

  if (!end || Number.isNaN(end.getTime())) return false
  return end.getTime() < now.getTime()
}
