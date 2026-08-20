"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Globe,
  MapPin,
} from "lucide-react"

import { Header } from "@/components/layout/header"
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
import { eventManagementMasterCalendarHref } from "@/lib/events/event-management-section-path"
import { getInternalEventStatusLabel } from "@/lib/events/internal-event-status"
import {
  formatInternalEventLocation,
  getInternalEventMeetingLink,
  INTERNAL_EVENT_LOCATION_TYPE_LABELS,
  INTERNAL_EVENT_LOCATION_TYPES,
  inferInternalEventLocationType,
} from "@/lib/events/internal-event-location"
import {
  buildFacilitiesBookSpaceHref,
  CREATE_EVENT_CTA_LABEL,
  MASTER_CALENDAR_LABEL,
} from "@/lib/events/facility-event-request-href"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import { cn } from "@/lib/utils"

type DepartmentOption = {
  id: string
  name: string
}

type InternalEventsCalendarClientProps = {
  events: InternalEventWithRelations[]
  /** Upcoming list (may span beyond the visible month). */
  upcomingEvents?: InternalEventWithRelations[]
  departments: DepartmentOption[]
  initialMonth: string
  initialDepartmentId: string | null
  canBookSpace: boolean
  returnTo?: string | null
  /** When true, page already rendered Header + Events section tabs. */
  hideHeader?: boolean
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function parseMonthParam(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return startOfMonth(new Date())
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const date = new Date(year, month, 1)
  return Number.isNaN(date.getTime()) ? startOfMonth(new Date()) : date
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function toMonthParam(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatTime(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

function locationIcon(event: InternalEventWithRelations) {
  const type = inferInternalEventLocationType(event)
  if (type === INTERNAL_EVENT_LOCATION_TYPES.online) return Globe
  if (type === INTERNAL_EVENT_LOCATION_TYPES.external) return MapPin
  return Building2
}

function locationTone(event: InternalEventWithRelations) {
  const type = inferInternalEventLocationType(event)
  if (type === INTERNAL_EVENT_LOCATION_TYPES.online) {
    return "border-sky-200 bg-sky-50 text-sky-800"
  }
  if (type === INTERNAL_EVENT_LOCATION_TYPES.external) {
    return "border-amber-200 bg-amber-50 text-amber-900"
  }
  if (type === INTERNAL_EVENT_LOCATION_TYPES.facility) {
    return "border-emerald-200 bg-emerald-50 text-emerald-900"
  }
  return "border-border bg-muted/40 text-foreground"
}

function formatEventDate(value: string | null) {
  if (!value) return "Date TBD"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date TBD"
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatEventTimeRange(startAt: string | null, endAt: string | null) {
  const start = formatTime(startAt)
  const end = formatTime(endAt)
  if (start && end) return `${start} – ${end}`
  return start || end || "Time TBD"
}

function locationTypeBadgeLabel(event: InternalEventWithRelations) {
  const type = inferInternalEventLocationType(event)
  if (!type) return "Location"
  return INTERNAL_EVENT_LOCATION_TYPE_LABELS[type]
}

export function InternalEventsCalendarClient({
  events,
  upcomingEvents,
  departments,
  initialMonth,
  initialDepartmentId,
  canBookSpace,
  returnTo = null,
  hideHeader = false,
}: InternalEventsCalendarClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const monthAnchor = useMemo(() => parseMonthParam(initialMonth), [initialMonth])
  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    const today = toDateKey(new Date())
    const inMonth = events.some((event) => {
      if (!event.start_at) return false
      return toDateKey(new Date(event.start_at)) === today
    })
    return inMonth ? today : toDateKey(monthAnchor)
  })

  const eventsByDay = useMemo(() => {
    const map = new Map<string, InternalEventWithRelations[]>()
    for (const event of events) {
      if (!event.start_at) continue
      const key = toDateKey(new Date(event.start_at))
      const list = map.get(key) || []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events])

  const monthCells = useMemo(() => {
    const first = startOfMonth(monthAnchor)
    const startPad = first.getDay()
    const daysInMonth = new Date(
      monthAnchor.getFullYear(),
      monthAnchor.getMonth() + 1,
      0
    ).getDate()
    const cells: Array<{ key: string; day: number | null; inMonth: boolean }> = []

    for (let i = 0; i < startPad; i += 1) {
      cells.push({ key: `pad-${i}`, day: null, inMonth: false })
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), day)
      cells.push({ key: toDateKey(date), day, inMonth: true })
    }
    while (cells.length % 7 !== 0) {
      cells.push({ key: `trail-${cells.length}`, day: null, inMonth: false })
    }
    return cells
  }, [monthAnchor])

  const upcomingList = useMemo(() => {
    const source = upcomingEvents ?? events
    const now = Date.now()
    return [...source]
      .filter((event) => {
        if (!event.start_at) return false
        return new Date(event.start_at).getTime() >= now - 60_000
      })
      .sort((a, b) => {
        const aTime = a.start_at ? new Date(a.start_at).getTime() : 0
        const bTime = b.start_at ? new Date(b.start_at).getTime() : 0
        return aTime - bTime
      })
  }, [events, upcomingEvents])

  function pushQuery(next: { month?: string; department?: string | null }) {
    const department =
      next.department === undefined ? initialDepartmentId : next.department
    startTransition(() => {
      router.push(
        eventManagementMasterCalendarHref({
          month: next.month ?? toMonthParam(monthAnchor),
          departmentId: department,
          returnTo,
        })
      )
    })
  }

  function shiftMonth(delta: number) {
    const next = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + delta, 1)
    pushQuery({ month: toMonthParam(next) })
  }

  function buildBookSpaceHref(dateKey?: string) {
    return buildFacilitiesBookSpaceHref({
      departmentId: initialDepartmentId,
      returnTo:
        returnTo ||
        eventManagementMasterCalendarHref({
          departmentId: initialDepartmentId,
        }),
      openNew: true,
      date: dateKey || undefined,
    })
  }

  const monthLabel = monthAnchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  return (
    <>
      {hideHeader ? null : <Header title="Events" />}

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{MASTER_CALENDAR_LABEL}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Read-only view of department events (Center, Online, External Venue). To create
              an event or book facility space, use Facilities calendar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/facilities/calendar?sources=internal_event">
                Facility schedule
              </Link>
            </Button>
            {canBookSpace ? (
              <Button size="sm" asChild>
                <Link href={buildBookSpaceHref()}>{CREATE_EVENT_CTA_LABEL}</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => shiftMonth(-1)}
              disabled={isPending}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[10rem] text-center text-sm font-semibold">
              {monthLabel}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => shiftMonth(1)}
              disabled={isPending}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => pushQuery({ month: toMonthParam(new Date()) })}
              disabled={isPending}
            >
              Today
            </Button>
          </div>

          <div className="w-full sm:w-56">
            <Select
              value={initialDepartmentId || "all"}
              onValueChange={(value) =>
                pushQuery({ department: value === "all" ? null : value })
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells.map((cell) => {
                  if (!cell.inMonth || cell.day == null) {
                    return <div key={cell.key} className="min-h-[4.5rem] rounded-md" />
                  }
                  const dayEvents = eventsByDay.get(cell.key) || []
                  const isSelected = cell.key === selectedDateKey
                  const isToday = cell.key === toDateKey(new Date())

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => setSelectedDateKey(cell.key)}
                      className={cn(
                        "flex min-h-[4.5rem] flex-col rounded-md border px-1.5 py-1 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:border-border hover:bg-muted/40",
                        isToday && !isSelected ? "ring-1 ring-primary/40" : ""
                      )}
                    >
                      <span className="text-xs font-medium">{cell.day}</span>
                      <div className="mt-1 flex flex-col gap-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            className={cn(
                              "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                              locationTone(event)
                            )}
                            title={event.name}
                          >
                            {event.name}
                          </span>
                        ))}
                        {dayEvents.length > 3 ? (
                          <span className="text-[10px] text-muted-foreground">
                            +{dayEvents.length - 3} more
                          </span>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Upcoming events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingList.length === 0 ? (
                <div className="space-y-3 py-6 text-center">
                  <p className="text-sm text-muted-foreground">No upcoming events.</p>
                  {canBookSpace ? (
                    <Button size="sm" asChild>
                      <Link href={buildBookSpaceHref()}>{CREATE_EVENT_CTA_LABEL}</Link>
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                  {upcomingList.map((event) => {
                    const Icon = locationIcon(event)
                    const locationType = inferInternalEventLocationType(event)
                    const meetingLink = getInternalEventMeetingLink(event)
                    const locationDetail = formatInternalEventLocation(event)

                    return (
                      <li key={event.id}>
                        <Link
                          href={`/event-management/${event.id}`}
                          className="block rounded-md border px-3 py-3 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-sm font-semibold leading-snug">
                              {event.name}
                            </p>
                            <Badge variant="outline" className="shrink-0">
                              {getInternalEventStatusLabel(event.status)}
                            </Badge>
                          </div>

                          <dl className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                            <div className="flex gap-2">
                              <dt className="w-16 shrink-0 font-medium text-foreground/70">
                                Date
                              </dt>
                              <dd>{formatEventDate(event.start_at)}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="w-16 shrink-0 font-medium text-foreground/70">
                                Time
                              </dt>
                              <dd>
                                {formatEventTimeRange(event.start_at, event.end_at)}
                              </dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="w-16 shrink-0 font-medium text-foreground/70">
                                Type
                              </dt>
                              <dd className="flex items-center gap-1.5">
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                {locationTypeBadgeLabel(event)}
                              </dd>
                            </div>
                            {locationType === INTERNAL_EVENT_LOCATION_TYPES.online ? (
                              <div className="flex gap-2">
                                <dt className="w-16 shrink-0 font-medium text-foreground/70">
                                  Link
                                </dt>
                                <dd className="min-w-0 break-all">
                                  {meetingLink || "Meeting link not set"}
                                </dd>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <dt className="w-16 shrink-0 font-medium text-foreground/70">
                                  {locationType === INTERNAL_EVENT_LOCATION_TYPES.facility
                                    ? "Space"
                                    : "Location"}
                                </dt>
                                <dd className="min-w-0">{locationDetail}</dd>
                              </div>
                            )}
                            {event.event_types?.name ? (
                              <div className="flex gap-2">
                                <dt className="w-16 shrink-0 font-medium text-foreground/70">
                                  Category
                                </dt>
                                <dd>{event.event_types.name}</dd>
                              </div>
                            ) : null}
                          </dl>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
