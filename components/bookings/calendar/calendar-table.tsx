"use client"

import { useState, useMemo, useRef } from "react"
import { ChevronLeft, ChevronRight, ChevronDown, Info, SlidersHorizontal, RefreshCw, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { bookingSpaces, calendarGridEvents, calendarGridWeekEvents, calendarListEvents } from "@/lib/mock-data"

const viewModes = ["Day", "Month", "Grid", "List"] as const
type ViewMode = (typeof viewModes)[number]

const HOURS_START = 7
const HOURS_END = 18
const ROW_HEIGHT = 72

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

function formatHour(hour: number) {
  const ampm = hour >= 12 ? "PM" : "AM"
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:00 ${ampm}`
}

function formatDate(date: Date) {
  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
  const months = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
  ]
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d
}

export function CalendarTable() {
  const [activeView, setActiveView] = useState<ViewMode>("Day")
  const [currentDate, setCurrentDate] = useState(new Date())

  const hours = useMemo(() => {
    const h: number[] = []
    for (let i = HOURS_START; i <= HOURS_END; i++) h.push(i)
    return h
  }, [])

  const navigateDate = (direction: -1 | 1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (activeView === "Grid") {
        d.setDate(d.getDate() + direction * 7)
      } else if (activeView === "List") {
        d.setDate(d.getDate() + direction * 30)
      } else {
        d.setDate(d.getDate() + direction)
      }
      return d
    })
  }

  const listEndDate = useMemo(() => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 38)
    return d
  }, [currentDate])

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const scrollSpaces = (direction: -1 | 1) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: direction * 200,
        behavior: "smooth",
      })
    }
  }

  const spaceNames = [...bookingSpaces.map((s) => s.name), "Virtual", "External Venue"]

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        {/* Left: View Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-md border border-border bg-card">
            {viewModes.map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveView(mode)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md",
                  activeView === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <Button 
              type="button"
              variant="outline" 
              size="icon-sm" 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                navigateDate(-1)
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              type="button"
              variant="outline" 
              size="icon-sm" 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                navigateDate(1)
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <button suppressHydrationWarning className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {activeView === "List" ? (
              <>
                {formatDate(currentDate)}
                <span className="mx-1 text-muted-foreground">-</span>
                {formatDate(listEndDate)}
              </>
            ) : (
              formatDate(currentDate)
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Right: Move to + Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button 
              type="button"
              variant="outline" 
              size="icon-sm" 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                scrollSpaces(-1)
              }} 
              aria-label="Scroll spaces left"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs font-medium text-muted-foreground">Spaces</span>
            <Button 
              type="button"
              variant="outline" 
              size="icon-sm" 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                scrollSpaces(1)
              }} 
              aria-label="Scroll spaces right"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" className="gap-2 text-sm">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Day View */}
      {activeView === "Day" && (
        <DayView hours={hours} spaceNames={spaceNames} scrollRef={scrollContainerRef} />
      )}

      {/* Grid View */}
      {activeView === "Grid" && (
        <GridView spaceNames={spaceNames} weekDays={weekDays} scrollRef={scrollContainerRef} />
      )}

      {/* List View */}
      {activeView === "List" && <ListView />}

      {/* Month Placeholder */}
      {activeView === "Month" && (
        <div className="flex items-center justify-center rounded-b-lg border border-t-0 border-border bg-card py-20">
          <p className="text-sm text-muted-foreground">Month view coming soon.</p>
        </div>
      )}
    </div>
  )
}

/* ──────────── Day View ──────────── */

function DayView({ hours, spaceNames, scrollRef }: { hours: number[]; spaceNames: string[]; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={scrollRef} className="overflow-x-auto border border-t-0 border-border rounded-b-lg bg-card">
      <div
        className="grid min-w-[900px]"
        style={{
          gridTemplateColumns: `80px repeat(${spaceNames.length}, minmax(120px, 1fr))`,
        }}
      >
        {/* Column Headers */}
        <div className="sticky top-0 z-10 border-b border-r border-border bg-muted/50 p-2" />
        {spaceNames.map((space) => (
          <div
            key={space}
            className="sticky top-0 z-10 flex items-center justify-center gap-1 border-b border-r border-border bg-muted/50 px-2 py-3 text-center text-xs font-semibold text-foreground last:border-r-0"
          >
            <span className="leading-tight">{space}</span>
            <Info className="h-3 w-3 shrink-0 text-muted-foreground" />
          </div>
        ))}

        {/* Time Rows */}
        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div
              className="flex items-start justify-end border-b border-r border-border px-2 pt-2 text-xs font-medium text-muted-foreground"
              style={{ height: ROW_HEIGHT }}
            >
              {formatHour(hour)}
            </div>

            {spaceNames.map((space) => {
              const event = calendarGridEvents.find(
                (e) => e.space === space && e.startHour === hour
              )
              return (
                <div
                  key={`${hour}-${space}`}
                  className="relative border-b border-r border-border last:border-r-0"
                  style={{ height: ROW_HEIGHT }}
                >
                  {event && (
                    <button
                      className={cn(
                        "absolute inset-x-1 top-1 z-[5] overflow-hidden rounded-md border px-2 py-1 text-left text-[11px] font-medium leading-tight shadow-sm transition-opacity hover:opacity-80",
                        event.color
                      )}
                      style={{
                        height: `${event.durationHours * ROW_HEIGHT - 8}px`,
                      }}
                    >
                      <div className="truncate font-semibold">{event.title}</div>
                      <div className="truncate opacity-75">{event.booker}</div>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ──────────── List View ──────────── */

function ListView() {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof calendarListEvents>()
    for (const evt of calendarListEvents) {
      const group = map.get(evt.dateLabel) ?? []
      group.push(evt)
      map.set(evt.dateLabel, group)
    }
    return Array.from(map.entries())
  }, [])

  return (
    <div className="border border-t-0 border-border rounded-b-lg bg-card overflow-hidden">
      {/* Column headings */}
      <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-4 border-b border-border bg-muted/60 px-5 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Space</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Booker</span>
      </div>

      {grouped.map(([dateLabel, events]) => (
        <div key={dateLabel}>
          {/* Date header */}
          <div className="border-b border-border bg-card px-5 py-3">
            <h3 className="text-sm font-bold text-emerald-700 tracking-wide">{dateLabel}</h3>
          </div>

          {/* Events */}
          {events.map((evt, idx) => (
            <div
              key={evt.id}
              className={cn(
                "grid grid-cols-[1fr_1fr_1fr] items-center gap-4 border-b border-border px-5 py-3",
                idx % 2 === 1 ? "bg-muted/40" : "bg-card"
              )}
            >
              {/* Time + Duration + Recurring */}
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                <span className="text-sm text-foreground">
                  <span className="font-medium">{evt.startTime}</span>
                  <span className="text-muted-foreground">{"\u2013"}</span>
                  <span className="font-medium">{evt.endTime}</span>
                  <span className="ml-1 text-muted-foreground">({evt.duration})</span>
                </span>
                {evt.recurring && (
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>

              {/* Space */}
              <span className="text-sm text-foreground truncate">{evt.space}</span>

              {/* Booker */}
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-foreground">{evt.booker}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ──────────── Grid View ──────────── */

function GridView({ spaceNames, weekDays, scrollRef }: { spaceNames: string[]; weekDays: Date[]; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={scrollRef} className="overflow-x-auto border border-t-0 border-border rounded-b-lg bg-card">
      <div
        className="grid min-w-[700px]"
        style={{
          gridTemplateColumns: `80px repeat(${spaceNames.length}, minmax(160px, 1fr))`,
        }}
      >
        {/* Column Headers */}
        <div className="sticky top-0 z-10 border-b border-r border-border bg-muted/50 p-2" />
        {spaceNames.map((space) => (
          <div
            key={space}
            className="sticky top-0 z-10 flex items-center justify-center gap-1 border-b border-r border-border bg-muted/50 px-2 py-3 text-center text-xs font-semibold text-foreground last:border-r-0"
          >
            <span className="leading-tight">{space}</span>
            <Info className="h-3 w-3 shrink-0 text-muted-foreground" />
          </div>
        ))}

        {/* Day Rows */}
        {weekDays.map((day, dayIdx) => {
          const dayOfWeek = day.getDay()
          const dayDate = day.getDate()
          const eventsForDay = calendarGridWeekEvents.filter((e) => e.dayIndex === dayOfWeek)

          return (
            <div key={dayIdx} className="contents">
              {/* Day label */}
              <div className="flex flex-col items-center justify-start gap-0.5 border-b border-r border-border px-2 py-3 min-h-[90px]">
                <span className="text-sm font-bold text-emerald-700">{dayDate}</span>
                <span className="text-xs font-semibold text-emerald-700">{DAY_LABELS[dayOfWeek]}</span>
              </div>

              {/* Space cells */}
              {spaceNames.map((space) => {
                const cellEvents = eventsForDay.filter((e) => e.space === space)
                return (
                  <div
                    key={`${dayIdx}-${space}`}
                    className="flex flex-col gap-1.5 border-b border-r border-border px-3 py-2.5 last:border-r-0 min-h-[90px]"
                  >
                    {cellEvents.map((evt) => (
                      <button
                        key={evt.id}
                        className="flex items-center gap-1.5 text-left text-xs transition-opacity hover:opacity-70"
                      >
                        <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current", evt.color)} />
                        <span className="truncate text-foreground">
                          <span className="font-medium">{evt.time}</span>{" "}
                          {evt.title}
                        </span>
                      </button>
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
