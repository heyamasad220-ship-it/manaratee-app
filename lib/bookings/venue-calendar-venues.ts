import { getCalendarVenues } from "@/lib/reservations/reservation-queries"

/** All active spaces — used by Event Management and Programs. */
export function getActiveCalendarVenues() {
  return getCalendarVenues({ activeOnly: true })
}

/** Spaces open to Venue Rentals / customer booking. */
export function getBookableCalendarVenues() {
  return getCalendarVenues({ bookableOnly: true, activeOnly: true })
}
