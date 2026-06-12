"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import {
  ClipboardList,
  CalendarCheck,
  Baby,
  Users,
  Truck,
  Ticket,
  Clock,
  ChevronRight,
  Plus,
  ClipboardCheck,
  MapPin,
  AlertTriangle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Header } from "@/components/layout/header"
import { InternalEventDbStatusBadge } from "@/components/events/internal-event-db-status-badge"
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
  DashboardAttentionItem,
  DashboardTimePeriod,
  EventManagementDashboardData,
} from "@/lib/events/internal-event-dashboard-types"
import { cn } from "@/lib/utils"

const ATTENTION_ICONS: Record<DashboardAttentionItem["kind"], LucideIcon> = {
  approval: ClipboardCheck,
  childcare: Baby,
  volunteers: Users,
  vendors: Truck,
  draft: AlertTriangle,
  schedule: CalendarCheck,
  location: MapPin,
}

const ATTENTION_COLORS: Record<DashboardAttentionItem["kind"], string> = {
  approval: "bg-amber-100 text-amber-700",
  childcare: "bg-pink-100 text-pink-700",
  volunteers: "bg-blue-100 text-blue-700",
  vendors: "bg-orange-100 text-orange-700",
  draft: "bg-yellow-100 text-yellow-700",
  schedule: "bg-slate-100 text-slate-700",
  location: "bg-violet-100 text-violet-700",
}

function AttentionCard({ item }: { item: DashboardAttentionItem }) {
  const Icon = ATTENTION_ICONS[item.kind]

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40",
        item.priority === "high" && "border-amber-200 bg-amber-50/50"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          ATTENTION_COLORS[item.kind]
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium group-hover:text-primary">{item.title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
        {item.meta ? (
          <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
        ) : null}
      </div>
      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
    </Link>
  )
}

function KpiCard({
  href,
  icon: Icon,
  iconClassName,
  count,
  label,
}: {
  href?: string
  icon: LucideIcon
  iconClassName: string
  count: number
  label: string
}) {
  const content = (
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            iconClassName
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground">{count}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </CardContent>
  )

  if (href && count > 0) {
    return (
      <Card className="transition-colors hover:border-primary/40">
        <Link href={href}>{content}</Link>
      </Card>
    )
  }

  return <Card>{content}</Card>
}

export function EventManagementOverviewClient({
  data,
  period,
  canManage,
}: {
  data: EventManagementDashboardData
  period: DashboardTimePeriod
  canManage: boolean
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

  const { kpis, attentionItems } = data

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
          <KpiCard
            href="/event-management?status=draft"
            icon={ClipboardList}
            iconClassName="bg-amber-100 text-amber-700"
            count={kpis.draftCount}
            label="Draft Events"
          />
          <KpiCard
            href="/event-management?status=scheduled"
            icon={CalendarCheck}
            iconClassName="bg-emerald-100 text-emerald-700"
            count={kpis.scheduledCount}
            label="Scheduled Events"
          />
          <KpiCard
            href="#attention-required"
            icon={Baby}
            iconClassName="bg-pink-100 text-pink-700"
            count={kpis.childcareRequired}
            label="Need Childcare"
          />
          <KpiCard
            href="#attention-required"
            icon={Users}
            iconClassName="bg-blue-100 text-blue-700"
            count={kpis.volunteersRequired}
            label="Need Volunteers"
          />
          <KpiCard
            href="#attention-required"
            icon={Truck}
            iconClassName="bg-orange-100 text-orange-700"
            count={kpis.vendorsRequired}
            label="Need Vendors"
          />
          <KpiCard
            href="/event-management"
            icon={Ticket}
            iconClassName="bg-violet-100 text-violet-700"
            count={kpis.ticketedEvents}
            label="Ticketed Events"
          />
        </div>

        <section id="attention-required" className="space-y-3">
          <div>
            <h3 className="text-base font-semibold">Attention required</h3>
            <p className="text-sm text-muted-foreground">
              Open an event to approve requests, assign childcare, volunteers, and more.
            </p>
          </div>
          {attentionItems.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Nothing needs your attention right now.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {attentionItems.map((item) => (
                <AttentionCard key={item.id} item={item} />
              ))}
            </div>
          )}
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
                  <Link href="/facilities/availability" className="text-xs">
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
      </div>
    </>
  )
}
