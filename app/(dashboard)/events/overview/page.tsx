"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ClipboardList,
  CalendarCheck,
  Baby,
  Users,
  Truck,
  Ticket,
  Clock,
  AlertTriangle,
  ChevronRight,
  Download,
  Ban,
  Eye,
} from "lucide-react"
import { InternalEventStatusBadge, type InternalEventStatus } from "@/lib/status-badges"
import { cn } from "@/lib/utils"

const kpiData = {
  pendingRequests: 0,
  approvedEvents: 0,
  childcareRequired: 0,
  volunteersRequired: 0,
  vendorsRequired: 0,
  ticketedEvents: 0,
}

const recentRequests: {
  id: string
  eventName: string
  requestedBy: string
  requestedDate: string
  eventDate: string
  space: string
  status: InternalEventStatus
}[] = []

const todaysSchedule: {
  id: string
  eventName: string
  time: string
  space: string
  status: InternalEventStatus
  attendees: number
}[] = []

const operationalAlerts: {
  id: string
  type: string
  message: string
  eventDate: string
  action: string
}[] = []

const eventsNeedingAction: {
  id: string
  eventName: string
  eventDate: string
  actionRequired: string
  daysUntil: number
  priority: string
}[] = []

export default function OverviewPage() {
  const [timePeriod, setTimePeriod] = useState("this-week")

  return (
    <>
      <Header title="Internal Events" />
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Overview</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor event requests, operations, and today&apos;s schedule
            </p>
          </div>
          <Select value={timePeriod} onValueChange={setTimePeriod}>
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

        {/* KPI Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <ClipboardList className="h-5 w-5 text-amber-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">{kpiData.pendingRequests}</p>
                  <p className="text-xs text-muted-foreground truncate">Pending Requests</p>
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
                  <p className="text-2xl font-bold text-foreground">{kpiData.approvedEvents}</p>
                  <p className="text-xs text-muted-foreground truncate">Approved Events</p>
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
                  <p className="text-2xl font-bold text-foreground">{kpiData.childcareRequired}</p>
                  <p className="text-xs text-muted-foreground truncate">Need Childcare</p>
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
                  <p className="text-2xl font-bold text-foreground">{kpiData.volunteersRequired}</p>
                  <p className="text-xs text-muted-foreground truncate">Need Volunteers</p>
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
                  <p className="text-2xl font-bold text-foreground">{kpiData.vendorsRequired}</p>
                  <p className="text-xs text-muted-foreground truncate">Need Vendors</p>
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
                  <p className="text-2xl font-bold text-foreground">{kpiData.ticketedEvents}</p>
                  <p className="text-xs text-muted-foreground truncate">Ticketed Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button asChild className="h-9 sm:h-10">
              <Link href="/bookings/requests">
              <Eye className="mr-1.5 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Review Requests</span>
              <span className="sm:hidden">Review</span>
              <Badge variant="secondary" className="ml-1.5 sm:ml-2 bg-white/20">{kpiData.pendingRequests}</Badge>
            </Link>
          </Button>
          <Button variant="outline" className="h-9 sm:h-10">
            <Ban className="mr-1.5 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Block Space</span>
            <span className="sm:hidden">Block</span>
          </Button>
          <Button variant="outline" className="h-9 sm:h-10">
            <Baby className="mr-1.5 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Assign Childcare</span>
            <span className="sm:hidden">Childcare</span>
          </Button>
          <Button variant="outline" className="h-9 sm:h-10">
            <Users className="mr-1.5 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Open Volunteer Needs</span>
            <span className="sm:hidden">Volunteers</span>
          </Button>
          <Button variant="outline" className="h-9 sm:h-10">
            <Download className="mr-1.5 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export Report</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Event Requests */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Event Requests</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/bookings/requests" className="text-xs">
                    View All
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Event</TableHead>
                      <TableHead className="text-xs">Space</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                          No data yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentRequests.map((request) => (
                        <TableRow key={request.id} className="group">
                          <TableCell className="py-2.5">
                            <div>
                              <p className="font-medium text-sm">{request.eventName}</p>
                              <p className="text-xs text-muted-foreground">{request.requestedBy}</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-sm">{request.space}</TableCell>
                          <TableCell className="py-2.5 text-sm">{request.eventDate}</TableCell>
                          <TableCell className="py-2.5">
                            <InternalEventStatusBadge status={request.status} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Today's Internal Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Today&apos;s Schedule</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/events/calendar" className="text-xs">
                    View Calendar
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Event</TableHead>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Space</TableHead>
                      <TableHead className="text-xs text-right">Attendees</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaysSchedule.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                          No data yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      todaysSchedule.map((event) => (
                        <TableRow key={event.id} className="group">
                          <TableCell className="py-2.5">
                            <p className="font-medium text-sm">{event.eventName}</p>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {event.time}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-sm">{event.space}</TableCell>
                          <TableCell className="py-2.5 text-sm text-right">{event.attendees}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Operational Alerts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Operational Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {operationalAlerts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No data yet.</p>
              ) : (
                operationalAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-lg border p-3",
                      alert.type === "warning" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Event: {alert.eventDate}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs">
                      {alert.action}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Upcoming Events Needing Action */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Events Needing Action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {eventsNeedingAction.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No data yet.</p>
              ) : (
                eventsNeedingAction.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{event.eventName}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] shrink-0",
                            event.priority === "high" && "border-red-200 bg-red-50 text-red-700",
                            event.priority === "medium" && "border-amber-200 bg-amber-50 text-amber-700",
                            event.priority === "low" && "border-gray-200 bg-gray-50 text-gray-600"
                          )}
                        >
                          {event.daysUntil}d
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.actionRequired}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 h-8">
                      <ChevronRight className="h-4 w-4" />
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
