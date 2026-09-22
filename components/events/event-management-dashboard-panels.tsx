"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTransition, type ReactNode } from "react"
import {
  CalendarCheck,
  Baby,
  Users,
  Truck,
  ChevronRight,
  ClipboardCheck,
  MapPin,
  AlertTriangle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreateInternalEventButton } from "@/components/events/create-internal-event-button"
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
import { EVENT_MANAGEMENT_EVENTS_PATH } from "@/lib/events/event-management-section-path"
import { formatEventDate, formatEventTimeRange } from "@/lib/events/internal-event-format"
import type {
  DashboardAttentionItem,
  DashboardTimePeriod,
  DashboardUpcomingEventRow,
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
  icon: Icon,
  iconClassName,
  value,
  label,
  hint,
}: {
  icon: LucideIcon
  iconClassName: string
  value: ReactNode
  label: string
  hint?: string
}) {
  return (
    <Card>
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
            <p className="truncate text-2xl font-bold text-foreground">{value}</p>
            <p className="truncate text-xs text-muted-foreground">{label}</p>
            {hint ? (
              <p className="truncate text-xs text-muted-foreground">{hint}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function NeedTag({
  needed,
  label,
  className,
}: {
  needed: boolean
  label: string
  className: string
}) {
  if (!needed) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {label}
    </span>
  )
}

function ThisMonthUpcomingTable({
  events,
}: {
  events: DashboardUpcomingEventRow[]
}) {
  const monthLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">This month</h2>
        <p className="text-sm text-muted-foreground">
          Upcoming events in {monthLabel}.
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No upcoming events this month.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Childcare</TableHead>
                  <TableHead>Volunteers</TableHead>
                  <TableHead>Vendors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={event.href}
                          className="font-medium text-primary hover:underline"
                        >
                          {event.name}
                        </Link>
                        {event.ticketed ? (
                          <Badge className="border-0 bg-violet-100 text-violet-700 hover:bg-violet-100">
                            Ticketed
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-foreground">
                      <div>{formatEventDate(event.startAt)}</div>
                      {event.startAt ? (
                        <div className="text-xs text-muted-foreground">
                          {formatEventTimeRange(event.startAt, event.endAt)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <NeedTag
                        needed={event.needsChildcare}
                        label="Needed"
                        className="bg-pink-100 text-pink-700"
                      />
                    </TableCell>
                    <TableCell>
                      <NeedTag
                        needed={event.needsVolunteers}
                        label="Needed"
                        className="bg-blue-100 text-blue-700"
                      />
                    </TableCell>
                    <TableCell>
                      <NeedTag
                        needed={event.needsVendors}
                        label="Needed"
                        className="bg-orange-100 text-orange-700"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

/** KPI header + attention panels. */
export function EventManagementDashboardPanels({
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
    if (nextPeriod === "all") {
      params.delete("period")
    } else {
      params.set("period", nextPeriod)
    }

    // Drop legacy catalog filter params.
    params.delete("q")
    params.delete("status")
    params.delete("department")
    params.delete("eventType")
    params.delete("view")

    const query = params.toString()
    startTransition(() => {
      router.push(query ? `/event-management?${query}` : "/event-management")
    })
  }

  const { kpis, upcomingThisMonth, attentionItems } = data

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">
            Upcoming events and staffing needs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild size="sm" variant="outline">
            <Link href={EVENT_MANAGEMENT_EVENTS_PATH}>View all events</Link>
          </Button>
          {canManage ? <CreateInternalEventButton /> : null}
          <Select
            value={period}
            onValueChange={(value) => setPeriod(value as DashboardTimePeriod)}
            disabled={isPending}
          >
            <SelectTrigger className="w-[150px] bg-card">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="past">Past Events</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-2xl font-bold text-foreground">
                  {kpis.upcomingOneTimeCount.toLocaleString("en-US")}{" "}
                  <span className="text-sm font-medium text-muted-foreground">
                    one-time
                  </span>
                </p>
                <p className="truncate text-2xl font-bold text-foreground">
                  {kpis.upcomingRecurringCount.toLocaleString("en-US")}{" "}
                  <span className="text-sm font-medium text-muted-foreground">
                    recurring
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <KpiCard
          icon={Baby}
          iconClassName="bg-pink-100 text-pink-700"
          value={kpis.childcareRequired}
          label="Need Childcare"
        />
        <KpiCard
          icon={Users}
          iconClassName="bg-blue-100 text-blue-700"
          value={kpis.volunteersRequired}
          label="Need Volunteers"
        />
        <KpiCard
          icon={Truck}
          iconClassName="bg-orange-100 text-orange-700"
          value={kpis.vendorsRequired}
          label="Need Vendors"
        />
      </div>

      <ThisMonthUpcomingTable events={upcomingThisMonth} />

      <section id="attention-required" className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Attention required</h2>
          <p className="text-sm text-muted-foreground">
            Open an event to complete pending work, assign childcare, volunteers, and
            more.
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
    </div>
  )
}
