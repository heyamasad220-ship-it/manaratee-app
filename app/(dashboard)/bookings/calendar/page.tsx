import { createCalendarPage } from "@/lib/reservations/calendar-page"
import { PERMISSIONS } from "@/lib/permissions/permissions"

export default createCalendarPage(
  "venue_rentals",
  [PERMISSIONS.BOOKINGS_VIEW],
  "Venue Rentals"
)
