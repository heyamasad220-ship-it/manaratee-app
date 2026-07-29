import Link from "next/link"
import type { ReactNode } from "react"
import {
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  FileWarning,
  Package,
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
import {
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

export default async function FacilitiesOverviewPage() {
  await requireAnyPermission(
    PERMISSIONS.SPACES_VIEW,
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_VIEW
  )

  const [briefsNeedingReview, rows] = await Promise.all([
    countOperationalBriefsNeedingReview(),
    getVenueRentalQueueRows({ skipConflictCheck: true }),
  ])

  const stats = getVenueRentalDashboardStats(rows)

  return (
    <>
      <Header title="Facilities" />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            What facility staff need to run the building: confirmed schedule activity and
            setup work. Approvals and payments live in Venue Rentals. Spaces cannot be
            double-booked — unavailable times are blocked when requesting a rental or event.
          </p>
          <div className="mt-3">
            <MasterCalendarLegend />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            Facility metrics
          </h3>
          <StatCardsRow equal columns={2}>
            <StatCard
              layout="header"
              fill
              tone="emerald"
              label="Confirmed rentals"
              value={stats.confirmedCount}
              icon={CalendarCheck2}
              footer={
                <MetricLink href="/facilities/calendar" className="text-emerald-800">
                  View on calendar
                </MetricLink>
              }
            />
            <StatCard
              layout="header"
              fill
              tone="violet"
              label="Setup briefs needing review"
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
          </StatCardsRow>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
            <CardDescription>
              Jump to facility schedule and inventory tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
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
            <Button variant="outline" className="h-auto justify-start py-3" asChild>
              <Link href="/facilities/inventory">
                <Package className="mr-2 h-4 w-4 shrink-0" />
                Inventory
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
