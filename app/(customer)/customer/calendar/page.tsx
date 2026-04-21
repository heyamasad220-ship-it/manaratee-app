"use client"

import { useState, useMemo, useRef } from "react"
import { ChevronLeft, ChevronRight, ChevronDown, Info, Lock, Plus, X, CalendarDays, Clock, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { bookingSpaces } from "@/lib/mock-data"

// View modes available for customers
const viewModes = ["Day", "Week"] as const
type ViewMode = (typeof viewModes)[number]

const HOURS_START = 7
const HOURS_END = 20
const ROW_HEIGHT = 60

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

// Mock calendar events for customer view - includes public and internal (blocked) events
interface CustomerCalendarEvent {
  id: string
  title: string
  space: string
  startHour: number
  durationHours: number
  isPublic: boolean // If false, show as "Not Available" without details
  color: string
  description?: string
}

const customerCalendarEvents: CustomerCalendarEvent[] = [
  { id: "cce-1", title: "Community Meeting", space: "Main Conference Room", startHour: 9, durationHours: 2, isPublic: true, color: "bg-blue-100 text-blue-800 border-blue-200", description: "Monthly community gathering" },
  { id: "cce-2", title: "Internal Staff Meeting", space: "Main Conference Room", startHour: 14, durationHours: 1.5, isPublic: false, color: "bg-gray-100 text-gray-600 border-gray-200" },
  { id: "cce-3", title: "Yoga Class", space: "Space One", startHour: 8, durationHours: 1, isPublic: true, color: "bg-emerald-100 text-emerald-800 border-emerald-200", description: "Open to all members" },
  { id: "cce-4", title: "Kids Art Workshop", space: "Space Two", startHour: 10, durationHours: 2, isPublic: true, color: "bg-amber-100 text-amber-800 border-amber-200", description: "Ages 5-12" },
  { id: "cce-5", title: "Board Meeting", space: "Banquet Hall", startHour: 11, durationHours: 3, isPublic: false, color: "bg-gray-100 text-gray-600 border-gray-200" },
  { id: "cce-6", title: "Dance Rehearsal", space: "Space One", startHour: 16, durationHours: 2, isPublic: true, color: "bg-rose-100 text-rose-800 border-rose-200", description: "Spring recital prep" },
  { id: "cce-7", title: "Private Event", space: "Banquet Hall", startHour: 18, durationHours: 3, isPublic: false, color: "bg-gray-100 text-gray-600 border-gray-200" },
]

// Week view events
interface CustomerWeekEvent {
  id: string
  title: string
  space: string
  dayIndex: number // 0 = Sunday, 6 = Saturday
  time: string
  durationHours: number
  isPublic: boolean
  color: string
}

const customerWeekEvents: CustomerWeekEvent[] = [
  { id: "cwe-1", title: "Yoga Class", space: "Space One", dayIndex: 1, time: "8:00 AM", durationHours: 1, isPublic: true, color: "text-emerald-600" },
  { id: "cwe-2", title: "Staff Training", space: "Training Room", dayIndex: 1, time: "10:00 AM", durationHours: 2, isPublic: false, color: "text-gray-500" },
  { id: "cwe-3", title: "Book Club", space: "Space Two", dayIndex: 2, time: "6:00 PM", durationHours: 2, isPublic: true, color: "text-blue-600" },
  { id: "cwe-4", title: "Internal Review", space: "Main Conference Room", dayIndex: 2, time: "2:00 PM", durationHours: 1.5, isPublic: false, color: "text-gray-500" },
  { id: "cwe-5", title: "Kids Dance", space: "Space One", dayIndex: 3, time: "4:00 PM", durationHours: 1, isPublic: true, color: "text-rose-600" },
  { id: "cwe-6", title: "Community Dinner", space: "Banquet Hall", dayIndex: 5, time: "6:00 PM", durationHours: 3, isPublic: true, color: "text-amber-600" },
  { id: "cwe-7", title: "Private Rental", space: "Banquet Hall", dayIndex: 6, time: "2:00 PM", durationHours: 4, isPublic: false, color: "text-gray-500" },
]

function formatHour(hour: number) {
  const ampm = hour >= 12 ? "PM" : "AM"
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:00 ${ampm}`
}

function formatDate(date: Date) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d
}

// Only show spaces that customers can book (Published and External)
const customerSpaces = bookingSpaces.filter(s => s.status === "Published")

export default function CustomerCalendarPage() {
  const [activeView, setActiveView] = useState<ViewMode>("Day")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ space: string; hour: number; date: Date } | null>(null)
  const [bookingForm, setBookingForm] = useState({
    eventName: "",
    description: "",
    attendees: "",
    duration: "1",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showEventDetail, setShowEventDetail] = useState<CustomerCalendarEvent | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const hours = useMemo(() => {
    const h: number[] = []
    for (let i = HOURS_START; i <= HOURS_END; i++) h.push(i)
    return h
  }, [])

  const navigateDate = (direction: -1 | 1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (activeView === "Week") {
        d.setDate(d.getDate() + direction * 7)
      } else {
        d.setDate(d.getDate() + direction)
      }
      return d
    })
  }

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  const scrollSpaces = (direction: -1 | 1) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: direction * 200,
        behavior: "smooth",
      })
    }
  }

  const spaceNames = customerSpaces.map((s) => s.name)

  // Handle clicking on an available slot
  function handleSlotClick(space: string, hour: number) {
    // Check if there's an event at this slot
    const existingEvent = customerCalendarEvents.find(
      (e) => e.space === space && hour >= e.startHour && hour < e.startHour + e.durationHours
    )
    
    if (existingEvent) {
      if (existingEvent.isPublic) {
        setShowEventDetail(existingEvent)
      }
      // If internal, do nothing (slot is blocked)
      return
    }
    
    // Open booking dialog for available slot
    setSelectedSlot({ space, hour, date: currentDate })
    setBookingForm({ eventName: "", description: "", attendees: "", duration: "1" })
    setIsBookingDialogOpen(true)
  }

  // Handle booking submission
  function handleSubmitBooking() {
    setIsSubmitting(true)
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      setIsBookingDialogOpen(false)
      setSelectedSlot(null)
      // In a real app, this would refresh the calendar data
    }, 1000)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View available spaces and events. Click on an open slot to request a booking.
        </p>
      </div>

      {/* Calendar Card */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: View Switcher + Navigation */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-md border border-border bg-background">
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

              <span suppressHydrationWarning className="text-sm font-semibold text-foreground">
                {formatDate(currentDate)}
              </span>
            </div>

            {/* Right: Space scrolling for Day view */}
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
                <span className="px-2 text-xs font-medium text-muted-foreground">Scroll Spaces</span>
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

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 border-b border-border bg-background px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded-sm bg-blue-100 border border-blue-200" />
              <span>Public Event</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded-sm bg-gray-100 border border-gray-200" />
              <span>Not Available</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded-sm bg-background border border-border" />
              <span>Available (click to book)</span>
            </div>
          </div>

          {/* Day View */}
          {activeView === "Day" && (
            <DayView 
              hours={hours} 
              spaceNames={spaceNames} 
              scrollRef={scrollContainerRef}
              onSlotClick={handleSlotClick}
            />
          )}

          {/* Week View */}
          {activeView === "Week" && (
            <WeekView 
              spaceNames={spaceNames} 
              weekDays={weekDays} 
              scrollRef={scrollContainerRef}
            />
          )}
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={!!showEventDetail} onOpenChange={() => setShowEventDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{showEventDetail?.title}</DialogTitle>
            <DialogDescription>Event Details</DialogDescription>
          </DialogHeader>
          {showEventDetail && (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{showEventDetail.space}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatHour(showEventDetail.startHour)} - {formatHour(showEventDetail.startHour + showEventDetail.durationHours)}</span>
              </div>
              {showEventDetail.description && (
                <p className="text-sm text-muted-foreground">{showEventDetail.description}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEventDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Request Dialog */}
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Booking</DialogTitle>
            <DialogDescription>
              Submit a booking request for this time slot. Your request will be reviewed by our team.
            </DialogDescription>
          </DialogHeader>
          {selectedSlot && (
            <div className="flex flex-col gap-4 py-4">
              {/* Selected slot info */}
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{selectedSlot.space}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span suppressHydrationWarning>{formatDate(selectedSlot.date)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatHour(selectedSlot.hour)}</span>
                </div>
              </div>

              {/* Form fields */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="eventName">Event Name</Label>
                <Input
                  id="eventName"
                  value={bookingForm.eventName}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, eventName: e.target.value }))}
                  placeholder="e.g., Birthday Party, Meeting"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="duration">Duration</Label>
                <Select 
                  value={bookingForm.duration} 
                  onValueChange={(val) => setBookingForm(prev => ({ ...prev, duration: val }))}
                >
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="2">2 hours</SelectItem>
                    <SelectItem value="3">3 hours</SelectItem>
                    <SelectItem value="4">4 hours</SelectItem>
                    <SelectItem value="5">5+ hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="attendees">Expected Attendees</Label>
                <Input
                  id="attendees"
                  type="number"
                  value={bookingForm.attendees}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, attendees: e.target.value }))}
                  placeholder="Number of people"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={bookingForm.description}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Tell us about your event..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitBooking}
              disabled={!bookingForm.eventName || !bookingForm.attendees || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ──────────── Day View ──────────── */

function DayView({ 
  hours, 
  spaceNames, 
  scrollRef,
  onSlotClick 
}: { 
  hours: number[]
  spaceNames: string[]
  scrollRef: React.RefObject<HTMLDivElement | null>
  onSlotClick: (space: string, hour: number) => void
}) {
  return (
    <div ref={scrollRef} className="overflow-x-auto bg-background">
      <div
        className="grid min-w-[700px]"
        style={{
          gridTemplateColumns: `70px repeat(${spaceNames.length}, minmax(140px, 1fr))`,
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
              const event = customerCalendarEvents.find(
                (e) => e.space === space && e.startHour === hour
              )
              const isBlocked = customerCalendarEvents.some(
                (e) => e.space === space && hour >= e.startHour && hour < e.startHour + e.durationHours && e.startHour !== hour
              )
              
              return (
                <div
                  key={`${hour}-${space}`}
                  className={cn(
                    "relative border-b border-r border-border last:border-r-0 transition-colors",
                    !event && !isBlocked && "cursor-pointer hover:bg-primary/5"
                  )}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => !isBlocked && onSlotClick(space, hour)}
                >
                  {event && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSlotClick(space, hour)
                      }}
                      className={cn(
                        "absolute inset-x-1 top-1 z-[5] overflow-hidden rounded-md border px-2 py-1 text-left text-[11px] font-medium leading-tight shadow-sm transition-opacity",
                        event.isPublic ? "hover:opacity-80 cursor-pointer" : "cursor-not-allowed",
                        event.color
                      )}
                      style={{
                        height: `${event.durationHours * ROW_HEIGHT - 8}px`,
                      }}
                    >
                      {event.isPublic ? (
                        <>
                          <div className="truncate font-semibold">{event.title}</div>
                          <div className="truncate opacity-75">{formatHour(event.startHour)} - {formatHour(event.startHour + event.durationHours)}</div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          <span className="truncate font-medium">Not Available</span>
                        </div>
                      )}
                    </button>
                  )}
                  
                  {/* Show + icon on hover for available slots */}
                  {!event && !isBlocked && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
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

/* ──────────── Week View ──────────── */

function WeekView({ 
  spaceNames, 
  weekDays, 
  scrollRef 
}: { 
  spaceNames: string[]
  weekDays: Date[]
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={scrollRef} className="overflow-x-auto bg-background">
      <div
        className="grid min-w-[700px]"
        style={{
          gridTemplateColumns: `70px repeat(${spaceNames.length}, minmax(140px, 1fr))`,
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
          </div>
        ))}

        {/* Day Rows */}
        {weekDays.map((day, dayIdx) => {
          const dayOfWeek = day.getDay()
          const dayDate = day.getDate()
          const eventsForDay = customerWeekEvents.filter((e) => e.dayIndex === dayOfWeek)

          return (
            <div key={dayIdx} className="contents">
              {/* Day label */}
              <div className="flex flex-col items-center justify-start gap-0.5 border-b border-r border-border px-2 py-3 min-h-[80px]">
                <span className="text-sm font-bold text-primary">{dayDate}</span>
                <span className="text-xs font-semibold text-primary">{DAY_LABELS[dayOfWeek]}</span>
              </div>

              {/* Space cells */}
              {spaceNames.map((space) => {
                const cellEvents = eventsForDay.filter((e) => e.space === space)
                return (
                  <div
                    key={`${dayIdx}-${space}`}
                    className="flex flex-col gap-1.5 border-b border-r border-border px-2 py-2 last:border-r-0 min-h-[80px]"
                  >
                    {cellEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className={cn(
                          "flex items-center gap-1.5 text-left text-xs rounded px-1.5 py-1",
                          evt.isPublic ? "hover:bg-muted/50 cursor-pointer" : "cursor-not-allowed"
                        )}
                      >
                        {evt.isPublic ? (
                          <>
                            <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current", evt.color)} />
                            <span className="truncate text-foreground">
                              <span className="font-medium">{evt.time}</span>{" "}
                              {evt.title}
                            </span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate text-muted-foreground">
                              <span className="font-medium">{evt.time}</span>{" "}
                              Not Available
                            </span>
                          </>
                        )}
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
