import { getCalendarVenues } from "@/lib/reservations/reservation-queries"
import { VENUE_USAGE_TAGS } from "@/lib/bookings/venue-usage"

export function getInternalCalendarVenues() {
  return getCalendarVenues({
    usageTags: [VENUE_USAGE_TAGS.internal],
    activeOnly: true,
  })
}

export function getExternalCalendarVenues() {
  return getCalendarVenues({
    usageTags: [VENUE_USAGE_TAGS.external],
    activeOnly: true,
  })
}
