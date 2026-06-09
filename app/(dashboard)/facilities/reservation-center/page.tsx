import Link from "next/link"
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  Sparkles,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { VenueRentalTransitionReportPanel } from "@/components/bookings/venue-rental-transition-report-panel"
import { ReservationCenterOpsPanel } from "@/components/facilities/reservation-center-ops-panel"
import {
  MasterCalendarLegend,
  NeedSpaceIntakeCard,
} from "@/components/facilities/need-space-intake-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getVenueRentalDashboardStats,
  getVenueRentalQueueRows,
} from "@/lib/bookings/venue-rental-queries"
import {
  countOperationalBriefsNeedingReview,
  getActiveTemporaryHolds,
  getUpcomingOperationalBriefs,
} from "@/lib/operational-briefs/operational-brief-queries"
import { getMasterCalendarConflictSummary } from "@/lib/operational-briefs/reservation-center-queries"
import {
  hasAnyPermission,
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

  const [rows, canManageTransition, briefsNeedingReview, upcomingBriefs, temporaryHolds, conflicts] =
    await Promise.all([
      getVenueRentalQueueRows(),
      hasAnyPermission(PERMISSIONS.BOOKINGS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
      countOperationalBriefsNeedingReview(),
      getUpcomingOperationalBriefs(),
      getActiveTemporaryHolds(),
      getMasterCalendarConflictSummary(),
    ])

  const stats = getVenueRentalDashboardStats(rows)

  return (
    <>
      <Header title="Facilities" />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold">Reservation Center</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Operational hub for shared reservation infrastructure. Business workflows live in
            Venue Rentals, Event Management, and Programs. This view surfaces cross-module
            visibility, conflicts, and facility setup — use module calendars for your slice, and
            the master calendar for the full picture.
          </p>
          <div className="mt-3">
            <MasterCalendarLegend />
          </div>
        </div>

        <NeedSpaceIntakeCard />

        <ReservationCenterOpsPanel
          upcomingBriefs={upcomingBriefs}
          temporaryHolds={temporaryHolds}
          conflicts={conflicts}
        />

        <Card className={briefsNeedingReview > 0 ? "border-amber-200" : undefined}>
          <CardHeader className="pb-2">
            <CardDescription>Operational briefs needing review</CardDescription>
            <CardTitle className="text-2xl">{briefsNeedingReview}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-muted-foreground">
              Setup briefs flagged as needs review or with reported issues. Open a reservation on
              the master calendar to view facility setup details.
            </p>
            <Button variant="link" className="h-auto p-0" asChild>
              <Link href="/facilities/calendar">Open master calendar</Link>
            </Button>
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            Venue rental queue metrics
          </h3>
          <div className="flex flex-wrap gap-4 [&>*]:w-fit">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Awaiting approval</CardDescription>
              <CardTitle className="text-2xl">{stats.awaitingApprovalCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="link" className="h-auto p-0" asChild>
                <Link href="/bookings/requests">Venue rental queue</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Awaiting payment</CardDescription>
              <CardTitle className="text-2xl">{stats.awaitingPaymentCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="link" className="h-auto p-0" asChild>
                <Link href="/bookings/overview">Venue rentals dashboard</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Confirmed rentals</CardDescription>
              <CardTitle className="text-2xl">{stats.confirmedCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="link" className="h-auto p-0" asChild>
                <Link href="/bookings/calendar">Venue rentals calendar</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className={stats.conflictCount > 0 ? "border-amber-200" : undefined}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                {stats.conflictCount > 0 ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                ) : null}
                Rental queue conflicts
              </CardDescription>
              <CardTitle className="text-2xl">{stats.conflictCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="link" className="h-auto p-0" asChild>
                <Link href="/bookings/requests">Venue rental queue</Link>
              </Button>
            </CardContent>
          </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Module workflows</CardTitle>
            <CardDescription>
              Jump to business modules that write reservations into the shared engine.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto justify-start py-3" asChild>
              <Link href="/bookings/requests">
                <ClipboardList className="mr-2 h-4 w-4 shrink-0" />
                Venue Rentals
              </Link>
            </Button>
            <Button variant="outline" className="h-auto justify-start py-3" asChild>
              <Link href="/event-management/calendar">
                <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                Event Management
              </Link>
            </Button>
            <Button variant="outline" className="h-auto justify-start py-3" asChild>
              <Link href="/facilities/settings/spaces">
                <LayoutGrid className="mr-2 h-4 w-4 shrink-0" />
                Spaces
              </Link>
            </Button>
            <Button variant="outline" className="h-auto justify-start py-3" asChild>
              <Link href="/facilities/calendar">
                <Sparkles className="mr-2 h-4 w-4 shrink-0" />
                Master Calendar
              </Link>
            </Button>
          </CardContent>
        </Card>

        {canManageTransition ? <VenueRentalTransitionReportPanel /> : null}
      </div>
    </>
  )
}
