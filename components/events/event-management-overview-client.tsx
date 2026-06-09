"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import {
  ClipboardList,
  Calendar,
  CalendarCheck,
  Baby,
  Users,
  Truck,
  Ticket,
  Clock,
  AlertTriangle,
  ChevronRight,
  Download,
  Eye,
  Plus,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { InternalEventRequestsQueue } from "@/components/events/internal-event-requests-queue"
import { InternalEventDbStatusBadge } from "@/components/events/internal-event-db-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatEventDate } from "@/lib/events/internal-event-format"
import type {
  DashboardTimePeriod,
  EventManagementDashboardData,
} from "@/lib/events/internal-event-dashboard-types"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import { cn } from "@/lib/utils"

export function EventManagementOverviewClient({
  data,
  period,
  canManage,
  pendingRequests = [],
}: {
  data: EventManagementDashboardData
  period: DashboardTimePeriod
  canManage: boolean
  pendingRequests?: InternalEventWithRelations[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function setPeriod(nextPeriod: DashboardTimePeriod) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPeriod === "this-week") {
      params.delete("period")
    } else {
      params.set("period", nextPeriod)
    }

    const query = params.toString()
    startTransition(() => {
      router.push(
        query
          ? `/event-management/overview?${query}`
          : "/event-management/overview"
      )
    })
  }

  const { kpis } = data

  return (
    <>
      <Header title="Event Management" />

      <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor internal events, operations, and today&apos;s schedule.
              Status counts reflect all active events.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canManage ? (
              <Button asChild size="sm">
                <Link href="/event-management/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Event
                </Link>
              </Button>
            ) : null}
            <Select
              value={period}
              onValueChange={(value) => setPeriod(value as DashboardTimePeriod)}
              disabled={isPending}
            >
              <SelectTrigger className="w-[140px] bg-card">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <ClipboardList className="h-5 w-5 text-amber-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">
                    {kpis.draftCount}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Draft Events
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                  <CalendarCheck className="h-5 w-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">
                    {kpis.scheduledCount}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Scheduled Events
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-100">
                  <Baby className="h-5 w-5 text-pink-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">
                    {kpis.childcareRequired}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Need Childcare
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">
                    {kpis.volunteersRequired}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Need Volunteers
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                  <Truck className="h-5 w-5 text-orange-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">
                    {kpis.vendorsRequired}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Need Vendors
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                  <Ticket className="h-5 w-5 text-violet-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">
                    {kpis.ticketedEvents}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Ticketed Events
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button asChild className="h-9 sm:h-10">
            <Link href="/event-management?status=draft">
              <Eye className="mr-1.5 h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Review Drafts</span>
              <span className="sm:hidden">Drafts</span>
              {kpis.draftCount > 0 ? (
                <Badge variant="secondary" className="ml-1.5 bg-white/20 sm:ml-2">
                  {kpis.draftCount}
                </Badge>
              ) : null}
            </Link>
          </Button>
          <Button variant="outline" className="h-9 sm:h-10" asChild>
            <Link href="/event-management/calendar">
              <Calendar className="mr-1.5 h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">View Calendar</span>
              <span className="sm:hidden">Calendar</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-9 sm:h-10" asChild>
            <Link href="/workforce/childcare/registrations">
              <Baby className="mr-1.5 h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Assign Childcare</span>
              <span className="sm:hidden">Childcare</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-9 sm:h-10" asChild>
            <Link href="/workforce/volunteers">
              <Users className="mr-1.5 h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Open Volunteer Needs</span>
              <span className="sm:hidden">Volunteers</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-9 sm:h-10" disabled>
            <Download className="mr-1.5 h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export Report</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>

        <section id="event-requests" className="space-y-3">
          <div>
            <h3 className="text-base font-semibold">Event requests</h3>
            <p className="text-sm text-muted-foreground">
              Review department event requests awaiting supervisor approval.
            </p>
          </div>
          <InternalEventRequestsQueue
            requests={pendingRequests}
            canManage={canManage}
          />
        </section>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Recent Events
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/event-management" className="text-xs">
                    View All
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentEvents.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No events yet. Create your first internal event to get started.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">Event</TableHead>
                        <TableHead className="text-xs">Location</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentEvents.map((event) => (
                        <TableRow key={event.id} className="group">
                          <TableCell className="py-2.5">
                            <Link href={event.href} className="block">
                              <p className="text-sm font-medium hover:text-amber-700">
                                {event.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {event.departmentName}
                              </p>
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5 text-sm">
                            {event.locationLabel || "—"}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm">
                            {formatEventDate(event.eventDate)}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <InternalEventDbStatusBadge status={event.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Today&apos;s Schedule
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/event-management/calendar" className="text-xs">
                    View Calendar
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {data.todaysSchedule.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No events scheduled for today.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">Event</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                        <TableHead className="text-xs">Location</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.todaysSchedule.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="py-2.5">
                            <Link
                              href={event.href}
                              className="text-sm font-medium hover:text-amber-700"
                            >
                              {event.name}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {event.timeLabel}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-sm">
                            {event.locationLabel || "—"}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <InternalEventDbStatusBadge status={event.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Operational Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.operationalAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No operational alerts right now.
                </p>
              ) : (
                data.operationalAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-lg border p-3",
                      alert.type === "warning"
                        ? "border-amber-200 bg-amber-50"
                        : "border-blue-200 bg-blue-50"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Event: {alert.eventDate}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs" asChild>
                      <Link href={alert.href}>{alert.action}</Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Events Needing Action
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.eventsNeedingAction.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All upcoming events look good.
                </p>
              ) : (
                data.eventsNeedingAction.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {event.eventName}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px]",
                            event.priority === "high" &&
                              "border-red-200 bg-red-50 text-red-700",
                            event.priority === "medium" &&
                              "border-amber-200 bg-amber-50 text-amber-700",
                            event.priority === "low" &&
                              "border-gray-200 bg-gray-50 text-gray-600"
                          )}
                        >
                          {event.daysUntil}d
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {event.actionRequired}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 shrink-0" asChild>
                      <Link href={event.href}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
