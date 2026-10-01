"use client"

import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  Baby,
  Banknote,
  CalendarClock,
  ClipboardList,
  MapPin,
  Repeat,
  Store,
  Ticket,
  Users,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  StatCard,
  StatCardsRow,
  type StatCardTone,
} from "@/components/ui/stat-card"
import { eventManagementOrdersHref } from "@/lib/events/event-management-reports-path"
import type { EventOverviewSummary } from "@/lib/events/event-overview-metrics"

const KPI_STYLES: Record<string, { tone: StatCardTone; icon: LucideIcon }> = {
  type: { tone: "indigo", icon: Repeat },
  schedule: { tone: "blue", icon: CalendarClock },
  location: { tone: "teal", icon: MapPin },
  childcare: { tone: "violet", icon: Baby },
  volunteers: { tone: "amber", icon: Users },
  vendors: { tone: "orange", icon: Store },
}

export function InternalEventOverviewKpis({
  overview,
}: {
  overview: EventOverviewSummary
}) {
  const { kpis } = overview
  if (kpis.length === 0) return null

  const kpiColumns = Math.min(6, Math.max(2, kpis.length)) as 2 | 3 | 4 | 5 | 6

  return (
    <StatCardsRow equal columns={kpiColumns}>
      {kpis.map((kpi) => {
        const style = KPI_STYLES[kpi.id] ?? {
          tone: "slate" as const,
          icon: ClipboardList,
        }
        return (
          <StatCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            icon={style.icon}
            tone={style.tone}
            layout="compact"
            fill
          />
        )
      })}
    </StatCardsRow>
  )
}

export function InternalEventOverviewDashboard({
  overview,
  canManage,
  eventId,
  coordinatorName,
  onNavigateTab,
}: {
  overview: EventOverviewSummary
  canManage: boolean
  eventId: string
  coordinatorName?: string | null
  onNavigateTab: (tab: string) => void
}) {
  const { features, alerts, staff, vendors } = overview

  const showStaff = features.staff || staff.paidCount > 0
  const showVendors = features.vendors

  return (
    <div className="flex flex-col gap-6">
      {coordinatorName ? (
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            Coordinator: {coordinatorName}
          </span>
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Attention needed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>{alert.message}</span>
                {alert.hrefTab && canManage ? (
                  alert.hrefTab === "attendees" ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={eventManagementOrdersHref(eventId)}>Open</Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigateTab(alert.hrefTab!)}
                    >
                      Open
                    </Button>
                  )
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.registration ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Ticket className="h-4 w-4" />
                  Ticketing
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ticket types, prices, orders, and check-in.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab("ticketing")}
              >
                Open
              </Button>
            </CardHeader>
          </Card>
        ) : null}

        {showStaff ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Staff
                </CardTitle>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab("staff")}
                >
                  Manage
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Paid: <span className="font-medium">{staff.paidCount}</span>
              </p>
              <p>
                Volunteers:{" "}
                <span className="font-medium">{staff.volunteerCount}</span>
              </p>
              <p className="text-muted-foreground">Tasks: {staff.taskCount}</p>
            </CardContent>
          </Card>
        ) : null}

        {showVendors ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Store className="h-4 w-4" />
                  Vendors
                </CardTitle>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab("vendors")}
                >
                  Manage
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="text-sm">
              <p>
                Assigned: <span className="font-medium">{vendors.count}</span>
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Banknote className="h-4 w-4" />
                Reports
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                What this event spent, and tickets sold by type.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab("reports")}
            >
              Open
            </Button>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
