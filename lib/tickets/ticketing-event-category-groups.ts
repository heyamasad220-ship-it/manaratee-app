import { isTicketedEventPast } from "@/lib/tickets/ticketing-overview-types"
import type { TicketedEventOverviewRow } from "@/lib/tickets/ticketing-overview-types"

export type TicketingEventsWhenFilter = "active" | "past" | "all"

export const TICKETING_EVENTS_CATEGORY_FILTER_ALL = "all"

export function filterTicketedEventsByWhen(
  events: TicketedEventOverviewRow[],
  when: TicketingEventsWhenFilter,
  now = new Date()
) {
  if (when === "all") return events
  return events.filter((event) => {
    const past = isTicketedEventPast(event, now)
    return when === "past" ? past : !past
  })
}

export function filterTicketedEventsByCategory(
  events: TicketedEventOverviewRow[],
  categoryFilter: string
) {
  if (categoryFilter === TICKETING_EVENTS_CATEGORY_FILTER_ALL) return events
  if (categoryFilter === "none") {
    return events.filter((event) => !event.ticketingCategoryId)
  }
  return events.filter((event) => event.ticketingCategoryId === categoryFilter)
}
