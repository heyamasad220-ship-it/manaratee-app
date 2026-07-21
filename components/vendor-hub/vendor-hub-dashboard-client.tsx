"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  AlertCircle,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Globe,
  MapPin,
  Plus,
  Send,
  Star,
  Store,
  TrendingUp,
  Users,
} from "lucide-react"

import { CreateBazaarEventDrawer } from "@/components/bazaar/create-bazaar-event-drawer"
import { VendorHubEventSelector } from "@/components/vendor-hub/vendor-hub-event-selector"
import { useVendorHubEvent } from "@/components/vendor-hub/vendor-hub-event-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { cn } from "@/lib/utils"

type DashboardMetrics = {
  applicationsPendingReview: number
  approvedVendors: number
  boothsTotal: number
  boothsAssigned: number
  revenueCollected: number
  outstandingBalance: number
  vendorsMissingDocuments: number
  vendorsMissingPayment: number
  vendorsPendingEvaluation: number
  vendorsParticipated: number
}

const emptyMetrics: DashboardMetrics = {
  applicationsPendingReview: 0,
  approvedVendors: 0,
  boothsTotal: 0,
  boothsAssigned: 0,
  revenueCollected: 0,
  outstandingBalance: 0,
  vendorsMissingDocuments: 0,
  vendorsMissingPayment: 0,
  vendorsPendingEvaluation: 0,
  vendorsParticipated: 0,
}

export function VendorHubDashboardClient({
  initialMetrics,
}: {
  initialMetrics: DashboardMetrics
}) {
  const { selectedEvent, selectedEventId, events } = useVendorHubEvent()
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [metrics, setMetrics] = useState(initialMetrics)
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  useEffect(() => {
    if (!selectedEventId) {
      setMetrics(emptyMetrics)
      return
    }

    let cancelled = false
    setLoadingMetrics(true)

    fetch(`/api/vendor-hub/dashboard-metrics?eventId=${selectedEventId}`)
      .then((response) => response.json())
      .then((data: DashboardMetrics) => {
        if (!cancelled) {
          setMetrics(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMetrics(emptyMetrics)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMetrics(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedEventId])

  const displayDate =
    selectedEvent?.event_date ??
    selectedEvent?.internal_event?.start_at?.slice(0, 10) ??
    "Date not set"

  const displayLocation =
    selectedEvent?.location ??
    selectedEvent?.internal_event?.location_label ??
    "Location not set"

  const displayTime = selectedEvent?.start_time ?? "Time not set"

  const eventHasPassed = (() => {
    const eventDate = selectedEvent?.event_date
    if (!eventDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(eventDate) < today
  })()

  const needsAttention = [
    metrics.applicationsPendingReview > 0
      ? {
          id: "applications",
          title: `${metrics.applicationsPendingReview} vendor onboarding application(s) pending`,
          href: VENDOR_HUB_ROUTES.network.onboarding,
        }
      : null,
    metrics.outstandingBalance > 0
      ? {
          id: "payments",
          title: `$${metrics.outstandingBalance.toFixed(2)} outstanding balance`,
          href: selectedEventId
            ? VENDOR_HUB_ROUTES.events.payments(selectedEventId)
            : VENDOR_HUB_ROUTES.events.list,
        }
      : null,
    metrics.vendorsMissingDocuments > 0
      ? {
          id: "documents",
          title: `${metrics.vendorsMissingDocuments} vendor(s) missing documents`,
          href: VENDOR_HUB_ROUTES.network.documents,
        }
      : null,
    eventHasPassed && metrics.vendorsPendingEvaluation > 0
      ? {
          id: "evaluations",
          title: `${metrics.vendorsPendingEvaluation} vendor evaluation(s) pending`,
          href: selectedEventId
            ? VENDOR_HUB_ROUTES.events.evaluations(selectedEventId)
            : VENDOR_HUB_ROUTES.events.list,
        }
      : null,
    selectedEvent?.calendar_status === "not_published"
      ? {
          id: "publish",
          title: "Event not published to community calendar",
          href: VENDOR_HUB_ROUTES.communityCalendar,
        }
      : null,
  ].filter(Boolean) as { id: string; title: string; href: string }[]

  const healthStats = [
    {
      label: "Onboarding pending",
      value: metrics.applicationsPendingReview,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Approved Vendors",
      value: metrics.approvedVendors,
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Booth Occupancy",
      value: `${metrics.boothsAssigned}/${metrics.boothsTotal}`,
      icon: Store,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Revenue Collected",
      value: `$${metrics.revenueCollected.toFixed(2)}`,
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Outstanding Balance",
      value: `$${metrics.outstandingBalance.toFixed(2)}`,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      label: "Expected Attendance",
      value: selectedEvent?.expected_attendees?.toLocaleString?.() ?? "0",
      icon: TrendingUp,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendor network health, active bazaars, and community coordination.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <VendorHubEventSelector />
          <Button onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Vendor Event
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {selectedEvent?.name ?? "No vendor event selected"}
                </h2>
                {selectedEvent?.internal_event_id ? (
                  <Badge variant="secondary">Linked to internal event</Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {displayDate}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {displayLocation}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {displayTime}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={!selectedEvent}
              onClick={() => setCreateDrawerOpen(true)}
            >
              Edit Event Details
            </Button>
          </CardContent>
        </Card>

        {events.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No vendor events yet. Create one to start managing vendors, booths, and payments.
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {healthStats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      {loadingMetrics ? "—" : stat.value}
                    </p>
                  </div>
                  <div className={cn("rounded-lg p-2", stat.bgColor)}>
                    <stat.icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Needs Attention</CardTitle>
              <CardDescription>Items that may need action before the event</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {needsAttention.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nothing needs attention right now.
                </div>
              ) : (
                needsAttention.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium">{item.title}</span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Timeline</CardTitle>
              <CardDescription>Key milestones for this event</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <div className="rounded-lg border border-dashed p-4">
                Timeline milestones will appear here once application deadlines and programming
                schedules are configured.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
            <CardDescription>Latest vendor hub updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Activity feed coming soon. Application reviews, booth assignments, and payments will
              appear here.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Common tasks for managing your vendor event</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link href={VENDOR_HUB_ROUTES.network.onboarding}>
                <Button variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Vendor onboarding
                </Button>
              </Link>
              <Link
                href={
                  selectedEventId
                    ? VENDOR_HUB_ROUTES.events.applications(selectedEventId)
                    : VENDOR_HUB_ROUTES.events.list
                }
              >
                <Button variant="outline" className="gap-2">
                  <Store className="h-4 w-4" />
                  View reservations
                </Button>
              </Link>
              <Link
                href={
                  selectedEventId
                    ? VENDOR_HUB_ROUTES.events.booths(selectedEventId)
                    : VENDOR_HUB_ROUTES.events.list
                }
              >
                <Button variant="outline" className="gap-2">
                  <Store className="h-4 w-4" />
                  Assign Booths
                </Button>
              </Link>
              <Link
                href={
                  selectedEventId
                    ? VENDOR_HUB_ROUTES.events.payments(selectedEventId)
                    : VENDOR_HUB_ROUTES.events.list
                }
              >
                <Button variant="outline" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Record Payment
                </Button>
              </Link>
              <Link
                href={
                  selectedEventId
                    ? VENDOR_HUB_ROUTES.events.evaluations(selectedEventId)
                    : VENDOR_HUB_ROUTES.events.list
                }
              >
                <Button variant="outline" className="gap-2">
                  <Star className="h-4 w-4" />
                  Vendor evaluations
                </Button>
              </Link>
              <Link href={VENDOR_HUB_ROUTES.communityCalendar}>
                <Button variant="outline" className="gap-2">
                  <Globe className="h-4 w-4" />
                  Community Calendar
                </Button>
              </Link>
              <Link href={VENDOR_HUB_ROUTES.network.vendors}>
                <Button variant="outline" className="gap-2">
                  <Users className="h-4 w-4" />
                  Vendor Network
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
            <CardDescription>Key dates to remember</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No upcoming deadlines yet. Configure application and payment deadlines in Settings.
            </div>
          </CardContent>
        </Card>
      </div>

      <CreateBazaarEventDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
        eventData={selectedEvent}
      />
    </div>
  )
}
