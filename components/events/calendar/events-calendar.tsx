"use client"

import { useState, useMemo, useRef } from "react"
import { ChevronLeft, ChevronRight, ChevronDown, Info, SlidersHorizontal, RefreshCw, Plus, Ban, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { AddEventForm } from "@/components/events/new/add-event-form"
import { NewBookingRequestDrawer } from "@/components/bookings/new-booking-request-drawer"
import { BookingStatus } from "@/lib/status-badges"

const viewModes = ["Day", "Week", "Month", "List"] as const
type ViewMode = (typeof viewModes)[number]

const HOURS_START = 7
const HOURS_END = 20
const ROW_HEIGHT = 72

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

// Status configuration for booking colors
const statusConfig: Record<BookingStatus, { bg: string; text: string; dot: string }> = {
  "Pending Review": { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  "Approved": { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  "Deposit Pending": { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  "Deposit Paid": { bg: "bg-cyan-100", text: "text-cyan-700", dot: "bg-cyan-500" },
  "Fully Paid": { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  "Cancelled": { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  "Blocked": { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-500" },
}

const spaces = ["All Spaces", "Main Hall", "Room A", "Room B", "Conference Room", "Classrooms", "Library"]

const timeSlots = [
  "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM",
  "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM"
]

// Mock events data for the calendar
const mockCalendarEvents = [
  { id: "1", title: "Ramadan Iftar", space: "Main Hall", startHour: 18, durationHours: 3, status: "Approved" as BookingStatus, booker: "Community" },
  { id: "2", title: "Youth Group Meeting", space: "Room A", startHour: 15, durationHours: 2, status: "Fully Paid" as BookingStatus, booker: "Youth Committee" },
  { id: "3", title: "Board Meeting", space: "Conference Room", startHour: 10, durationHours: 2, status: "Pending Review" as BookingStatus, booker: "Board" },
  { id: "4", title: "Community Breakfast", space: "Main Hall", startHour: 9, durationHours: 2, status: "Deposit Paid" as BookingStatus, booker: "Volunteers" },
  { id: "5", title: "Maintenance Block", space: "Library", startHour: 8, durationHours: 10, status: "Blocked" as BookingStatus, booker: "Admin", isBlocked: true, blockReason: "Scheduled maintenance" },
]

const mockWeekEvents = [
  { id: "w1", title: "Friday Prayer", time: "1:00 PM", space: "Main Hall", dayIndex: 5, status: "Fully Paid" as BookingStatus },
  { id: "w2", title: "Youth Group", time: "4:00 PM", space: "Room A", dayIndex: 6, status: "Approved" as BookingStatus },
  { id: "w3", title: "Sunday School", time: "10:00 AM", space: "Classrooms", dayIndex: 0, status: "Fully Paid" as BookingStatus },
  { id: "w4", title: "Women's Circle", time: "11:00 AM", space: "Room B", dayIndex: 2, status: "Pending Review" as BookingStatus },
  { id: "w5", title: "Quran Study", time: "7:00 PM", space: "Library", dayIndex: 3, status: "Deposit Paid" as BookingStatus },
]

const mockListEvents = [
  { id: "l1", dateLabel: "FRIDAY, MARCH 6, 2026", startTime: "1:00 PM", endTime: "2:30 PM", duration: "1.5 hrs", space: "Main Hall", title: "Friday Prayer", recurring: true, status: "Fully Paid" as BookingStatus },
  { id: "l2", dateLabel: "FRIDAY, MARCH 6, 2026", startTime: "6:30 PM", endTime: "9:00 PM", duration: "2.5 hrs", space: "Main Hall", title: "Ramadan Iftar", recurring: false, status: "Approved" as BookingStatus },
  { id: "l3", dateLabel: "SATURDAY, MARCH 7, 2026", startTime: "4:00 PM", endTime: "6:00 PM", duration: "2 hrs", space: "Room A", title: "Youth Group Meeting", recurring: true, status: "Deposit Paid" as BookingStatus },
  { id: "l4", dateLabel: "SUNDAY, MARCH 8, 2026", startTime: "10:00 AM", endTime: "12:00 PM", duration: "2 hrs", space: "Classrooms", title: "Sunday School", recurring: true, status: "Fully Paid" as BookingStatus },
]

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

interface EventsCalendarProps {
  onSlotClick?: (date: Date, hour?: number) => void
}

export function EventsCalendar({ onSlotClick }: EventsCalendarProps) {
  const [activeView, setActiveView] = useState<ViewMode>("Day")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddEventDialog, setShowAddEventDialog] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour?: number } | null>(null)
  const [spaceFilter, setSpaceFilter] = useState("All Spaces")
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showManualBookingDialog, setShowManualBookingDialog] = useState(false)

  const [blockForm, setBlockForm] = useState({
    space: "",
    date: "",
    startTime: "",
    endTime: "",
    reason: "",
    allDay: false,
    notes: "",
  })

  const [manualBookingForm, setManualBookingForm] = useState({
    customerName: "",
    email: "",
    phone: "",
    space: "",
    date: "",
    startTime: "",
    endTime: "",
    eventType: "",
    guests: "",
    amount: "",
    notes: "",
  })

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
      } else if (activeView === "Month") {
        d.setMonth(d.getMonth() + direction)
      } else if (activeView === "List") {
        d.setDate(d.getDate() + direction * 30)
      } else {
        d.setDate(d.getDate() + direction)
      }
      return d
    })
  }

  const goToToday = () => {
    setCurrentDate(new Date())
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

  const spaceNames = useMemo(() => {
    if (spaceFilter === "All Spaces") {
      return ["Main Hall", "Room A", "Room B", "Conference Room", "Classrooms", "Library"]
    }
    return [spaceFilter]
  }, [spaceFilter])

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  const handleSlotClick = (date: Date, hour?: number) => {
    setSelectedSlot({ date, hour })
    setShowAddEventDialog(true)
    onSlotClick?.(date, hour)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Controls */}
      <div className="flex flex-col gap-3">
        {/* Navigation Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} className="h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateDate(1)} className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToToday} className="h-9 text-sm">Today</Button>
          </div>
          <h2 suppressHydrationWarning className="text-base sm:text-lg font-semibold text-right">
            {activeView === "List" ? (
              <>
                {formatDate(currentDate)}
                <span className="mx-1 text-muted-foreground">-</span>
                {formatDate(listEndDate)}
              </>
            ) : (
              formatDate(currentDate)
            )}
          </h2>
        </div>

        {/* Filters and Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Toggle */}
            <div className="flex rounded-lg border p-0.5">
              {viewModes.map((mode) => (
                <Button
                  key={mode}
                  variant={activeView === mode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveView(mode)}
                  className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                >
                  {mode}
                </Button>
              ))}
            </div>
            <Select value={spaceFilter} onValueChange={setSpaceFilter}>
              <SelectTrigger className="w-[140px] sm:w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((space) => (
                  <SelectItem key={space} value={space}>{space}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowBlockDialog(true)} className="h-9 text-sm">
              <Ban className="mr-1.5 h-4 w-4" />
              Block
            </Button>
            <Button onClick={() => setShowManualBookingDialog(true)} className="h-9 text-sm">
              <Plus className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Manual Booking</span>
              <span className="sm:hidden">Book</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Day View */}
      {activeView === "Day" && (
        <DayView 
          hours={hours} 
          spaceNames={spaceNames} 
          scrollRef={scrollContainerRef} 
          currentDate={currentDate}
          onSlotClick={handleSlotClick}
          spaceFilter={spaceFilter}
        />
      )}

      {/* Week View */}
      {activeView === "Week" && (
        <WeekView 
          spaceNames={spaceNames} 
          weekDays={weekDays} 
          scrollRef={scrollContainerRef} 
          onSlotClick={handleSlotClick}
          spaceFilter={spaceFilter}
        />
      )}

      {/* List View */}
      {activeView === "List" && <ListView onSlotClick={handleSlotClick} currentDate={currentDate} spaceFilter={spaceFilter} />}

      {/* Month View */}
      {activeView === "Month" && (
        <MonthView currentDate={currentDate} onSlotClick={handleSlotClick} spaceFilter={spaceFilter} />
      )}

      {/* New Booking Request Drawer */}
      <NewBookingRequestDrawer
        open={showAddEventDialog}
        onOpenChange={setShowAddEventDialog}
        initialDate={selectedSlot?.date}
        initialHour={selectedSlot?.hour}
      />

      {/* Block Slot Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Block Calendar Slot</DialogTitle>
            <DialogDescription>
              Block a time slot to prevent new bookings
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {/* Warning Note */}
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Blocked slots will not appear as available to customers on the public booking calendar.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="block-space">Space <span className="text-red-500">*</span></Label>
              <Select value={blockForm.space} onValueChange={(val) => setBlockForm(prev => ({ ...prev, space: val }))}>
                <SelectTrigger id="block-space">
                  <SelectValue placeholder="Select space" />
                </SelectTrigger>
                <SelectContent>
                  {spaces.filter(s => s !== "All Spaces").map((space) => (
                    <SelectItem key={space} value={space}>{space}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="block-date">Date <span className="text-red-500">*</span></Label>
              <Input
                id="block-date"
                type="date"
                value={blockForm.date}
                onChange={(e) => setBlockForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            {/* All Day Checkbox */}
            <div className="flex items-center space-x-3 rounded-lg border p-3">
              <Checkbox
                id="block-allday"
                checked={blockForm.allDay}
                onCheckedChange={(checked) => setBlockForm(prev => ({ 
                  ...prev, 
                  allDay: checked === true,
                  startTime: checked === true ? "" : prev.startTime,
                  endTime: checked === true ? "" : prev.endTime,
                }))}
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="block-allday" className="cursor-pointer text-sm font-medium">
                  All day block
                </Label>
                <p className="text-xs text-muted-foreground">Block the entire day for this space</p>
              </div>
            </div>

            {/* Time Selection - Hidden when All Day is checked */}
            {!blockForm.allDay && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="block-start">Start Time <span className="text-red-500">*</span></Label>
                  <Select value={blockForm.startTime} onValueChange={(val) => setBlockForm(prev => ({ ...prev, startTime: val }))}>
                    <SelectTrigger id="block-start">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="block-end">End Time <span className="text-red-500">*</span></Label>
                  <Select value={blockForm.endTime} onValueChange={(val) => setBlockForm(prev => ({ ...prev, endTime: val }))}>
                    <SelectTrigger id="block-end">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="block-reason">Reason for Block <span className="text-red-500">*</span></Label>
              <Select 
                value={blockForm.reason} 
                onValueChange={(val) => setBlockForm(prev => ({ ...prev, reason: val }))}
              >
                <SelectTrigger id="block-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maintenance">Scheduled Maintenance</SelectItem>
                  <SelectItem value="private-event">Private Event</SelectItem>
                  <SelectItem value="holiday">Holiday / Closure</SelectItem>
                  <SelectItem value="staff-unavailable">Staff Unavailable</SelectItem>
                  <SelectItem value="renovation">Renovation / Construction</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="block-notes">Notes (optional)</Label>
              <Textarea
                id="block-notes"
                placeholder="Add any additional details about this block..."
                value={blockForm.notes}
                onChange={(e) => setBlockForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => setShowBlockDialog(false)}
              disabled={!blockForm.space || !blockForm.date || !blockForm.reason || (!blockForm.allDay && (!blockForm.startTime || !blockForm.endTime))}
            >
              <Ban className="mr-2 h-4 w-4" />
              Save Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Booking Dialog */}
      <Dialog open={showManualBookingDialog} onOpenChange={setShowManualBookingDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Manual Booking</DialogTitle>
            <DialogDescription>
              Add a booking directly without going through the request flow
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-4 border-b pb-4">
              <h4 className="text-sm font-semibold">Customer Information</h4>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manual-name">Customer Name</Label>
                <Input
                  id="manual-name"
                  placeholder="Full name"
                  value={manualBookingForm.customerName}
                  onChange={(e) => setManualBookingForm(prev => ({ ...prev, customerName: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="manual-email">Email</Label>
                  <Input
                    id="manual-email"
                    type="email"
                    placeholder="email@example.com"
                    value={manualBookingForm.email}
                    onChange={(e) => setManualBookingForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="manual-phone">Phone</Label>
                  <Input
                    id="manual-phone"
                    placeholder="(555) 123-4567"
                    value={manualBookingForm.phone}
                    onChange={(e) => setManualBookingForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 border-b pb-4">
              <h4 className="text-sm font-semibold">Event Details</h4>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manual-space">Space</Label>
                <Select value={manualBookingForm.space} onValueChange={(val) => setManualBookingForm(prev => ({ ...prev, space: val }))}>
                  <SelectTrigger id="manual-space">
                    <SelectValue placeholder="Select space" />
                  </SelectTrigger>
                  <SelectContent>
                    {spaces.filter(s => s !== "All Spaces").map((space) => (
                      <SelectItem key={space} value={space}>{space}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manual-date">Date</Label>
                <Input
                  id="manual-date"
                  type="date"
                  value={manualBookingForm.date}
                  onChange={(e) => setManualBookingForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="manual-start">Start Time</Label>
                  <Select value={manualBookingForm.startTime} onValueChange={(val) => setManualBookingForm(prev => ({ ...prev, startTime: val }))}>
                    <SelectTrigger id="manual-start">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="manual-end">End Time</Label>
                  <Select value={manualBookingForm.endTime} onValueChange={(val) => setManualBookingForm(prev => ({ ...prev, endTime: val }))}>
                    <SelectTrigger id="manual-end">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="manual-type">Event Type</Label>
                  <Select value={manualBookingForm.eventType} onValueChange={(val) => setManualBookingForm(prev => ({ ...prev, eventType: val }))}>
                    <SelectTrigger id="manual-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wedding">Wedding</SelectItem>
                      <SelectItem value="Corporate Meeting">Corporate Meeting</SelectItem>
                      <SelectItem value="Birthday Party">Birthday Party</SelectItem>
                      <SelectItem value="Conference">Conference</SelectItem>
                      <SelectItem value="Workshop">Workshop</SelectItem>
                      <SelectItem value="Community Event">Community Event</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="manual-guests">Guest Count</Label>
                  <Input
                    id="manual-guests"
                    type="number"
                    placeholder="100"
                    value={manualBookingForm.guests}
                    onChange={(e) => setManualBookingForm(prev => ({ ...prev, guests: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-semibold">Payment</h4>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manual-amount">Amount</Label>
                <Input
                  id="manual-amount"
                  type="number"
                  placeholder="0.00"
                  value={manualBookingForm.amount}
                  onChange={(e) => setManualBookingForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manual-notes">Notes (optional)</Label>
                <Textarea
                  id="manual-notes"
                  placeholder="Add any additional details..."
                  value={manualBookingForm.notes}
                  onChange={(e) => setManualBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowManualBookingDialog(false)}>Cancel</Button>
            <Button onClick={() => setShowManualBookingDialog(false)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ──────────── Day View ──────────── */

interface DayViewProps {
  hours: number[]
  spaceNames: string[]
  scrollRef: React.RefObject<HTMLDivElement | null>
  currentDate: Date
  onSlotClick: (date: Date, hour?: number) => void
  spaceFilter: string
}

function DayView({ hours, spaceNames, scrollRef, currentDate, onSlotClick, spaceFilter }: DayViewProps) {
  const filteredEvents = useMemo(() => {
    if (spaceFilter === "All Spaces") return mockCalendarEvents
    return mockCalendarEvents.filter(e => e.space === spaceFilter)
  }, [spaceFilter])

  return (
    <Card>
      <CardContent className="p-0">
        <div ref={scrollRef} className="overflow-x-auto">
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
                  const event = filteredEvents.find(
                    (e) => e.space === space && e.startHour === hour
                  )
                  return (
                    <div
                      key={`${hour}-${space}`}
                      className="relative border-b border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/30 transition-colors"
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => onSlotClick(currentDate, hour)}
                    >
                      {event && (
                        <button
                          className={cn(
                            "absolute inset-x-1 top-1 z-[5] overflow-hidden rounded-md border px-2 py-1 text-left text-[11px] font-medium leading-tight shadow-sm transition-opacity hover:opacity-80",
                            statusConfig[event.status].bg,
                            statusConfig[event.status].text,
                            event.status === "Blocked" && "cursor-not-allowed opacity-60"
                          )}
                          style={{
                            height: `${event.durationHours * ROW_HEIGHT - 8}px`,
                          }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={event.status === "Blocked"}
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
      </CardContent>
    </Card>
  )
}

/* ──────────── Week View ──────────── */

interface WeekViewProps {
  spaceNames: string[]
  weekDays: Date[]
  scrollRef: React.RefObject<HTMLDivElement | null>
  onSlotClick: (date: Date, hour?: number) => void
  spaceFilter: string
}

function WeekView({ spaceNames, weekDays, scrollRef, onSlotClick, spaceFilter }: WeekViewProps) {
  const filteredEvents = useMemo(() => {
    if (spaceFilter === "All Spaces") return mockWeekEvents
    return mockWeekEvents.filter(e => e.space === spaceFilter)
  }, [spaceFilter])

  return (
    <Card>
      <CardContent className="p-0">
        <div ref={scrollRef} className="overflow-x-auto">
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
              const eventsForDay = filteredEvents.filter((e) => e.dayIndex === dayOfWeek)

              return (
                <div key={dayIdx} className="contents">
                  {/* Day label */}
                  <div className="flex flex-col items-center justify-start gap-0.5 border-b border-r border-border px-2 py-3 min-h-[90px]">
                    <span className="text-sm font-bold text-primary">{dayDate}</span>
                    <span className="text-xs font-semibold text-primary">{DAY_LABELS[dayOfWeek]}</span>
                  </div>

                  {/* Space cells */}
                  {spaceNames.map((space) => {
                    const cellEvents = eventsForDay.filter((e) => e.space === space)
                    return (
                      <div
                        key={`${dayIdx}-${space}`}
                        className="flex flex-col gap-1.5 border-b border-r border-border px-3 py-2.5 last:border-r-0 min-h-[90px] cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => onSlotClick(day)}
                      >
                        {cellEvents.map((evt) => (
                          <button
                            key={evt.id}
                            className="flex items-center gap-1.5 text-left text-xs transition-opacity hover:opacity-70"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", statusConfig[evt.status].dot)} />
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
      </CardContent>
    </Card>
  )
}

/* ──────────── Month View ──────────── */

interface MonthViewProps {
  currentDate: Date
  onSlotClick: (date: Date) => void
  spaceFilter: string
}

function MonthView({ currentDate, onSlotClick, spaceFilter }: MonthViewProps) {
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const days: (Date | null)[] = []
    
    // Add padding for days before the first of the month
    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }
    
    // Add all days in the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    
    return days
  }, [currentDate])

  // Mock events for the month with status colors
  const monthEvents: Record<number, { title: string; status: BookingStatus }[]> = {
    6: [{ title: "Ramadan Iftar", status: "Approved" }],
    7: [{ title: "Youth Group", status: "Fully Paid" }],
    8: [{ title: "Sunday School", status: "Fully Paid" }],
    13: [{ title: "Friday Prayer", status: "Fully Paid" }, { title: "Community Dinner", status: "Pending Review" }],
    15: [{ title: "Board Meeting", status: "Deposit Paid" }],
    20: [{ title: "Friday Prayer", status: "Fully Paid" }],
    22: [{ title: "Fundraiser Gala", status: "Approved" }],
    27: [{ title: "Maintenance", status: "Blocked" }],
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/50">
          {DAY_LABELS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {daysInMonth.map((day, idx) => (
            <div
              key={idx}
              className={cn(
                "min-h-[100px] border-b border-r border-border p-2 last:border-r-0 transition-colors",
                day ? "cursor-pointer hover:bg-muted/30" : "bg-muted/20",
                idx % 7 === 6 && "border-r-0"
              )}
              onClick={() => day && onSlotClick(day)}
            >
              {day && (
                <>
                  <span className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                    day.toDateString() === new Date().toDateString() 
                      ? "bg-primary text-primary-foreground" 
                      : "text-foreground"
                  )}>
                    {day.getDate()}
                  </span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {monthEvents[day.getDate()]?.slice(0, 3).map((evt, i) => (
                      <div
                        key={i}
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-[10px] font-medium",
                          statusConfig[evt.status].bg,
                          statusConfig[evt.status].text,
                          evt.status === "Blocked" && "opacity-60"
                        )}
                      >
                        {evt.title}
                      </div>
                    ))}
                    {(monthEvents[day.getDate()]?.length ?? 0) > 3 && (
                      <span className="text-[10px] text-muted-foreground px-1">
                        +{(monthEvents[day.getDate()]?.length ?? 0) - 3} more
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* ──────────── List View ──────────── */

interface ListViewProps {
  onSlotClick: (date: Date) => void
  currentDate: Date
  spaceFilter: string
}

function ListView({ onSlotClick, currentDate, spaceFilter }: ListViewProps) {
  const filteredEvents = useMemo(() => {
    if (spaceFilter === "All Spaces") return mockListEvents
    return mockListEvents.filter(e => e.space === spaceFilter)
  }, [spaceFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof mockListEvents>()
    for (const evt of filteredEvents) {
      const group = map.get(evt.dateLabel) ?? []
      group.push(evt)
      map.set(evt.dateLabel, group)
    }
    return Array.from(map.entries())
  }, [filteredEvents])

  return (
    <Card>
      <CardContent className="p-0 overflow-hidden">
        {/* Column headings */}
        <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-4 border-b border-border bg-muted/60 px-5 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Space</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event</span>
        </div>

        {grouped.map(([dateLabel, events]) => (
          <div key={dateLabel}>
            {/* Date header */}
            <div 
              className="border-b border-border bg-card px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors flex items-center justify-between"
              onClick={() => onSlotClick(currentDate)}
            >
              <h3 className="text-sm font-bold text-primary tracking-wide">{dateLabel}</h3>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Event
              </Button>
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
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", statusConfig[evt.status].dot)} />
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

                {/* Event Title */}
                <span className="text-sm font-medium text-foreground truncate">{evt.title}</span>
              </div>
            ))}
          </div>
        ))}

        {/* Add new date section */}
        <div 
          className="flex items-center justify-center gap-2 border-b border-border bg-muted/20 px-5 py-6 cursor-pointer hover:bg-muted/40 transition-colors"
          onClick={() => onSlotClick(currentDate)}
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Click to add a new event</span>
        </div>
      </CardContent>
    </Card>
  )
}
