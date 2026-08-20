"use client"

import type { ReactNode } from "react"
import {
  Activity,
  AlertTriangle,
  Banknote,
  ClipboardList,
  Store,
  Users,
  UsersRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EventOverviewSummary } from "@/lib/events/event-overview-metrics"
import {
  formatActivityWhen,
  type EventRecentActivityItem,
} from "@/lib/events/event-recent-activity"

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function formatOptionalDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function InternalEventOverviewDashboard({
  overview,
  canManage,
  eventId: _eventId,
  departmentName,
  eventTypeName,
  coordinatorName,
  details,
  recentActivity = [],
  onNavigateTab,
}: {
  overview: EventOverviewSummary
  canManage: boolean
  eventId: string
  departmentName?: string | null
  eventTypeName?: string | null
  coordinatorName?: string | null
  details: ReactNode
  recentActivity?: EventRecentActivityItem[]
  onNavigateTab: (tab: string) => void
}) {
  const { features, kpis, alerts, registration, youth, staff, vendors, finance } =
    overview

  const showYouth = features.youth
  const showStaff =
    features.staff || staff.paidCount + staff.volunteerCount > 0
  const showVendors = features.vendors
  const showFinance =
    features.finance ||
    finance.expenseCents > 0 ||
    finance.ticketRevenueCents > 0 ||
    finance.refundCents > 0

  return (
    <div className="flex flex-col gap-6">
      {(departmentName || eventTypeName || coordinatorName) && (
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {departmentName ? (
            <Badge variant="secondary">{departmentName}</Badge>
          ) : null}
          {eventTypeName ? (
            <Badge variant="outline">{eventTypeName}</Badge>
          ) : null}
          {coordinatorName ? (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              Coordinator: {coordinatorName}
            </span>
          ) : null}
        </div>
      )}

      {kpis.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight">{kpi.value}</p>
                {kpi.hint ? (
                  <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateTab(alert.hrefTab!)}
                  >
                    Open
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" />
                Registration
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {registration.modeLabel}
              </p>
            </div>
            {canManage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab("registration")}
              >
                Manage
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Registered:{" "}
              <span className="font-medium">
                {registration.capacity != null
                  ? `${registration.registered} / ${registration.capacity}`
                  : registration.registered}
              </span>
            </p>
            {registration.remaining != null ? (
              <p className="text-muted-foreground">
                Remaining: {registration.remaining}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              Sales: {formatOptionalDate(registration.salesOpenAt)} →{" "}
              {formatOptionalDate(registration.salesCloseAt)}
            </p>
          </CardContent>
        </Card>

        {showYouth ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UsersRound className="h-4 w-4" />
                  Youth
                </CardTitle>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab("youth")}
                >
                  Manage
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Registered:{" "}
                <span className="font-medium">
                  {youth.capacity != null
                    ? `${youth.registered} / ${youth.capacity}`
                    : youth.registered}
                </span>
              </p>
              {youth.groups.length > 0 ? (
                <ul className="text-muted-foreground">
                  {youth.groups.map((group) => (
                    <li key={group.name}>
                      {group.name}
                      {group.capacity != null ? ` · cap ${group.capacity}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
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

        {showFinance ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Banknote className="h-4 w-4" />
                  Finance
                </CardTitle>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateTab("finance")}
                >
                  Manage
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Revenue:{" "}
                <span className="font-medium">
                  {formatMoney(finance.ticketRevenueCents, finance.currency)}
                </span>
              </p>
              <p>
                Expenses:{" "}
                <span className="font-medium">
                  {formatMoney(finance.expenseCents, finance.currency)}
                </span>
              </p>
              <p>
                Net:{" "}
                <span className="font-medium">
                  {formatMoney(finance.netCents, finance.currency)}
                </span>
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {recentActivity.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recentActivity.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-2"
              >
                <span>{item.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatActivityWhen(item.when)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {details}
    </div>
  )
}
