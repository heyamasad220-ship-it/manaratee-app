import { createAudienceCalendarPage } from "@/lib/reservations/calendar-page"
import { PERMISSIONS } from "@/lib/permissions/permissions"

export default createAudienceCalendarPage(
  "ops",
  [PERMISSIONS.SPACES_VIEW, PERMISSIONS.BOOKINGS_VIEW],
  "Schedule"
)
