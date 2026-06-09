"use client"

import Link from "next/link"
import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Plus,
  TriangleAlert,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TimeInput } from "@/components/ui/time-input"
import { createReservationBlock } from "@/lib/reservations/reservation-actions"
import { computeReservationConflicts } from "@/lib/reservations/reservation-conflicts"
import {
  formatCalendarHeading,
  formatHourLabel,
  formatTimeRange,
  getWeekStart,
  toDateParam,
} from "@/lib/reservations/reservation-time"
import type {
  CalendarContext,
  CalendarData,
  CalendarReservation,
  CalendarViewMode,
} from "@/lib/reservations/reservation-types"
import {
  CALENDAR_CONTEXT_DESCRIPTIONS,
  CALENDAR_CONTEXT_LABELS,
  RESERVATION_SOURCE_TYPES,
  SOURCE_TYPE_COLORS,
  SOURCE_TYPE_LABELS,
} from "@/lib/reservations/reservation-types"
import { getReservationStatusCalendarClasses } from "@/lib/bookings/venue-rental-status"
import { OperationalBriefPanel } from "@/components/operational-briefs/operational-brief-panel"
import { cn } from "@/lib/utils"

const HOURS_START = 7
const HOURS_END = 20
const ROW_HEIGHT = 56
const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

type ReservationCalendarProps = {
  context: CalendarContext
  initialData: CalendarData
  initialDate: string
  initialView: CalendarViewMode
  canManageBlocks: boolean
  headerTitle?: string
  enableOperationalBrief?: boolean
}

type CalendarColumn = {
  id: string
  label: string
  venueId: string | null
  spaceLabel: string | null
}

function reservationMatchesColumn(
  reservation: CalendarReservation,
  column: CalendarColumn,
  context: CalendarContext
) {
  if (context === "internal_events" && column.id === "unassigned") {
    return !reservation.venueId && !reservation.spaceLabel
  }

  if (context === "internal_events" && column.id === "internal-events") {
    return true
  }

  if (column.venueId) {
    return reservation.venueId === column.venueId
  }

  if (column.spaceLabel) {
    return (
      !reservation.venueId &&
      (reservation.spaceLabel || "").toLowerCase() ===
        column.spaceLabel.toLowerCase()
    )
  }

  if (context === "venue_rentals") {
    return reservation.venueId === column.venueId
  }

  return !reservation.venueId
}

function reservationStartHour(iso: string) {
  return new Date(iso).getHours()
}

function reservationDurationHours(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  return Math.max(hours, 0.75)
}

function reservationOnDate(reservation: CalendarReservation, date: Date) {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)
  const start = new Date(reservation.startAt)
  const end = new Date(reservation.endAt)
  return start <= dayEnd && end >= dayStart
}

function buildColumns(
  data: CalendarData,
  context: CalendarContext
): CalendarColumn[] {
  const columns: CalendarColumn[] = data.venues.map((venue) => ({
    id: venue.id,
    label: venue.name,
    venueId: venue.id,
    spaceLabel: null,
  }))

  const otherSpaces = new Set<string>()

  for (const reservation of data.reservations) {
    if (!reservation.venueId && reservation.spaceLabel) {
      otherSpaces.add(reservation.spaceLabel)
    }
  }

  for (const spaceLabel of Array.from(otherSpaces).sort()) {
    columns.push({
      id: `space-${spaceLabel}`,
      label: spaceLabel,
      venueId: null,
      spaceLabel,
    })
  }

  if (context === "internal_events" && columns.length === 0) {
    columns.push({
      id: "internal-events",
      label: "Internal Events",
      venueId: null,
      spaceLabel: null,
    })
  }

  if (context === "internal_events") {
    const hasUnassigned = data.reservations.some((reservation) => !reservation.venueId)
    if (hasUnassigned && !columns.some((column) => column.id === "unassigned")) {
      columns.unshift({
        id: "unassigned",
        label: "All Events",
        venueId: null,
        spaceLabel: null,
      })
    }
  }

  if (columns.length === 0) {
    columns.push({
      id: "schedule",
      label: "Schedule",
      venueId: null,
      spaceLabel: null,
    })
  }

  return columns
}

export function ReservationCalendar({
  context,
  initialData,
  initialDate,
  initialView,
  canManageBlocks,
  headerTitle,
  enableOperationalBrief = false,
}: ReservationCalendarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [blockOpen, setBlockOpen] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] =
    useState<CalendarReservation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const currentDate = useMemo(
    () => new Date(`${initialDate}T12:00:00`),
    [initialDate]
  )
  const view = initialView
  const data = initialData

  const hours = useMemo(() => {
    const values: number[] = []
    for (let hour = HOURS_START; hour <= HOURS_END; hour += 1) {
      values.push(hour)
    }
    return values
  }, [])

  const weekDays = useMemo(() => {
    const start = getWeekStart(currentDate)
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [currentDate])

  const columns = useMemo(
    () => buildColumns(data, context),
    [data, context]
  )

  const sourceTypesInView = useMemo(
    () => Array.from(new Set(data.reservations.map((item) => item.sourceType))),
    [data.reservations]
  )

  const conflicts = useMemo(
    () =>
      context === "facilities"
        ? computeReservationConflicts(data.reservations, data.venues)
        : { conflictIds: new Set<string>(), conflictPairs: [], conflictCount: 0 },
    [context, data.reservations, data.venues]
  )

  function pushParams(next: { date?: string; view?: CalendarViewMode }) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.date) params.set("date", next.date)
    if (next.view) params.set("view", next.view)

    const pathname =
      context === "venue_rentals"
        ? "/bookings/calendar"
        : context === "internal_events"
          ? "/event-management/calendar"
          : "/facilities/calendar"

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  function navigate(direction: -1 | 1) {
    const next = new Date(currentDate)
    if (view === "week") {
      next.setDate(next.getDate() + direction * 7)
    } else {
      next.setDate(next.getDate() + direction)
    }
    pushParams({ date: toDateParam(next), view })
  }

  async function handleCreateBlock(formData: FormData) {
    setError(null)

    startTransition(async () => {
      try {
        await createReservationBlock({
          sourceType:
            formData.get("block_type") === "closure"
              ? RESERVATION_SOURCE_TYPES.spaceClosure
              : RESERVATION_SOURCE_TYPES.maintenanceBlock,
          venueId: String(formData.get("venue_id") || "") || null,
          spaceLabel: String(formData.get("space_label") || "") || null,
          title: String(formData.get("title") || ""),
          description: String(formData.get("description") || ""),
          eventDate: String(formData.get("event_date") || ""),
          startTime: String(formData.get("start_time") || ""),
          endTime: String(formData.get("end_time") || ""),
        })
        setBlockOpen(false)
        router.refresh()
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to create block"
        )
      }
    })
  }

  const displayDays = view === "day" ? [currentDate] : weekDays

  return (
    <>
      <Header title={headerTitle || CALENDAR_CONTEXT_LABELS[context]} />

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Calendar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {CALENDAR_CONTEXT_DESCRIPTIONS[context]}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {context === "internal_events" ? (
              <Button asChild size="sm">
                <Link href="/event-management/request">
                  <Plus className="mr-2 h-4 w-4" />
                  Request Event
                </Link>
              </Button>
            ) : null}
            {canManageBlocks ? (
              <Button size="sm" variant="outline" onClick={() => setBlockOpen(true)}>
                <Ban className="mr-2 h-4 w-4" />
                Block Space
              </Button>
            ) : null}
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => navigate(-1)} disabled={isPending}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigate(1)} disabled={isPending}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => pushParams({ date: toDateParam(new Date()), view })}
                  disabled={isPending}
                >
                  Today
                </Button>
              </div>

              <p className="text-sm font-medium sm:text-base">
                {view === "week"
                  ? `${formatCalendarHeading(weekDays[0])} – ${formatCalendarHeading(weekDays[6])}`
                  : formatCalendarHeading(currentDate)}
              </p>

              <div className="flex rounded-lg border p-0.5">
                {(["day", "week"] as CalendarViewMode[]).map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={view === mode ? "default" : "ghost"}
                    onClick={() => pushParams({ date: initialDate, view: mode })}
                    disabled={isPending}
                    className="capitalize"
                  >
                    {mode}
                  </Button>
                ))}
              </div>
            </div>

            {context === "facilities" && sourceTypesInView.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sourceTypesInView.map((sourceType) => (
                  <Badge
                    key={sourceType}
                    variant="outline"
                    className={cn(
                      SOURCE_TYPE_COLORS[sourceType].bg,
                      SOURCE_TYPE_COLORS[sourceType].text,
                      SOURCE_TYPE_COLORS[sourceType].border
                    )}
                  >
                    {SOURCE_TYPE_LABELS[sourceType]}
                  </Badge>
                ))}
              </div>
            ) : null}

            {context === "facilities" && conflicts.conflictCount > 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">
                      {conflicts.conflictCount} overlapping reservation
                      {conflicts.conflictCount === 1 ? "" : "s"} detected
                    </p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {conflicts.conflictPairs.slice(0, 5).map((pair) => (
                        <li key={`${pair.a.id}-${pair.b.id}`}>
                          {pair.a.title} overlaps {pair.b.title} (
                          {formatTimeRange(pair.a.startAt, pair.a.endAt)})
                        </li>
                      ))}
                      {conflicts.conflictPairs.length > 5 ? (
                        <li>+ {conflicts.conflictPairs.length - 5} more conflicts</li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {data.reservations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No reservations in this range yet.
            </CardContent>
          </Card>
        ) : null}

        <div className="overflow-hidden rounded-lg border bg-card">
          <div ref={scrollRef} className="overflow-x-auto">
            <div
              className="min-w-[960px]"
              style={{
                display: "grid",
                gridTemplateColumns: `72px repeat(${displayDays.length * columns.length}, minmax(140px, 1fr))`,
              }}
            >
              <div className="border-b border-r bg-muted/40 p-2 text-xs font-semibold uppercase text-muted-foreground">
                Time
              </div>
              {displayDays.map((day) =>
                columns.map((column) => (
                  <div
                    key={`${day.toISOString()}-${column.id}`}
                    className="border-b border-r bg-muted/40 p-2"
                  >
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                      {DAY_LABELS[day.getDay()]}
                    </p>
                    <p className="text-xs font-medium">
                      {day.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{column.label}</p>
                  </div>
                ))
              )}

              {hours.map((hour) => (
                <div key={hour} className="contents">
                  <div className="border-b border-r px-2 py-3 text-xs text-muted-foreground">
                    {formatHourLabel(hour)}
                  </div>
                  {displayDays.map((day) =>
                    columns.map((column) => {
                      const items = data.reservations.filter(
                        (reservation) =>
                          reservationOnDate(reservation, day) &&
                          reservationMatchesColumn(reservation, column, context) &&
                          reservationStartHour(reservation.startAt) === hour
                      )

                      return (
                        <div
                          key={`${hour}-${day.toISOString()}-${column.id}`}
                          className="relative border-b border-r bg-background"
                          style={{ minHeight: ROW_HEIGHT }}
                        >
                          {items.map((reservation) => {
                            const colors =
                              context === "venue_rentals" &&
                              reservation.sourceType === RESERVATION_SOURCE_TYPES.venueRental
                                ? getReservationStatusCalendarClasses(reservation.status)
                                : SOURCE_TYPE_COLORS[reservation.sourceType]
                            const hasConflict = conflicts.conflictIds.has(reservation.id)
                            const content = (
                              <div
                                className={cn(
                                  "absolute inset-x-1 top-1 z-10 rounded-md border px-2 py-1 text-xs shadow-sm",
                                  colors.bg,
                                  colors.text,
                                  colors.border,
                                  hasConflict &&
                                    "ring-2 ring-red-500 ring-offset-1 border-red-400",
                                  enableOperationalBrief && "cursor-pointer"
                                )}
                                style={{
                                  minHeight:
                                    reservationDurationHours(
                                      reservation.startAt,
                                      reservation.endAt
                                    ) * ROW_HEIGHT -
                                    8,
                                }}
                                onClick={
                                  enableOperationalBrief
                                    ? () => {
                                        setSelectedReservation(reservation)
                                        setBriefOpen(true)
                                      }
                                    : undefined
                                }
                                onKeyDown={
                                  enableOperationalBrief
                                    ? (event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault()
                                          setSelectedReservation(reservation)
                                          setBriefOpen(true)
                                        }
                                      }
                                    : undefined
                                }
                                role={enableOperationalBrief ? "button" : undefined}
                                tabIndex={enableOperationalBrief ? 0 : undefined}
                              >
                                <p className="line-clamp-2 font-medium">{reservation.title}</p>
                                {hasConflict ? (
                                  <p className="line-clamp-1 font-medium text-red-700">
                                    Conflict
                                  </p>
                                ) : null}
                                <p className="line-clamp-1 opacity-80">
                                  {formatTimeRange(
                                    reservation.startAt,
                                    reservation.endAt
                                  )}
                                </p>
                              </div>
                            )

                            return enableOperationalBrief ? (
                              <div key={reservation.id}>{content}</div>
                            ) : reservation.href ? (
                              <Link key={reservation.id} href={reservation.href}>
                                {content}
                              </Link>
                            ) : (
                              <div key={reservation.id}>{content}</div>
                            )
                          })}
                        </div>
                      )
                    })
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <OperationalBriefPanel
        reservation={selectedReservation}
        open={briefOpen}
        onOpenChange={setBriefOpen}
      />

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Space</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleCreateBlock(new FormData(event.currentTarget))
            }}
            className="space-y-4"
          >
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="block_type">Block type</Label>
              <select
                id="block_type"
                name="block_type"
                defaultValue="maintenance"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="maintenance">Maintenance Block</option>
                <option value="closure">Space Closure</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required placeholder="HVAC maintenance" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue_id">Venue</Label>
              <select
                id="venue_id"
                name="venue_id"
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select venue (optional)</option>
                {data.venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="space_label">Space label</Label>
              <Input
                id="space_label"
                name="space_label"
                placeholder="Use when no venue is selected"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="event_date">Date</Label>
                <Input id="event_date" name="event_date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_time">Start</Label>
                <TimeInput id="start_time" name="start_time" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End</Label>
                <TimeInput id="end_time" name="end_time" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Notes</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBlockOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Save Block
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
