import { createCalendarPage } from "@/lib/reservations/calendar-page"
import { PERMISSIONS } from "@/lib/permissions/permissions"

export default createCalendarPage(
  "facilities",
  [PERMISSIONS.SPACES_VIEW, PERMISSIONS.BOOKINGS_VIEW],
  "Master Calendar"
)
