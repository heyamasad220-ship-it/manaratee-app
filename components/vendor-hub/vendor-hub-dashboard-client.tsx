"use client"

import Link from "next/link"
import { useState } from "react"
import {
  AlertCircle,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Globe,
  MapPin,
  Plus,
  Store,
  Users,
} from "lucide-react"

import { CreateBazaarEventDrawer } from "@/components/bazaar/create-bazaar-event-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, StatCardsRow, type StatCardTone } from "@/components/ui/stat-card"
import { VendorHubReportsOverviewPanels } from "@/components/vendor-hub/vendor-hub-reports-overview-panels"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import type { VendorHubReportOverview } from "@/lib/vendor-hub/vendor-hub-reports-queries"
import type {
  VendorHubEventWithInternal,
  VendorHubOrgDashboardMetrics,
} from "@/lib/vendor-hub/vendor-hub-types"

function formatEventDate(value?: string | null) {
  if (!value) return "Date not set"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function VendorHubDashboardClient({
  metrics,
  upcomingEvents,
  reportsOverview,
}: {
  metrics: VendorHubOrgDashboardMetrics
  upcomingEvents: VendorHubEventWithInternal[]
  reportsOverview: VendorHubReportOverview
}) {
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)

  const healthStats: Array<{
    label: string
    value: string | number
    icon: typeof FileText
    tone: StatCardTone
    href: string
  }> = [
    {
      label: "Onboarding pending",
      value: metrics.onboardingPending,
      icon: FileText,
      tone: "amber",
      href: VENDOR_HUB_ROUTES.network.onboarding,
    },
    {
      label: "Active vendors",
      value: metrics.activeVendors,
      icon: Users,
      tone: "emerald",
      href: VENDOR_HUB_ROUTES.network.vendors,
    },
    {
      label: "Revenue collected",
      value: `$${metrics.revenueCollected.toFixed(2)}`,
      icon: DollarSign,
      tone: "violet",
      href: VENDOR_HUB_ROUTES.reports,
    },
    {
      label: "Outstanding balance",
      value: `$${metrics.outstandingBalance.toFixed(2)}`,
      icon: AlertCircle,
      tone: "rose",
      href: VENDOR_HUB_ROUTES.reports,
    },
  ]

  const quickActions = [
    {
      id: "create-event",
      label: "Create Vendor Event",
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
      id: "history",
      label: "Participation History",
      icon: Store,
      href: VENDOR_HUB_ROUTES.reportsHistory(),
    },
    {
      id: "calendar",
      label: "Community Calendar",
      icon: Globe,
      href: VENDOR_HUB_ROUTES.communityCalendar,
    },
    {
      id: "reports",
      label: "Reports",
      icon: DollarSign,
      href: VENDOR_HUB_ROUTES.reports,
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-6 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organization-wide vendor health, sales snapshot, and upcoming bazaars.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <StatCardsRow equal columns={4}>
          {healthStats.map((stat) => (
            <Link key={stat.label} href={stat.href} className="min-w-0">
              <StatCard
                fill
                layout="header"
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                tone={stat.tone}
                className="h-full transition-shadow hover:shadow-sm"
              />
            </Link>
          ))}
        </StatCardsRow>

        <VendorHubReportsOverviewPanels overview={reportsOverview} scopeLabel="All events" />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming events</CardTitle>
              <CardDescription>
                Today and future bazaars — open an event for booths, vendors, and payments.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {upcomingEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No upcoming vendor events. Create one to start planning your next bazaar.
                </div>
              ) : (
                upcomingEvents.map((event) => {
                  const location =
                    event.location ||
                    event.venue_name ||
                    event.internal_event?.location_label ||
                    "Location not set"
                  const time = event.start_time || "Time not set"

                  return (
                    <Link
                      key={event.id}
                      href={VENDOR_HUB_ROUTES.events.detail(event.id)}
                      className="flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{event.name}</span>
                          {event.internal_event_id ? (
                            <Badge variant="secondary">Linked</Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatEventDate(event.event_date)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {time}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {location}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-primary">Open workspace</span>
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card className="h-fit lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription>Organization shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {quickActions.map((action) =>
                  action.href ? (
                    <Button
                      key={action.id}
                      variant="outline"
                      className="h-auto w-full justify-start gap-2 px-3 py-2.5"
                      asChild
                    >
                      <Link href={action.href}>
                        <action.icon className="h-4 w-4 shrink-0" />
                        <span className="text-left">{action.label}</span>
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      key={action.id}
                      variant="outline"
                      className="h-auto w-full justify-start gap-2 px-3 py-2.5"
                      onClick={action.onClick}
                    >
                      <action.icon className="h-4 w-4 shrink-0" />
                      <span className="text-left">{action.label}</span>
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateBazaarEventDrawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen} />
    </div>
  )
}
