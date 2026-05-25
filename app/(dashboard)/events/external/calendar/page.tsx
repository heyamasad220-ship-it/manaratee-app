"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookingStatusBadge, type BookingStatus } from "@/lib/status-badges"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Building2,
  Clock,
  Users,
  DollarSign,
  Plus,
  Ban,
  ExternalLink,
  AlertTriangle,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Booking {
  id: string
  customer: string
  venue: string
  eventType: string
  date: string
  startTime: string
  endTime: string
  guests: number
  status: BookingStatus
  amount: number
  isBlocked?: boolean
  blockReason?: string
}

const mockBookings: Booking[] = [
  { id: "BK-001", customer: "Sarah Johnson", venue: "Grand Hall", eventType: "Wedding", date: "2026-03-28", startTime: "4:00 PM", endTime: "11:00 PM", guests: 300, status: "Fully Paid", amount: 3500 },
  { id: "BK-002", customer: "Ahmed Hassan", venue: "Conference Center", eventType: "Corporate Meeting", date: "2026-03-25", startTime: "9:00 AM", endTime: "5:00 PM", guests: 40, status: "Pending Review", amount: 800 },
  { id: "BK-003", customer: "Maria Garcia", venue: "Garden Pavilion", eventType: "Birthday Party", date: "2026-03-30", startTime: "2:00 PM", endTime: "6:00 PM", guests: 50, status: "Approved", amount: 1200 },
  { id: "BK-004", customer: "Tech Solutions Inc", venue: "Grand Hall", eventType: "Conference", date: "2026-04-05", startTime: "8:00 AM", endTime: "6:00 PM", guests: 400, status: "Deposit Paid", amount: 4500 },
  { id: "BK-005", customer: "John Smith", venue: "Banquet Room", eventType: "Graduation", date: "2026-04-08", startTime: "6:00 PM", endTime: "10:00 PM", guests: 150, status: "Deposit Pending", amount: 2800 },
  { id: "BK-006", customer: "Emily Chen", venue: "Grand Hall", eventType: "Wedding", date: "2026-04-15", startTime: "3:00 PM", endTime: "11:00 PM", guests: 250, status: "Approved", amount: 4200 },
  { id: "BK-007", customer: "Corporate Plus LLC", venue: "Conference Center", eventType: "Workshop", date: "2026-04-10", startTime: "9:00 AM", endTime: "1:00 PM", guests: 35, status: "Fully Paid", amount: 500 },
  { id: "BK-008", customer: "Fatima Ali", venue: "Garden Pavilion", eventType: "Baby Shower", date: "2026-04-12", startTime: "2:00 PM", endTime: "6:00 PM", guests: 45, status: "Deposit Paid", amount: 1100 },
  { id: "BK-009", customer: "Michael Brown", venue: "Conference Center", eventType: "Meeting", date: "2026-03-26", startTime: "10:00 AM", endTime: "12:00 PM", guests: 15, status: "Cancelled", amount: 200 },
  { id: "BK-010", customer: "Lisa Thompson", venue: "Banquet Room", eventType: "Anniversary", date: "2026-04-20", startTime: "5:00 PM", endTime: "10:00 PM", guests: 100, status: "Pending Review", amount: 2400 },
  { id: "BK-011", customer: "Admin Block", venue: "Grand Hall", eventType: "Maintenance", date: "2026-03-27", startTime: "8:00 AM", endTime: "6:00 PM", guests: 0, status: "Blocked", amount: 0, isBlocked: true, blockReason: "Scheduled maintenance" },
  { id: "BK-012", customer: "Admin Block", venue: "Garden Pavilion", eventType: "Private Event", date: "2026-04-01", startTime: "12:00 PM", endTime: "8:00 PM", guests: 0, status: "Blocked", amount: 0, isBlocked: true, blockReason: "super_admin's private event" },
  { id: "BK-013", customer: "David Lee", venue: "Banquet Room", eventType: "Retirement Party", date: "2026-03-24", startTime: "5:00 PM", endTime: "9:00 PM", guests: 75, status: "Fully Paid", amount: 1800 },
  { id: "BK-014", customer: "Jennifer White", venue: "Grand Hall", eventType: "Gala", date: "2026-04-18", startTime: "6:00 PM", endTime: "11:00 PM", guests: 350, status: "Deposit Pending", amount: 5200 },
]

const venues = ["All Venues", "Grand Hall", "Conference Center", "Garden Pavilion", "Banquet Room"]

const statusConfig: Record<BookingStatus, { bg: string; text: string; dot: string }> = {
  "Pending Review": { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  "Approved": { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  "Deposit Pending": { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  "Deposit Paid": { bg: "bg-cyan-100", text: "text-cyan-700", dot: "bg-cyan-500" },
  "Fully Paid": { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  "Cancelled": { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  "Blocked": { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-500" },
}

type ViewMode = "month" | "week" | "day"

export default function VenueCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 24)) // March 24, 2026
  const [venueFilter, setVenueFilter] = useState("All Venues")
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showManualBookingDialog, setShowManualBookingDialog] = useState(false)

  const [blockForm, setBlockForm] = useState({
    venue: "",
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
    venue: "",
    date: "",
    startTime: "",
    endTime: "",
    eventType: "",
    guests: "",
    amount: "",
    notes: "",
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    return { daysInMonth, startingDay }
  }

  const getBookingsForDate = (dateStr: string) => {
    return mockBookings.filter(b => {
      const matchesDate = b.date === dateStr
      const matchesVenue = venueFilter === "All Venues" || b.venue === venueFilter
      return matchesDate && matchesVenue
    })
  }

  const formatDateStr = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const prevPeriod = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    } else if (viewMode === "week") {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() - 7)
      setCurrentDate(newDate)
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() - 1)
      setCurrentDate(newDate)
    }
  }

  const nextPeriod = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    } else if (viewMode === "week") {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + 7)
      setCurrentDate(newDate)
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + 1)
      setCurrentDate(newDate)
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date(2026, 2, 24))
  }

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate)

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    startOfWeek.setDate(startOfWeek.getDate() - day)
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }

  const timeSlots = [
    "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
    "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM"
  ]

  const calendarDays: (number | null)[] = []
  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i)
  }

  const getHeaderTitle = () => {
    if (viewMode === "month") {
      return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
    } else if (viewMode === "week") {
      const weekDays = getWeekDays()
      const start = weekDays[0]
      const end = weekDays[6]
      return `${start.toLocaleString('default', { month: 'short', day: 'numeric' })} - ${end.toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else {
      return currentDate.toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }
  }

  const handleEventClick = (booking: Booking) => {
    if (booking.status !== "Blocked" && booking.status !== "Cancelled") {
      setSelectedBooking(booking)
      setShowDetailDialog(true)
    }
  }

  return (
    <>
      <Header title="Venue Calendar" />
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        {/* Controls */}
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Navigation Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="icon" onClick={prevPeriod} className="h-9 w-9 sm:h-10 sm:w-10">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextPeriod} className="h-9 w-9 sm:h-10 sm:w-10">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToToday} className="h-9 sm:h-10 text-sm">Today</Button>
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-right">{getHeaderTitle()}</h2>
          </div>
          
          {/* Filters and Actions Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* View Toggle */}
              <div className="flex rounded-lg border p-0.5 sm:p-1">
                {(["month", "week", "day"] as ViewMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode(mode)}
                    className="capitalize h-8 px-2 sm:px-3 text-xs sm:text-sm"
                  >
                    {mode}
                  </Button>
                ))}
              </div>
              <Select value={venueFilter} onValueChange={setVenueFilter}>
                <SelectTrigger className="w-[140px] sm:w-[180px] h-9 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((venue) => (
                    <SelectItem key={venue} value={venue}>{venue}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="outline" onClick={() => setShowBlockDialog(true)} className="h-9 sm:h-10 flex-1 sm:flex-none text-sm">
                <Ban className="mr-1.5 sm:mr-2 h-4 w-4" />
                <span className="hidden xs:inline">Block</span>
                <span className="xs:hidden">Block</span>
              </Button>
              <Button onClick={() => setShowManualBookingDialog(true)} className="h-9 sm:h-10 flex-1 sm:flex-none text-sm">
                <Plus className="mr-1.5 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Manual Booking</span>
                <span className="sm:hidden">Book</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Status Legend */}
        <Card>
          <CardContent className="py-2.5 sm:py-3 px-3 sm:px-4">
            <div className="flex flex-wrap gap-x-3 gap-y-2 sm:gap-4">
              {Object.entries(statusConfig).map(([status, config]) => (
                <div key={status} className="flex items-center gap-1.5 sm:gap-2">
                  <div className={cn("h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full shrink-0", config.dot)} />
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Month View */}
        {viewMode === "month" && (
          <Card>
            <CardContent className="p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  const dateStr = day ? formatDateStr(currentDate.getFullYear(), currentDate.getMonth(), day) : ""
                  const bookings = day ? getBookingsForDate(dateStr) : []
                  const isToday = day === 24 && currentDate.getMonth() === 2 && currentDate.getFullYear() === 2026
                  return (
                    <div
                      key={index}
                      className={cn(
                        "min-h-[100px] rounded-lg border p-1",
                        day ? "bg-card" : "bg-muted/30",
                        isToday && "ring-2 ring-primary"
                      )}
                    >
                      {day && (
                        <>
                          <div className={cn(
                            "text-sm font-medium mb-1 px-1",
                            isToday && "text-primary"
                          )}>
                            {day}
                          </div>
                          <div className="flex flex-col gap-1">
                            {bookings.slice(0, 3).map((booking) => (
                              <button
                                key={booking.id}
                                onClick={() => handleEventClick(booking)}
                                disabled={booking.status === "Blocked" || booking.status === "Cancelled"}
                                className={cn(
                                  "text-xs px-1.5 py-0.5 rounded truncate text-left transition-opacity",
                                  statusConfig[booking.status].bg,
                                  statusConfig[booking.status].text,
                                  (booking.status === "Blocked" || booking.status === "Cancelled") 
                                    ? "cursor-not-allowed opacity-60" 
                                    : "hover:opacity-80 cursor-pointer"
                                )}
                              >
                                {booking.isBlocked ? "Blocked" : booking.customer}
                              </button>
                            ))}
                            {bookings.length > 3 && (
                              <span className="text-xs text-muted-foreground px-1">+{bookings.length - 3} more</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Week View */}
        {viewMode === "week" && (
          <Card>
            <CardContent className="p-4 overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Day headers */}
                <div className="grid grid-cols-8 gap-1 mb-2 border-b pb-2">
                  <div className="text-sm font-medium text-muted-foreground py-2 w-20">Time</div>
                  {getWeekDays().map((day) => {
                    const isToday = day.getDate() === 24 && day.getMonth() === 2 && day.getFullYear() === 2026
                    return (
                      <div key={day.toISOString()} className={cn("text-center py-2", isToday && "bg-primary/10 rounded-lg")}>
                        <div className="text-sm font-medium">{day.toLocaleString('default', { weekday: 'short' })}</div>
                        <div className={cn("text-lg font-bold", isToday && "text-primary")}>{day.getDate()}</div>
                      </div>
                    )
                  })}
                </div>
                {/* Time slots */}
                <div className="flex flex-col">
                  {timeSlots.map((time) => (
                    <div key={time} className="grid grid-cols-8 gap-1 border-b last:border-0">
                      <div className="text-xs text-muted-foreground py-2 w-20">{time}</div>
                      {getWeekDays().map((day) => {
                        const dateStr = formatDateStr(day.getFullYear(), day.getMonth(), day.getDate())
                        const dayBookings = getBookingsForDate(dateStr).filter(b => b.startTime === time)
                        return (
                          <div key={day.toISOString() + time} className="min-h-[40px] border-l p-1">
                            {dayBookings.map((booking) => (
                              <button
                                key={booking.id}
                                onClick={() => handleEventClick(booking)}
                                disabled={booking.status === "Blocked" || booking.status === "Cancelled"}
                                className={cn(
                                  "text-xs px-1.5 py-1 rounded truncate w-full text-left mb-1",
                                  statusConfig[booking.status].bg,
                                  statusConfig[booking.status].text,
                                  (booking.status === "Blocked" || booking.status === "Cancelled")
                                    ? "cursor-not-allowed opacity-60"
                                    : "hover:opacity-80 cursor-pointer"
                                )}
                              >
                                {booking.isBlocked ? "Blocked" : booking.customer}
                              </button>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Day View */}
        {viewMode === "day" && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-2">
                {timeSlots.map((time) => {
                  const dateStr = formatDateStr(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
                  const timeBookings = getBookingsForDate(dateStr).filter(b => b.startTime === time)
                  return (
                    <div key={time} className="flex gap-4 border-b pb-2 last:border-0">
                      <div className="text-sm text-muted-foreground w-20 pt-1">{time}</div>
                      <div className="flex-1 min-h-[50px]">
                        {timeBookings.length === 0 ? (
                          <div className="h-full flex items-center">
                            <span className="text-sm text-muted-foreground/50">Available</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {timeBookings.map((booking) => (
                              <button
                                key={booking.id}
                                onClick={() => handleEventClick(booking)}
                                disabled={booking.status === "Blocked" || booking.status === "Cancelled"}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-lg text-left",
                                  statusConfig[booking.status].bg,
                                  (booking.status === "Blocked" || booking.status === "Cancelled")
                                    ? "cursor-not-allowed opacity-60"
                                    : "hover:opacity-80 cursor-pointer"
                                )}
                              >
                                <div>
                                  <p className={cn("font-medium", statusConfig[booking.status].text)}>
                                    {booking.isBlocked ? `Blocked: ${booking.blockReason}` : booking.customer}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {booking.venue} | {booking.startTime} - {booking.endTime}
                                    {!booking.isBlocked && ` | ${booking.guests} guests`}
                                  </p>
                                </div>
                                <Badge className={cn(statusConfig[booking.status].bg, statusConfig[booking.status].text, "hover:opacity-100")}>
                                  {booking.status}
                                </Badge>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Booking Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Booking Details</DialogTitle>
              <DialogDescription>Booking {selectedBooking?.id}</DialogDescription>
            </DialogHeader>
            {selectedBooking && (
              <div className="flex flex-col gap-4 py-4">
                <Badge className={cn("w-fit", statusConfig[selectedBooking.status].bg, statusConfig[selectedBooking.status].text)}>
                  {selectedBooking.status}
                </Badge>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Customer</span>
                    <span className="font-medium">{selectedBooking.customer}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Event Type</span>
                    <span className="font-medium">{selectedBooking.eventType}</span>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Venue</p>
                        <p className="font-medium">{selectedBooking.venue}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="font-medium">{new Date(selectedBooking.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Time</p>
                        <p className="font-medium">{selectedBooking.startTime} - {selectedBooking.endTime}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Guests</p>
                        <p className="font-medium">{selectedBooking.guests}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-emerald-50 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                    <span className="text-emerald-700">Total Amount</span>
                  </div>
                  <span className="text-xl font-bold text-emerald-700">{formatCurrency(selectedBooking.amount)}</span>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
              <Button asChild>
                <Link href={`/events/external/requests/${selectedBooking?.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Full Details
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                <Label htmlFor="block-venue">Venue <span className="text-red-500">*</span></Label>
                <Select value={blockForm.venue} onValueChange={(val) => setBlockForm(prev => ({ ...prev, venue: val }))}>
                  <SelectTrigger id="block-venue">
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.filter(v => v !== "All Venues").map((venue) => (
                      <SelectItem key={venue} value={venue}>{venue}</SelectItem>
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
                  <p className="text-xs text-muted-foreground">Block the entire day for this venue</p>
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
                disabled={!blockForm.venue || !blockForm.date || !blockForm.reason || (!blockForm.allDay && (!blockForm.startTime || !blockForm.endTime))}
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
                  <Label htmlFor="manual-venue">Venue</Label>
                  <Select value={manualBookingForm.venue} onValueChange={(val) => setManualBookingForm(prev => ({ ...prev, venue: val }))}>
                    <SelectTrigger id="manual-venue">
                      <SelectValue placeholder="Select venue" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.filter(v => v !== "All Venues").map((venue) => (
                        <SelectItem key={venue} value={venue}>{venue}</SelectItem>
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
                  <Label htmlFor="manual-amount">Total Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="manual-amount"
                      type="number"
                      placeholder="0"
                      className="pl-7"
                      value={manualBookingForm.amount}
                      onChange={(e) => setManualBookingForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="manual-notes">Notes</Label>
                  <Textarea
                    id="manual-notes"
                    placeholder="Any additional notes about this booking..."
                    value={manualBookingForm.notes}
                    onChange={(e) => setManualBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowManualBookingDialog(false)}>Cancel</Button>
              <Button onClick={() => setShowManualBookingDialog(false)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Booking
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
