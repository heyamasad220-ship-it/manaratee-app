import Link from "next/link"
import type { ReactNode } from "react"
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileWarning,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { MasterCalendarLegend } from "@/components/facilities/need-space-intake-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  getVenueRentalDashboardStats,
  getVenueRentalQueueRows,
} from "@/lib/bookings/venue-rental-queries"
import { countOperationalBriefsNeedingReview } from "@/lib/operational-briefs/operational-brief-queries"
import { getMasterCalendarConflictSummary } from "@/lib/operational-briefs/reservation-center-queries"
import {
  hasFacilitiesOnlyAccess,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

function MetricLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Button
      variant="link"
      className={`mt-2 h-auto p-0 text-xs ${className ?? ""}`}
      asChild
    >
      <Link href={href}>{children}</Link>
    </Button>
  )
}

export default async function BookingsOverviewPage() {
  await requireAnyPermission(
    PERMISSIONS.SPACES_VIEW,
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_VIEW
  )

  const facilitiesOnly = await hasFacilitiesOnlyAccess()

  const [briefsNeedingReview, conflicts, rows] = await Promise.all([
      countOperationalBriefsNeedingReview(),
      getMasterCalendarConflictSummary(),
      facilitiesOnly ? Promise.resolve([]) : getVenueRentalQueueRows(),
    ])

  const stats = facilitiesOnly ? null : getVenueRentalDashboardStats(rows)
  const metricCount = facilitiesOnly ? 2 : 6

  return (
    <>
      <Header title="Bookings" />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Snapshot of bookings activity across spaces, venue rentals, and facility
            setup. Use Reservation Center for day-to-day ops and Calendar for the full
            schedule.
          </p>
          <div className="mt-3">
            <MasterCalendarLegend />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            {facilitiesOnly ? "Facility metrics" : "Venue rental queue metrics"}
          </h3>
          <StatCardsRow equal columns={metricCount === 2 ? 2 : 6}>
            {!facilitiesOnly && stats ? (
              <>
                <StatCard
                  layout="header"
                  fill
                  tone="amber"
                  label="Awaiting approval"
                  value={stats.awaitingApprovalCount}
                  icon={ClipboardList}
                  footer={
                    <MetricLink href="/bookings/requests" className="text-amber-800">
                      Venue rental queue
                    </MetricLink>
                  }
                />
                <StatCard
                  layout="header"
                  fill
                  tone="sky"
                  label="Awaiting payment"
                  value={stats.awaitingPaymentCount}
                  icon={CreditCard}
                  footer={
                    <MetricLink href="/bookings/overview" className="text-sky-800">
                      Venue rentals dashboard
                    </MetricLink>
                  }
                />
                <StatCard
                  layout="header"
                  fill
                  tone="emerald"
                  label="Confirmed rentals"
                  value={stats.confirmedCount}
                  icon={CalendarCheck2}
                  footer={
                    <MetricLink
                      href="/facilities/calendar"
                      className="text-emerald-800"
                    >
                      Calendar
                    </MetricLink>
                  }
                />
                <StatCard
                  layout="header"
                  fill
                  tone="rose"
                  label="Rental queue conflicts"
                  value={stats.conflictCount}
                  icon={AlertTriangle}
                  footer={
                    <MetricLink href="/bookings/requests" className="text-rose-800">
                      Venue rental queue
                    </MetricLink>
                  }
                />
              </>
            ) : null}

            <StatCard
              layout="header"
              fill
              tone="violet"
              label="Operational briefs needing review"
              value={briefsNeedingReview}
              icon={FileWarning}
              footer={
                <MetricLink
                  href="/facilities/reservation-center"
                  className="text-violet-800"
                >
                  Reservation Center
                </MetricLink>
              }
            />
            <StatCard
              layout="header"
              fill
              tone="slate"
              label="Schedule conflicts (this week)"
              value={conflicts.conflictCount}
              icon={AlertTriangle}
              footer={
                <MetricLink href="/facilities/calendar" className="text-slate-700">
                  Open calendar
                </MetricLink>
              }
            />
          </StatCardsRow>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
            <CardDescription>
              Jump to bookings workflows and facility tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {!facilitiesOnly ? (
              <Button variant="outline" className="h-auto justify-start py-3" asChild>
                <Link href="/bookings/requests">
                  <ClipboardList className="mr-2 h-4 w-4 shrink-0" />
                  Venue Rentals
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" className="h-auto justify-start py-3" asChild>
              <Link href="/facilities/reservation-center">
                <ClipboardList className="mr-2 h-4 w-4 shrink-0" />
                Reservation Center
              </Link>
            </Button>
            <Button variant="outline" className="h-auto justify-start py-3" asChild>
              <Link href="/facilities/calendar">
                <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
                Calendar
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
