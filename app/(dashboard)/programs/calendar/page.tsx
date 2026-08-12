import { Suspense } from "react"

import { ProgramsSectionNav } from "@/components/programs/programs-section-nav"
import { createAudienceCalendarPage } from "@/lib/reservations/calendar-page"
import { RESERVATION_SOURCE_TYPES } from "@/lib/reservations/reservation-types"
import { PERMISSIONS } from "@/lib/permissions/permissions"

const ProgramsCalendarPage = createAudienceCalendarPage(
  "ops",
  [
    PERMISSIONS.SPACES_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.PROGRAMS_VIEW,
  ],
  "Programs",
  {
    defaultSourceTypes: [RESERVATION_SOURCE_TYPES.programFacility],
    sectionNav: (
      <Suspense fallback={null}>
        <ProgramsSectionNav />
      </Suspense>
    ),
  }
)

export default ProgramsCalendarPage
