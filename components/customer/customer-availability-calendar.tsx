"use client"

import { useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
  Plus,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const viewModes = ["Day", "Week"] as const
type ViewMode = (typeof viewModes)[number]

const HOURS_START = 7
const HOURS_END = 20
const ROW_HEIGHT = 60
const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

type Venue = {
  id: string
  name: string
  description?: string | null
  capacity?: number | null
  status?: string | null
}

type Booking = {
  id: string
  venue_id: string
  event_type?: string | null
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  status?: string | null
  guest_count?: number | null
}

type SelectedSlot = {
  venueId: string
  venueName: string
  hour: number
  date: Date
}

function formatHour(hour: number) {
  const ampm = hour >= 12 ? "PM" : "AM"
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:00 ${ampm}`
}

function hourToTime(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`
}

function timeToHour(value?: string | null) {
  if (!value) return null
  const [hour] = value.split(":")
  return Number(hour)
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d
}

export function CustomerAvailabilityCalendar({
  organizationName,
  venues,
  bookings,
  eventTypes,
  createBookingAction,
}: {
  organizationName: string
  venues: Venue[]
  bookings: Booking[]
  eventTypes: Array<{ id: string; name: string }>
  createBookingAction: (formData: FormData) => void
}) {
  const [activeView, setActiveView] = useState<ViewMode>("Day")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const hours = useMemo(() => {
    const result: number[] = []
    for (let i = HOURS_START; i <= HOURS_END; i++) result.push(i)
    return result
  }, [])

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + index)
      return d
    })
  }, [weekStart])

  function navigateDate(direction: -1 | 1) {
    setCurrentDate((previous) => {
      const next = new Date(previous)

      if (activeView === "Week") {
        next.setDate(next.getDate() + direction * 7)
      } else {
        next.setDate(next.getDate() + direction)
      }

      return next
    })
  }

  function scrollSpaces(direction: -1 | 1) {
    scrollContainerRef.current?.scrollBy({
      left: direction * 220,
      behavior: "smooth",
    })
  }

  function openBookingDialog(venue: Venue, hour: number, date: Date) {
    setSelectedSlot({
      venueId: venue.id,
      venueName: venue.name,
      hour,
      date,
    })

    setIsBookingDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">{organizationName}</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Availability
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View available spaces and booked times. Click an open slot to request
          a booking.
        </p>
      </div>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-md border border-border bg-background">
                {viewModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
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

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigateDate(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigateDate(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <span className="text-sm font-semibold text-foreground">
                {activeView === "Week"
                  ? `Week of ${formatDate(weekStart)}`
                  : formatDate(currentDate)}
              </span>
            </div>

            {activeView === "Day" && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => scrollSpaces(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span className="px-2 text-xs font-medium text-muted-foreground">
                  Scroll Spaces
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => scrollSpaces(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 border-b border-border bg-background px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded-sm border border-gray-200 bg-gray-100" />
              <span>Not Available</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded-sm border border-border bg-background" />
              <span>Available click to book</span>
            </div>
          </div>

          {venues.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center p-8 text-center">
              <div>
                <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h2 className="mt-4 text-lg font-semibold">
                  No active venues found
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add active venues before checking availability.
                </p>
              </div>
            </div>
          ) : activeView === "Day" ? (
            <DayView
              hours={hours}
              venues={venues}
              bookings={bookings}
              currentDate={currentDate}
              scrollRef={scrollContainerRef}
              onOpenBooking={openBookingDialog}
            />
          ) : (
            <WeekView
              venues={venues}
              bookings={bookings}
              weekDays={weekDays}
              scrollRef={scrollContainerRef}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Booking</DialogTitle>
            <DialogDescription>
              Submit a booking request for this available time slot.
            </DialogDescription>
          </DialogHeader>

          {selectedSlot && (
            <form action={createBookingAction} className="space-y-4">
              <input type="hidden" name="venue_id" value={selectedSlot.venueId} />
              <input
                type="hidden"
                name="event_date"
                value={toDateKey(selectedSlot.date)}
              />
              <input
                type="hidden"
                name="start_time"
                value={hourToTime(selectedSlot.hour)}
              />
              <input
                type="hidden"
                name="end_time"
                value={hourToTime(selectedSlot.hour + 1)}
              />

              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{selectedSlot.venueName}</span>
                </div>

                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>{formatDate(selectedSlot.date)}</span>
                </div>

                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatHour(selectedSlot.hour)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_type">Event Type</Label>
                {eventTypes.length > 0 ? (
                  <select
                    id="event_type"
                    name="event_type"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select event type</option>
                    {eventTypes.map((eventType) => (
                      <option key={eventType.id} value={eventType.name}>
                        {eventType.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Event types are not available yet. Please contact the organization.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="guest_count">Expected Attendees</Label>
                <Input
                  id="guest_count"
                  name="guest_count"
                  type="number"
                  min="1"
                  placeholder="Number of people"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Description Optional</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Tell us about your event..."
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBookingDialogOpen(false)}
                >
                  Cancel
                </Button>

                <Button type="submit" disabled={eventTypes.length === 0}>
                  Submit Request
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DayView({
  hours,
  venues,
  bookings,
  currentDate,
  scrollRef,
  onOpenBooking,
}: {
  hours: number[]
  venues: Venue[]
  bookings: Booking[]
  currentDate: Date
  scrollRef: React.RefObject<HTMLDivElement | null>
  onOpenBooking: (venue: Venue, hour: number, date: Date) => void
}) {
  const currentDateKey = toDateKey(currentDate)

  return (
    <div ref={scrollRef} className="overflow-x-auto bg-background">
      <div
        className="grid min-w-[700px]"
        style={{
          gridTemplateColumns: `70px repeat(${venues.length}, minmax(140px, 1fr))`,
        }}
      >
        <div className="sticky top-0 z-10 border-b border-r border-border bg-muted/50 p-2" />

        {venues.map((venue) => (
          <div
            key={venue.id}
            className="sticky top-0 z-10 flex items-center justify-center border-b border-r border-border bg-muted/50 px-2 py-3 text-center text-xs font-semibold text-foreground last:border-r-0"
          >
            {venue.name}
          </div>
        ))}

        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div
              className="flex items-start justify-end border-b border-r border-border px-2 pt-2 text-xs font-medium text-muted-foreground"
              style={{ height: ROW_HEIGHT }}
            >
              {formatHour(hour)}
            </div>

            {venues.map((venue) => {
              const event = bookings.find((booking) => {
                const startHour = timeToHour(booking.start_time)
                const endHour = timeToHour(booking.end_time)

                return (
                  booking.venue_id === venue.id &&
                  booking.event_date === currentDateKey &&
                  startHour === hour &&
                  endHour !== null
                )
              })

              const isBlocked = bookings.some((booking) => {
                const startHour = timeToHour(booking.start_time)
                const endHour = timeToHour(booking.end_time)

                return (
                  booking.venue_id === venue.id &&
                  booking.event_date === currentDateKey &&
                  startHour !== null &&
                  endHour !== null &&
                  hour >= startHour &&
                  hour < endHour &&
                  startHour !== hour
                )
              })

              return (
                <div
                  key={`${hour}-${venue.id}`}
                  className={cn(
                    "relative border-b border-r border-border last:border-r-0 transition-colors",
                    !event && !isBlocked && "cursor-pointer hover:bg-primary/5"
                  )}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => {
                    if (!event && !isBlocked) {
                      onOpenBooking(venue, hour, currentDate)
                    }
                  }}
                >
                  {event && (
                    <div
                      className="absolute inset-x-1 top-1 z-[5] overflow-hidden rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-left text-[11px] font-medium leading-tight text-gray-600 shadow-sm"
                      style={{
                        height: `${Math.max(
                          ((timeToHour(event.end_time) || hour + 1) - hour) *
                            ROW_HEIGHT -
                            8,
                          ROW_HEIGHT - 8
                        )}px`,
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        <span className="truncate font-medium">
                          Not Available
                        </span>
                      </div>
                    </div>
                  )}

                  {!event && !isBlocked && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100">
                      <Plus className="h-5 w-5 text-primary/50" />
                    </div>
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

function WeekView({
  venues,
  bookings,
  weekDays,
  scrollRef,
}: {
  venues: Venue[]
  bookings: Booking[]
  weekDays: Date[]
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={scrollRef} className="overflow-x-auto bg-background">
      <div
        className="grid min-w-[700px]"
        style={{
          gridTemplateColumns: `70px repeat(${venues.length}, minmax(140px, 1fr))`,
        }}
      >
        <div className="sticky top-0 z-10 border-b border-r border-border bg-muted/50 p-2" />

        {venues.map((venue) => (
          <div
            key={venue.id}
            className="sticky top-0 z-10 flex items-center justify-center border-b border-r border-border bg-muted/50 px-2 py-3 text-center text-xs font-semibold text-foreground last:border-r-0"
          >
            {venue.name}
          </div>
        ))}

        {weekDays.map((day, dayIndex) => {
          const dayKey = toDateKey(day)
          const dayOfWeek = day.getDay()

          return (
            <div key={dayIndex} className="contents">
              <div className="flex min-h-[80px] flex-col items-center justify-start gap-0.5 border-b border-r border-border px-2 py-3">
                <span className="text-sm font-bold text-primary">
                  {day.getDate()}
                </span>
                <span className="text-xs font-semibold text-primary">
                  {DAY_LABELS[dayOfWeek]}
                </span>
              </div>

              {venues.map((venue) => {
                const cellBookings = bookings.filter(
                  (booking) =>
                    booking.venue_id === venue.id &&
                    booking.event_date === dayKey
                )

                return (
                  <div
                    key={`${dayKey}-${venue.id}`}
                    className="flex min-h-[80px] flex-col gap-1.5 border-b border-r border-border px-2 py-2 last:border-r-0"
                  >
                    {cellBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex cursor-not-allowed items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs"
                      >
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate text-muted-foreground">
                          <span className="font-medium">
                            {booking.start_time?.slice(0, 5) || "--"}
                          </span>{" "}
                          Not Available
                        </span>
                      </div>
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