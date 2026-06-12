import { createAudienceCalendarPage } from "@/lib/reservations/calendar-page"
import { PERMISSIONS } from "@/lib/permissions/permissions"

export default createAudienceCalendarPage(
  "staff",
  [
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.SPACES_VIEW,
  ],
  "Space Availability"
)
