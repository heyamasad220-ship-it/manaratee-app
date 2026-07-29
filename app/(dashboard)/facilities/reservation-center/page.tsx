import { Header } from "@/components/layout/header"
import { ReservationCenterOpsPanel } from "@/components/facilities/reservation-center-ops-panel"
import {
  MasterCalendarLegend,
  NeedSpaceIntakeCard,
} from "@/components/facilities/need-space-intake-card"
import {
  getActiveTemporaryHolds,
  getUpcomingOperationalBriefs,
} from "@/lib/operational-briefs/operational-brief-queries"
import { getMasterCalendarConflictSummary } from "@/lib/operational-briefs/reservation-center-queries"
import {
  hasFacilitiesOnlyAccess,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function ReservationCenterPage() {
  await requireAnyPermission(
    PERMISSIONS.SPACES_VIEW,
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_VIEW
  )

  const facilitiesOnly = await hasFacilitiesOnlyAccess()

  const [upcomingBriefs, temporaryHolds, conflicts] = await Promise.all([
    getUpcomingOperationalBriefs(),
    getActiveTemporaryHolds(),
    getMasterCalendarConflictSummary(),
  ])

  return (
    <>
      <Header title="Facilities" />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold">Reservation Center</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {facilitiesOnly
              ? "Operational hub for facility setup. Review upcoming reservations, conflicts, and setup briefs on the calendar. Create maintenance blocks and closures from Calendar."
              : "Day-to-day facility operations: upcoming briefs, temporary holds, and schedule conflicts. Payments and rental approvals live in Venue Rentals."}
          </p>
          <div className="mt-3">
            <MasterCalendarLegend />
          </div>
        </div>

        <NeedSpaceIntakeCard facilitiesOnly={facilitiesOnly} />

        <ReservationCenterOpsPanel
          upcomingBriefs={upcomingBriefs}
          temporaryHolds={temporaryHolds}
          conflicts={conflicts}
        />
      </div>
    </>
  )
}
