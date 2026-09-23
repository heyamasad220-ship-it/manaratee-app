"use client"

import Link from "next/link"
import { useState } from "react"
import {
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  LayoutGrid,
  Plus,
  Store,
  Users,
} from "lucide-react"

import { CreateBazaarEventDrawer } from "@/components/bazaar/create-bazaar-event-drawer"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { formatCalendarDate } from "@/lib/vendor-hub/vendor-hub-overview"
import type {
  VendorHubEventWithInternal,
  VendorHubOrgDashboardMetrics,
} from "@/lib/vendor-hub/vendor-hub-types"

export function VendorHubDashboardClient({
  metrics,
  upcomingEvents,
  currentEventName,
  boothsOpen,
  boothsTotal,
  unpaidBooths,
}: {
  metrics: VendorHubOrgDashboardMetrics
  upcomingEvents: VendorHubEventWithInternal[]
  currentEventName: string | null
  boothsOpen: number
  boothsTotal: number
  unpaidBooths: number
}) {
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const currentEventId = metrics.currentEventId
  const reservedBooths = Math.max(0, boothsTotal - boothsOpen)

  const actionItems: Array<{ id: string; label: string; href: string }> = []
  if (metrics.onboardingPending > 0) {
    actionItems.push({
      id: "onboarding",
      label: `${metrics.onboardingPending} vendor application${metrics.onboardingPending === 1 ? "" : "s"} waiting`,
      href: VENDOR_HUB_ROUTES.network.onboarding,
    })
  }
  if (currentEventId && metrics.boothRequestsPending > 0) {
    actionItems.push({
      id: "requests",
      label: `${metrics.boothRequestsPending} booth request${metrics.boothRequestsPending === 1 ? "" : "s"}${currentEventName ? ` for ${currentEventName}` : ""}`,
      href: VENDOR_HUB_ROUTES.events.booths(currentEventId),
    })
  }
  if (currentEventId && unpaidBooths > 0) {
    actionItems.push({
      id: "unpaid",
      label: `${unpaidBooths} unpaid booth${unpaidBooths === 1 ? "" : "s"}${currentEventName ? ` for ${currentEventName}` : ""}`,
      href: VENDOR_HUB_ROUTES.events.booths(currentEventId),
    })
  }
  if (currentEventId && boothsOpen > 0) {
    actionItems.push({
      id: "open-booths",
      label: `${boothsOpen} booth${boothsOpen === 1 ? "" : "s"} still open${currentEventName ? ` for ${currentEventName}` : ""}`,
      href: VENDOR_HUB_ROUTES.events.booths(currentEventId),
    })
  }

  const quickActions = [
    {
      id: "create-event",
      label: "Create bazaar",
      icon: Plus,
      onClick: () => setCreateDrawerOpen(true),
    },
    {
      id: "network",
      label: "Vendor Network",
      icon: Users,
      href: VENDOR_HUB_ROUTES.network.vendors,
    },
    {
      id: "onboarding",
      label: "Vendor onboarding",
      icon: FileText,
      href: VENDOR_HUB_ROUTES.network.onboarding,
    },
    {
      id: "reports",
      label: "Reports",
      icon: DollarSign,
      href: VENDOR_HUB_ROUTES.reports,
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Dashboard Overview</h2>
        <p className="text-sm text-muted-foreground">
          Bazaars, vendors, items needing attention, and next steps
        </p>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_13.5rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <DonationMetricCardGrid colorful compact className="lg:grid-cols-4">
            <Link href={VENDOR_HUB_ROUTES.events.list} className="min-w-0">
              <DonationMetricCard
                compact
                title="Active events"
                value={upcomingEvents.length}
                icon={Store}
                accent="blue"
                description="Today and upcoming bazaars"
              />
            </Link>
            <Link href={VENDOR_HUB_ROUTES.network.onboarding} className="min-w-0">
              <DonationMetricCard
                compact
                title="Onboarding pending"
                value={metrics.onboardingPending}
                icon={FileText}
                accent="amber"
                description="Vendor applications to review"
              />
            </Link>
            {currentEventId ? (
              <Link href={VENDOR_HUB_ROUTES.events.booths(currentEventId)} className="min-w-0">
                <DonationMetricCard
                  compact
                  title="Booth requests"
                  value={metrics.boothRequestsPending}
                  icon={ClipboardList}
                  accent="purple"
                  description={currentEventName || "Next bazaar"}
                />
              </Link>
            ) : (
              <DonationMetricCard
                compact
                title="Booth requests"
                value={0}
                icon={ClipboardList}
                accent="purple"
                description="No upcoming bazaar"
              />
            )}
            {currentEventId ? (
              <Link href={VENDOR_HUB_ROUTES.events.booths(currentEventId)} className="min-w-0">
                <DonationMetricCard
                  compact
                  title="Booths still open"
                  value={boothsOpen}
                  icon={LayoutGrid}
                  accent="emerald"
                  description={
                    boothsTotal > 0
                      ? `${reservedBooths} of ${boothsTotal} reserved`
                      : currentEventName || "Next bazaar"
                  }
                />
              </Link>
            ) : (
              <DonationMetricCard
                compact
                title="Booths still open"
                value={0}
                icon={LayoutGrid}
                accent="emerald"
                description="No upcoming bazaar"
              />
            )}
          </DonationMetricCardGrid>

          <div className="grid flex-1 gap-4 md:grid-cols-2">
            <Card className="h-full">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Action Required</CardTitle>
                <CardDescription className="text-xs">
                  Operational items that need staff attention
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {actionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No vendor actions need attention right now.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {actionItems.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-sm transition hover:bg-muted/50"
                        >
                          <span>{item.label}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
                <div>
                  <CardTitle className="text-sm">Active events</CardTitle>
                  <CardDescription className="text-xs">Today and upcoming bazaars</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                  <Link href={VENDOR_HUB_ROUTES.events.list}>View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active bazaars.</p>
                ) : (
                  <ul className="space-y-2">
                    {upcomingEvents.slice(0, 4).map((event) => {
                      const location =
                        event.location ||
                        event.venue_name ||
                        event.internal_event?.location_label ||
                        "Location not set"
                      const isCurrent = event.id === currentEventId
                      return (
                        <li key={event.id} className="space-y-1 rounded-md border p-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <Link
                              href={VENDOR_HUB_ROUTES.events.detail(event.id)}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {event.name}
                            </Link>
                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatCalendarDate(event.event_date, { weekday: true }) || "Date not set"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {location}
                            {isCurrent && boothsTotal > 0
                              ? ` · ${reservedBooths} of ${boothsTotal} booths reserved`
                              : ""}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="h-full">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Jump to common bazaar workflows</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <ul className="space-y-2">
              {quickActions.map((action) => {
                const Icon = action.icon
                const className =
                  "inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                if (action.href) {
                  return (
                    <li key={action.id}>
                      <Link href={action.href} className={className}>
                        <Icon className="h-4 w-4 shrink-0" />
                        {action.label}
                      </Link>
                    </li>
                  )
                }
                return (
                  <li key={action.id}>
                    <button type="button" onClick={action.onClick} className={className}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {action.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <CreateBazaarEventDrawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen} />
    </div>
  )
}
