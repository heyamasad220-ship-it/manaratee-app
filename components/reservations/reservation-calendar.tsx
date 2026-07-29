"use client"

import Link from "next/link"
import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Plus,
  TriangleAlert,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { TimeInput } from "@/components/ui/time-input"
import type { CalendarAudience } from "@/lib/reservations/calendar-audience"
import { CALENDAR_AUDIENCE_PATHS } from "@/lib/reservations/calendar-audience"
import { createReservationBlock } from "@/lib/reservations/reservation-actions"
import { computeReservationConflicts } from "@/lib/reservations/reservation-conflicts"
import {
  formatCalendarToolbarDate,
  formatHourLabel,
  formatTimeRange,
  getWeekStart,
  toDateParam,
} from "@/lib/reservations/reservation-time"
import type {
  CalendarData,
  CalendarReservation,
  CalendarViewMode,
} from "@/lib/reservations/reservation-types"
import {
  RESERVATION_SOURCE_TYPES,
  SOURCE_TYPE_COLORS,
  SOURCE_TYPE_LABELS,
} from "@/lib/reservations/reservation-types"
import { getReservationStatusCalendarClasses } from "@/lib/bookings/venue-rental-status"
import { OperationalBriefPanel } from "@/components/operational-briefs/operational-brief-panel"
import { cn } from "@/lib/utils"

const HOURS_START = 7
const HOURS_END = 18
const DAY_ROW_HEIGHT = 72
const GRID_ROW_MIN_HEIGHT = 90
const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
const VIEW_MODES: CalendarViewMode[] = ["day", "grid"]

type ReservationCalendarProps = {
  audience: CalendarAudience
  initialData: CalendarData
  initialDate: string
  initialView: CalendarViewMode
  canManageBlocks: boolean
  canPlanEvents?: boolean
  headerTitle?: string
  description?: string
}

type CalendarColumn = {
  id: string
  label: string
  venueId: string | null
  spaceLabel: string | null
}

function reservationMatchesColumn(
  reservation: CalendarReservation,
  column: CalendarColumn
) {
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

function buildColumns(data: CalendarData): CalendarColumn[] {
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

function buildEventRequestHref(
  day: Date,
  hour: number,
  column: CalendarColumn,
  options?: { departmentId?: string | null; returnTo?: string | null }
) {
  const start = new Date(day)
  start.setHours(hour, 0, 0, 0)
  const end = new Date(start)
  end.setHours(hour + 1, 0, 0, 0)

  const params = new URLSearchParams()
  if (column.venueId) {
    params.set("venueId", column.venueId)
  }
  params.set("start", start.toISOString())
  params.set("end", end.toISOString())
  if (options?.departmentId) {
    params.set("department", options.departmentId)
  }
  if (options?.returnTo) {
    params.set("returnTo", options.returnTo)
  }

  return `/event-management/request?${params.toString()}`
}

function formatReservationStartTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

function getReservationColors(
  reservation: CalendarReservation,
  isOps: boolean
) {
  if (isOps && reservation.sourceType === RESERVATION_SOURCE_TYPES.venueRental) {
    return getReservationStatusCalendarClasses(reservation.status)
  }

  return SOURCE_TYPE_COLORS[reservation.sourceType]
}

type ReservationRenderContext = {
  isOps: boolean
  conflicts: ReturnType<typeof computeReservationConflicts>
  onSelectReservation: (reservation: CalendarReservation) => void
}

function DayReservationBlock({
  reservation,
  context,
}: {
  reservation: CalendarReservation
  context: ReservationRenderContext
}) {
  const colors = getReservationColors(reservation, context.isOps)
  const hasConflict = context.conflicts.conflictIds.has(reservation.id)

  const content = (
    <div
      className={cn(
        "absolute inset-x-1 top-1 z-[5] overflow-hidden rounded-md border px-2 py-1 text-left text-[11px] font-medium leading-tight shadow-sm",
        colors.bg,
        colors.text,
        colors.border,
        hasConflict && "ring-2 ring-red-500 ring-offset-1 border-red-400",
        context.isOps && "cursor-pointer"
      )}
      style={{
        height: `${reservationDurationHours(reservation.startAt, reservation.endAt) * DAY_ROW_HEIGHT - 8}px`,
      }}
      onClick={
        context.isOps
          ? (event) => {
              event.stopPropagation()
              context.onSelectReservation(reservation)
            }
          : undefined
      }
      onKeyDown={
        context.isOps
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                event.stopPropagation()
                context.onSelectReservation(reservation)
              }
            }
          : undefined
      }
      role={context.isOps ? "button" : undefined}
      tabIndex={context.isOps ? 0 : undefined}
    >
      <div className="truncate font-semibold">{reservation.title}</div>
      {hasConflict ? (
        <div className="truncate font-medium text-red-700">Conflict</div>
      ) : null}
      <div className="truncate opacity-75">
        {formatTimeRange(reservation.startAt, reservation.endAt)}
      </div>
    </div>
  )

  if (context.isOps) {
    return content
  }

  if (reservation.href) {
    return (
      <Link href={reservation.href} className="block">
        {content}
      </Link>
    )
  }

  return content
}

function GridReservationItem({
  reservation,
  context,
}: {
  reservation: CalendarReservation
  context: ReservationRenderContext
}) {
  const colors = getReservationColors(reservation, context.isOps)
  const hasConflict = context.conflicts.conflictIds.has(reservation.id)

  const inner = (
    <>
      <span
        className={cn(
          "mt-0.5 h-2 w-2 shrink-0 rounded-full",
          colors.text.replace("text-", "bg-")
        )}
      />
      <span className="truncate text-foreground">
        <span className="font-medium">
          {formatReservationStartTime(reservation.startAt)}
        </span>{" "}
        {reservation.title}
      </span>
    </>
  )

  if (context.isOps) {
    return (
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1.5 text-left text-xs transition-opacity hover:opacity-70",
          hasConflict && "text-red-700"
        )}
        onClick={(event) => {
          event.stopPropagation()
          context.onSelectReservation(reservation)
        }}
      >
        {inner}
      </button>
    )
  }

  if (reservation.href) {
    return (
      <Link
        href={reservation.href}
        className={cn(
          "flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70",
          hasConflict && "text-red-700"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {inner}
      </Link>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs",
        hasConflict && "text-red-700"
      )}
    >
      {inner}
    </div>
  )
}

function SpaceColumnHeaders({ columns }: { columns: CalendarColumn[] }) {
  return (
    <>
      <div className="sticky top-0 z-10 border-b border-r border-border bg-muted/50 p-2" />
      {columns.map((column) => (
        <div
          key={column.id}
          className="sticky top-0 z-10 flex items-center justify-center gap-1 border-b border-r border-border bg-muted/50 px-2 py-3 text-center text-xs font-semibold text-foreground last:border-r-0"
        >
          <span className="leading-tight">{column.label}</span>
          <Info className="h-3 w-3 shrink-0 text-muted-foreground" />
        </div>
      ))}
    </>
  )
}

function DayView({
  columns,
  hours,
  currentDate,
  data,
  scrollRef,
  canPlanEvents,
  renderContext,
  onEmptySlotClick,
}: {
  columns: CalendarColumn[]
  hours: number[]
  currentDate: Date
  data: CalendarData
  scrollRef: React.RefObject<HTMLDivElement | null>
  canPlanEvents: boolean
  renderContext: ReservationRenderContext
  onEmptySlotClick: (day: Date, hour: number, column: CalendarColumn) => void
}) {
  return (
    <div ref={scrollRef} className="overflow-x-auto rounded-b-lg border border-t-0 border-border bg-card">
      <div
        className="grid min-w-[900px]"
        style={{
          gridTemplateColumns: `80px repeat(${columns.length}, minmax(120px, 1fr))`,
        }}
      >
        <SpaceColumnHeaders columns={columns} />

        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div
              className="flex items-start justify-end border-b border-r border-border px-2 pt-2 text-xs font-medium text-muted-foreground"
              style={{ height: DAY_ROW_HEIGHT }}
            >
              {formatHourLabel(hour)}
            </div>

            {columns.map((column) => {
              const items = data.reservations.filter(
                (reservation) =>
                  reservationOnDate(reservation, currentDate) &&
                  reservationMatchesColumn(reservation, column) &&
                  reservationStartHour(reservation.startAt) === hour
              )
              const isEmptySlot = items.length === 0
              const canClickSlot = canPlanEvents && isEmptySlot && column.venueId

              return (
                <div
                  key={`${hour}-${column.id}`}
                  className={cn(
                    "relative border-b border-r border-border last:border-r-0",
                    canClickSlot && "cursor-pointer hover:bg-primary/5"
                  )}
                  style={{ height: DAY_ROW_HEIGHT }}
                  onClick={
                    canClickSlot
                      ? () => onEmptySlotClick(currentDate, hour, column)
                      : undefined
                  }
                  onKeyDown={
                    canClickSlot
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            onEmptySlotClick(currentDate, hour, column)
                          }
                        }
                      : undefined
                  }
                  role={canClickSlot ? "button" : undefined}
                  tabIndex={canClickSlot ? 0 : undefined}
                  title={
                    canClickSlot ? "Click to request an event in this slot" : undefined
                  }
                >
                  {items.map((reservation) => (
                    <DayReservationBlock
                      key={reservation.id}
                      reservation={reservation}
                      context={renderContext}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function GridView({
  columns,
  weekDays,
  data,
  scrollRef,
  canPlanEvents,
  renderContext,
  onEmptyCellClick,
}: {
  columns: CalendarColumn[]
  weekDays: Date[]
  data: CalendarData
  scrollRef: React.RefObject<HTMLDivElement | null>
  canPlanEvents: boolean
  renderContext: ReservationRenderContext
  onEmptyCellClick: (day: Date, column: CalendarColumn) => void
}) {
  return (
    <div ref={scrollRef} className="overflow-x-auto rounded-b-lg border border-t-0 border-border bg-card">
      <div
        className="grid min-w-[700px]"
        style={{
          gridTemplateColumns: `80px repeat(${columns.length}, minmax(160px, 1fr))`,
        }}
      >
        <SpaceColumnHeaders columns={columns} />

        {weekDays.map((day) => {
          const dayOfWeek = day.getDay()
          const dayDate = day.getDate()

          return (
            <div key={day.toISOString()} className="contents">
              <div
                className="flex flex-col items-center justify-start gap-0.5 border-b border-r border-border px-2 py-3"
                style={{ minHeight: GRID_ROW_MIN_HEIGHT }}
              >
                <span className="text-sm font-bold text-primary">{dayDate}</span>
                <span className="text-xs font-semibold text-primary">
                  {DAY_LABELS[dayOfWeek]}
                </span>
              </div>

              {columns.map((column) => {
                const cellReservations = data.reservations
                  .filter(
                    (reservation) =>
                      reservationOnDate(reservation, day) &&
                      reservationMatchesColumn(reservation, column)
                  )
                  .sort(
                    (a, b) =>
                      new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
                  )
                const canClickCell =
                  canPlanEvents && cellReservations.length === 0 && column.venueId

                return (
                  <div
                    key={`${day.toISOString()}-${column.id}`}
                    className={cn(
                      "flex flex-col gap-1.5 border-b border-r border-border px-3 py-2.5 last:border-r-0",
                      canClickCell && "cursor-pointer hover:bg-primary/5"
                    )}
                    style={{ minHeight: GRID_ROW_MIN_HEIGHT }}
                    onClick={
                      canClickCell ? () => onEmptyCellClick(day, column) : undefined
                    }
                    onKeyDown={
                      canClickCell
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              onEmptyCellClick(day, column)
                            }
                          }
                        : undefined
                    }
                    role={canClickCell ? "button" : undefined}
                    tabIndex={canClickCell ? 0 : undefined}
                    title={
                      canClickCell ? "Click to request an event on this day" : undefined
                    }
                  >
                    {cellReservations.map((reservation) => (
                      <GridReservationItem
                        key={reservation.id}
                        reservation={reservation}
                        context={renderContext}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ReservationCalendar({
  audience,
  initialData,
  initialDate,
  initialView,
  canManageBlocks,
  canPlanEvents = false,
  headerTitle,
  description,
}: ReservationCalendarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [blockOpen, setBlockOpen] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
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
  const isOps = audience === "ops"
  const isStaff = audience === "staff"

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

  const columns = useMemo(() => buildColumns(data), [data])
  const eventRequestDepartmentId = searchParams.get("department")?.trim() || null
  const eventRequestReturnTo = searchParams.get("returnTo")?.trim() || null
  const eventRequestContext = useMemo(
    () => ({
      departmentId: eventRequestDepartmentId,
      returnTo: eventRequestReturnTo,
    }),
    [eventRequestDepartmentId, eventRequestReturnTo]
  )

  const requestEventHref = useMemo(() => {
    const params = new URLSearchParams()
    if (eventRequestDepartmentId) {
      params.set("department", eventRequestDepartmentId)
    }
    if (eventRequestReturnTo) {
      params.set("returnTo", eventRequestReturnTo)
    }
    const query = params.toString()
    return query ? `/event-management/request?${query}` : "/event-management/request"
  }, [eventRequestDepartmentId, eventRequestReturnTo])

  const sourceTypesInView = useMemo(
    () => Array.from(new Set(data.reservations.map((item) => item.sourceType))),
    [data.reservations]
  )

  const conflicts = useMemo(
    () =>
      isOps
        ? computeReservationConflicts(data.reservations, data.venues)
        : { conflictIds: new Set<string>(), conflictPairs: [], conflictCount: 0 },
    [isOps, data.reservations, data.venues]
  )

  const renderContext: ReservationRenderContext = useMemo(
    () => ({
      isOps,
      conflicts,
      onSelectReservation: (reservation) => {
        setSelectedReservation(reservation)
        setBriefOpen(true)
      },
    }),
    [isOps, conflicts]
  )

  function pushParams(next: { date?: string; view?: CalendarViewMode }) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.date) params.set("date", next.date)
    if (next.view) params.set("view", next.view)
    // Preserve ?sources= so module filtered calendars stay filtered.

    const pathname = CALENDAR_AUDIENCE_PATHS[audience]

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  function navigate(direction: -1 | 1) {
    const next = new Date(currentDate)
    if (view === "grid") {
      next.setDate(next.getDate() + direction * 7)
    } else {
      next.setDate(next.getDate() + direction)
    }
    pushParams({ date: toDateParam(next), view })
  }

  function scrollSpaces(direction: -1 | 1) {
    scrollRef.current?.scrollBy({
      left: direction * 240,
      behavior: "smooth",
    })
  }

  function handleEmptySlotClick(day: Date, hour: number, column: CalendarColumn) {
    router.push(buildEventRequestHref(day, hour, column, eventRequestContext))
  }

  function handleEmptyCellClick(day: Date, column: CalendarColumn) {
    router.push(buildEventRequestHref(day, 9, column, eventRequestContext))
  }

  function goToDate(date: Date) {
    pushParams({ date: toDateParam(date), view })
    setDatePickerOpen(false)
  }

  function goToToday() {
    goToDate(new Date())
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

  const toolbarDateLabel =
    view === "grid"
      ? `${formatCalendarToolbarDate(weekDays[0])} – ${formatCalendarToolbarDate(weekDays[6])}`
      : formatCalendarToolbarDate(currentDate)

  return (
    <>
      <Header title={headerTitle || "Calendar"} />

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{headerTitle || "Calendar"}</h2>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canPlanEvents ? (
              <Button asChild size="sm">
                <Link href={requestEventHref}>
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

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-md border border-border">
                {VIEW_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => pushParams({ date: initialDate, view: mode })}
                    disabled={isPending}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium capitalize transition-colors first:rounded-l-md last:rounded-r-md",
                      view === mode
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate(-1)}
                  disabled={isPending}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate(1)}
                  disabled={isPending}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={isPending}
                      className="flex items-center gap-1.5 text-sm font-semibold tracking-wide text-foreground transition-colors hover:text-primary disabled:opacity-50"
                    >
                      {toolbarDateLabel}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={currentDate}
                      onSelect={(date) => {
                        if (date) {
                          goToDate(date)
                        }
                      }}
                      defaultMonth={currentDate}
                      initialFocus
                    />
                    <div className="border-t border-border p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={goToToday}
                      >
                        Today
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => scrollSpaces(-1)}
                aria-label="Scroll spaces left"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => scrollSpaces(1)}
                aria-label="Scroll spaces right"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {(isOps || isStaff) && sourceTypesInView.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
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

          {isOps && conflicts.conflictCount > 0 ? (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
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

          {view === "day" ? (
            <DayView
              columns={columns}
              hours={hours}
              currentDate={currentDate}
              data={data}
              scrollRef={scrollRef}
              canPlanEvents={canPlanEvents}
              renderContext={renderContext}
              onEmptySlotClick={handleEmptySlotClick}
            />
          ) : (
            <GridView
              columns={columns}
              weekDays={weekDays}
              data={data}
              scrollRef={scrollRef}
              canPlanEvents={canPlanEvents}
              renderContext={renderContext}
              onEmptyCellClick={handleEmptyCellClick}
            />
          )}
        </div>

        {columns.length === 1 && columns[0].id === "schedule" ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No spaces configured yet. Add spaces under Facilities settings to populate
              this calendar.
            </CardContent>
          </Card>
        ) : null}
      </div>

      <OperationalBriefPanel
        reservation={selectedReservation}
        open={briefOpen}
        onOpenChange={setBriefOpen}
        hideSourceRecordLink={isOps}
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
