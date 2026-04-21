"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, Clock, MapPin, Users, Calendar as CalendarIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

// View modes
const viewModes = ["Month", "Week", "Day"] as const
type ViewMode = (typeof viewModes)[number]

// Slot status types
type SlotStatus = "available" | "pending" | "booked" | "blocked"

// External venues only
const externalVenues = [
  { id: "venue-a", name: "Grand Hall", capacity: 300 },
  { id: "venue-b", name: "Garden Pavilion", capacity: 150 },
]

// Time slots for day view
const timeSlots = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
  "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"
]

// Mock booking data - customers only see availability status, not details
interface BookingSlot {
  id: string
  venueId: string
  date: string // YYYY-MM-DD
  timeSlot?: string // for day view
  status: SlotStatus
}

const mockBookings: BookingSlot[] = [
  // Grand Hall bookings
  { id: "b1", venueId: "venue-a", date: "2026-03-28", status: "booked" },
  { id: "b2", venueId: "venue-a", date: "2026-03-29", status: "pending" },
  { id: "b3", venueId: "venue-a", date: "2026-04-05", status: "booked" },
  { id: "b4", venueId: "venue-a", date: "2026-04-10", status: "blocked" },
  { id: "b5", venueId: "venue-a", date: "2026-04-12", status: "pending" },
  { id: "b6", venueId: "venue-a", date: "2026-04-18", status: "booked" },
  { id: "b7", venueId: "venue-a", date: "2026-04-25", status: "booked" },
  // Garden Pavilion bookings
  { id: "b8", venueId: "venue-b", date: "2026-03-27", status: "booked" },
  { id: "b9", venueId: "venue-b", date: "2026-04-03", status: "pending" },
  { id: "b10", venueId: "venue-b", date: "2026-04-06", status: "booked" },
  { id: "b11", venueId: "venue-b", date: "2026-04-11", status: "blocked" },
  { id: "b12", venueId: "venue-b", date: "2026-04-19", status: "booked" },
  { id: "b13", venueId: "venue-b", date: "2026-04-26", status: "pending" },
]

// Day view time slot bookings
const mockTimeSlotBookings: BookingSlot[] = [
  { id: "ts1", venueId: "venue-a", date: "2026-03-24", timeSlot: "10:00 AM", status: "booked" },
  { id: "ts2", venueId: "venue-a", date: "2026-03-24", timeSlot: "11:00 AM", status: "booked" },
  { id: "ts3", venueId: "venue-a", date: "2026-03-24", timeSlot: "2:00 PM", status: "pending" },
  { id: "ts4", venueId: "venue-a", date: "2026-03-24", timeSlot: "6:00 PM", status: "blocked" },
  { id: "ts5", venueId: "venue-b", date: "2026-03-24", timeSlot: "9:00 AM", status: "booked" },
  { id: "ts6", venueId: "venue-b", date: "2026-03-24", timeSlot: "3:00 PM", status: "pending" },
]

const statusConfig: Record<SlotStatus, { label: string; className: string; bgClass: string }> = {
  available: { label: "Available", className: "bg-emerald-100 text-emerald-700 border-emerald-200", bgClass: "bg-emerald-50 hover:bg-emerald-100 cursor-pointer" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 border-amber-200", bgClass: "bg-amber-50" },
  booked: { label: "Booked", className: "bg-blue-100 text-blue-700 border-blue-200", bgClass: "bg-blue-50" },
  blocked: { label: "Blocked", className: "bg-gray-100 text-gray-500 border-gray-200", bgClass: "bg-gray-100" },
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function getDateString(date: Date) {
  return date.toISOString().split("T")[0]
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d
}

export default function VenueAvailabilityPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("Month")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedVenue, setSelectedVenue] = useState<string>("all")
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ venue: typeof externalVenues[0]; date: Date; timeSlot?: string } | null>(null)
  const [bookingForm, setBookingForm] = useState({
    name: "",
    email: "",
    phone: "",
    eventType: "",
    guestCount: "",
    admissionFees: false,
    setupStyle: "",
    foodTypes: [] as string[],
    specialNeeds: [] as string[],
    notes: "",
    termsAccepted: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Navigation
  const navigate = (direction: -1 | 1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      if (viewMode === "Month") {
        d.setMonth(d.getMonth() + direction)
      } else if (viewMode === "Week") {
        d.setDate(d.getDate() + direction * 7)
      } else {
        d.setDate(d.getDate() + direction)
      }
      return d
    })
  }

  // Get slot status for a date/venue
  const getSlotStatus = (venueId: string, dateStr: string, timeSlot?: string): SlotStatus => {
    if (timeSlot) {
      const booking = mockTimeSlotBookings.find(
        b => b.venueId === venueId && b.date === dateStr && b.timeSlot === timeSlot
      )
      return booking?.status || "available"
    }
    const booking = mockBookings.find(b => b.venueId === venueId && b.date === dateStr)
    return booking?.status || "available"
  }

  // Handle slot click
  const handleSlotClick = (venue: typeof externalVenues[0], date: Date, timeSlot?: string) => {
    const dateStr = getDateString(date)
    const status = getSlotStatus(venue.id, dateStr, timeSlot)
    
    // Only allow clicking available slots
    if (status !== "available") return
    
    setSelectedSlot({ venue, date, timeSlot })
    setBookingForm({ name: "", email: "", phone: "", eventType: "", guestCount: "", admissionFees: false, setupStyle: "", foodTypes: [], specialNeeds: [], notes: "", termsAccepted: false })
    setSubmitted(false)
    setIsBookingOpen(true)
  }

  // Submit booking request
  const handleSubmit = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setSubmitted(true)
    }, 1500)
  }

  // Filter venues
  const displayVenues = selectedVenue === "all" 
    ? externalVenues 
    : externalVenues.filter(v => v.id === selectedVenue)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Venue Availability</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View available dates and times for our external venues. Click on an available slot to submit a booking request.
        </p>
      </div>

      {/* Filters & Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: Venue Filter */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="venue-filter" className="text-sm font-medium whitespace-nowrap">Venue:</Label>
                <Select value={selectedVenue} onValueChange={setSelectedVenue}>
                  <SelectTrigger id="venue-filter" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Venues</SelectItem>
                    {externalVenues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right: View Toggle & Navigation */}
            <div className="flex flex-wrap items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center rounded-md border border-border bg-background">
                {viewModes.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md",
                      viewMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                  Today
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Current Period */}
              <span className="text-sm font-semibold text-foreground min-w-[140px]">
                {viewMode === "Month" ? formatMonthYear(currentDate) : formatDate(currentDate)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        {(Object.entries(statusConfig) as [SlotStatus, typeof statusConfig.available][]).map(([status, config]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={cn("h-4 w-4 rounded border", config.className)} />
            <span className="text-sm text-muted-foreground">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar Views */}
      {viewMode === "Month" && (
        <MonthView
          currentDate={currentDate}
          venues={displayVenues}
          getSlotStatus={getSlotStatus}
          onSlotClick={handleSlotClick}
        />
      )}

      {viewMode === "Week" && (
        <WeekView
          currentDate={currentDate}
          venues={displayVenues}
          getSlotStatus={getSlotStatus}
          onSlotClick={handleSlotClick}
        />
      )}

      {viewMode === "Day" && (
        <DayView
          currentDate={currentDate}
          venues={displayVenues}
          getSlotStatus={getSlotStatus}
          onSlotClick={handleSlotClick}
        />
      )}

      {/* Booking Request Sheet */}
      <Sheet open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{submitted ? "Request Submitted!" : "Request Booking"}</SheetTitle>
            <SheetDescription>
              {submitted 
                ? "We've received your booking request and will contact you within 24 hours."
                : "Fill out the form below to submit a booking request. Our team will review and contact you."}
            </SheetDescription>
          </SheetHeader>

          {submitted ? (
            <div className="flex flex-col gap-6 py-6">
              {/* Success Icon & Message */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">Your booking request has been submitted</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  Thank you for your request. Our team will review availability and get back to you shortly.
                </p>
              </div>

              {/* Summary Card */}
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Booking Summary</CardTitle>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending Review</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Venue</p>
                      <p className="text-sm font-medium">{selectedSlot?.venue.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-medium">{selectedSlot && formatDate(selectedSlot.date)}</p>
                    </div>
                  </div>
                  {selectedSlot?.timeSlot && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Time</p>
                        <p className="text-sm font-medium">{selectedSlot.timeSlot}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Event Type</p>
                      <p className="text-sm font-medium capitalize">{bookingForm.eventType.replace("-", " ")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Guest Count</p>
                      <p className="text-sm font-medium">{bookingForm.guestCount} guests</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Supporting Text */}
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Our admin team will review your request and check availability. You will receive an email confirmation at <span className="font-medium text-foreground">{bookingForm.email}</span> with the status of your booking within 24-48 hours.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsBookingOpen(false)
                    setSubmitted(false)
                  }}
                >
                  Back to Calendar
                </Button>
                <Button 
                  onClick={() => {
                    setSubmitted(false)
                    setBookingForm({ name: "", email: "", phone: "", eventType: "", guestCount: "", admissionFees: false, setupStyle: "", foodTypes: [], specialNeeds: [], notes: "", termsAccepted: false })
                    setSelectedSlot(null)
                    setIsBookingOpen(false)
                  }}
                >
                  Submit Another Request
                </Button>
              </div>
            </div>
          ) : (
            <>
              {selectedSlot && (
                <div className="mt-6 flex flex-col gap-6">
                  {/* Selected Slot Info */}
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>{selectedSlot.venue.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        <Users className="mr-1 h-3 w-3" />
                        Up to {selectedSlot.venue.capacity}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarIcon className="h-4 w-4" />
                      <span>{formatDate(selectedSlot.date)}</span>
                    </div>
                    {selectedSlot.timeSlot && (
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{selectedSlot.timeSlot}</span>
                      </div>
                    )}
                  </div>

                  {/* Form */}
                  <div className="flex flex-col gap-5 max-h-[60vh] overflow-y-auto pr-2">
                    {/* Contact Information */}
                    <div className="flex flex-col gap-4">
                      <h4 className="text-sm font-semibold text-foreground">Contact Information</h4>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                        <Input
                          id="name"
                          value={bookingForm.name}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="John Smith"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                        <Input
                          id="email"
                          type="email"
                          value={bookingForm.email}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="john@example.com"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                        <Input
                          id="phone"
                          value={bookingForm.phone}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="flex flex-col gap-4 pt-2 border-t">
                      <h4 className="text-sm font-semibold text-foreground">Event Details</h4>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="eventType">Event Type <span className="text-red-500">*</span></Label>
                        <Select
                          value={bookingForm.eventType}
                          onValueChange={(val) => setBookingForm(prev => ({ ...prev, eventType: val }))}
                        >
                          <SelectTrigger id="eventType">
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="wedding">Wedding</SelectItem>
                            <SelectItem value="private-dinner">Private Dinner</SelectItem>
                            <SelectItem value="baby-shower">Baby Shower</SelectItem>
                            <SelectItem value="conference">Conference</SelectItem>
                            <SelectItem value="seminar">Seminar</SelectItem>
                            <SelectItem value="birthday">Birthday</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="guestCount">Number of Guests <span className="text-red-500">*</span></Label>
                        <Input
                          id="guestCount"
                          type="number"
                          value={bookingForm.guestCount}
                          onChange={(e) => setBookingForm(prev => ({ ...prev, guestCount: e.target.value }))}
                          placeholder="100"
                          min={1}
                          max={selectedSlot?.venue.capacity}
                        />
                        <p className="text-xs text-muted-foreground">Maximum capacity: {selectedSlot?.venue.capacity}</p>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex flex-col gap-0.5">
                          <Label htmlFor="admissionFees" className="text-sm font-medium">Charging Admission Fees?</Label>
                          <p className="text-xs text-muted-foreground">Will attendees be charged to enter?</p>
                        </div>
                        <Switch
                          id="admissionFees"
                          checked={bookingForm.admissionFees}
                          onCheckedChange={(checked) => setBookingForm(prev => ({ ...prev, admissionFees: checked }))}
                        />
                      </div>
                    </div>

                    {/* Setup Style */}
                    <div className="flex flex-col gap-3 pt-2 border-t">
                      <h4 className="text-sm font-semibold text-foreground">Setup Style <span className="text-red-500">*</span></h4>
                      <RadioGroup
                        value={bookingForm.setupStyle}
                        onValueChange={(val) => setBookingForm(prev => ({ ...prev, setupStyle: val }))}
                        className="flex flex-col gap-2"
                      >
                        {[
                          { value: "round-tables", label: "Round tables with chairs" },
                          { value: "rectangular-tables", label: "Rectangular tables" },
                          { value: "theatre", label: "Theatre style seating" },
                          { value: "classroom", label: "Classroom style" },
                          { value: "other-setup", label: "Other" },
                        ].map((option) => (
                          <div key={option.value} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                            <RadioGroupItem value={option.value} id={option.value} />
                            <Label htmlFor={option.value} className="flex-1 cursor-pointer text-sm">{option.label}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    {/* Food Type */}
                    <div className="flex flex-col gap-3 pt-2 border-t">
                      <h4 className="text-sm font-semibold text-foreground">Food & Beverage</h4>
                      <p className="text-xs text-muted-foreground">Select all that apply</p>
                      <div className="flex flex-col gap-2">
                        {[
                          { value: "full-meal", label: "Full meal" },
                          { value: "coffee-tea", label: "Coffee and tea" },
                          { value: "packed-meals", label: "Packed meals" },
                          { value: "snacks", label: "Snacks and refreshments" },
                        ].map((option) => (
                          <div key={option.value} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                            <Checkbox
                              id={`food-${option.value}`}
                              checked={bookingForm.foodTypes.includes(option.value)}
                              onCheckedChange={(checked) => {
                                setBookingForm(prev => ({
                                  ...prev,
                                  foodTypes: checked
                                    ? [...prev.foodTypes, option.value]
                                    : prev.foodTypes.filter(f => f !== option.value)
                                }))
                              }}
                            />
                            <Label htmlFor={`food-${option.value}`} className="flex-1 cursor-pointer text-sm">{option.label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Special Needs */}
                    <div className="flex flex-col gap-3 pt-2 border-t">
                      <h4 className="text-sm font-semibold text-foreground">Special Needs & Equipment</h4>
                      <p className="text-xs text-muted-foreground">Select all that apply</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: "sound-system", label: "Sound system" },
                          { value: "projector", label: "Projector" },
                          { value: "microphone", label: "Microphone" },
                          { value: "stage", label: "Stage" },
                          { value: "other-equipment", label: "Other" },
                        ].map((option) => (
                          <div key={option.value} className="flex items-center space-x-2 rounded-lg border p-2.5 hover:bg-muted/50">
                            <Checkbox
                              id={`need-${option.value}`}
                              checked={bookingForm.specialNeeds.includes(option.value)}
                              onCheckedChange={(checked) => {
                                setBookingForm(prev => ({
                                  ...prev,
                                  specialNeeds: checked
                                    ? [...prev.specialNeeds, option.value]
                                    : prev.specialNeeds.filter(n => n !== option.value)
                                }))
                              }}
                            />
                            <Label htmlFor={`need-${option.value}`} className="cursor-pointer text-sm">{option.label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="flex flex-col gap-2 pt-2 border-t">
                      <Label htmlFor="notes">Additional Notes</Label>
                      <Textarea
                        id="notes"
                        value={bookingForm.notes}
                        onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Any additional information about your event..."
                        rows={3}
                      />
                    </div>

                    {/* Signature Area */}
                    <div className="flex flex-col gap-2 pt-2 border-t">
                      <Label>Digital Signature</Label>
                      <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30">
                        <p className="text-sm text-muted-foreground">Sign here (signature capture placeholder)</p>
                      </div>
                    </div>

                    {/* Terms */}
                    <div className="flex items-start space-x-3 rounded-lg border p-3 bg-muted/30">
                      <Checkbox
                        id="terms"
                        checked={bookingForm.termsAccepted}
                        onCheckedChange={(checked) => setBookingForm(prev => ({ ...prev, termsAccepted: checked === true }))}
                        className="mt-0.5"
                      />
                      <Label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed">
                        I agree to the <a href="#" className="text-primary underline">Terms and Conditions</a> and <a href="#" className="text-primary underline">Venue Rental Policy</a>. <span className="text-red-500">*</span>
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              <SheetFooter className="mt-6 border-t pt-4">
                <Button variant="outline" onClick={() => setIsBookingOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !bookingForm.name || 
                    !bookingForm.email || 
                    !bookingForm.phone || 
                    !bookingForm.eventType || 
                    !bookingForm.guestCount || 
                    !bookingForm.setupStyle ||
                    !bookingForm.termsAccepted ||
                    isSubmitting
                  }
                >
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

/* ──────────── Month View ──────────── */

function MonthView({
  currentDate,
  venues,
  getSlotStatus,
  onSlotClick,
}: {
  currentDate: Date
  venues: typeof externalVenues
  getSlotStatus: (venueId: string, dateStr: string) => SlotStatus
  onSlotClick: (venue: typeof externalVenues[0], date: Date) => void
}) {
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const days: Date[] = []
    
    // Add days from previous month
    const startPadding = firstDay.getDay()
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push(d)
    }
    
    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }
    
    // Add days from next month
    const endPadding = 6 - lastDay.getDay()
    for (let i = 1; i <= endPadding; i++) {
      days.push(new Date(year, month + 1, i))
    }
    
    return days
  }, [currentDate])

  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth()
  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  return (
    <div className="flex flex-col gap-4">
      {venues.map((venue) => (
        <Card key={venue.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{venue.name}</CardTitle>
            <CardDescription>Capacity: {venue.capacity} guests</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, idx) => {
                const dateStr = getDateString(date)
                const status = getSlotStatus(venue.id, dateStr)
                const config = statusConfig[status]
                const inMonth = isCurrentMonth(date)
                const today = isToday(date)
                
                return (
                  <button
                    key={idx}
                    onClick={() => status === "available" && onSlotClick(venue, date)}
                    disabled={status !== "available"}
                    className={cn(
                      "aspect-square flex flex-col items-center justify-center rounded-md text-sm transition-colors border",
                      inMonth ? "text-foreground" : "text-muted-foreground/50",
                      status === "available" ? config.bgClass : cn(config.bgClass, "cursor-not-allowed"),
                      today && "ring-2 ring-primary ring-offset-1"
                    )}
                  >
                    <span className={cn("font-medium", today && "text-primary")}>{date.getDate()}</span>
                    {inMonth && status !== "available" && (
                      <span className="text-[10px] leading-none mt-0.5">{status}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ──────────── Week View ──────────── */

function WeekView({
  currentDate,
  venues,
  getSlotStatus,
  onSlotClick,
}: {
  currentDate: Date
  venues: typeof externalVenues
  getSlotStatus: (venueId: string, dateStr: string) => SlotStatus
  onSlotClick: (venue: typeof externalVenues[0], date: Date) => void
}) {
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString()

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left text-sm font-medium text-muted-foreground w-[140px]">Venue</th>
                {weekDays.map((date, idx) => (
                  <th key={idx} className={cn(
                    "p-3 text-center text-sm font-medium min-w-[100px]",
                    isToday(date) ? "bg-primary/5 text-primary" : "text-muted-foreground"
                  )}>
                    <div>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()]}</div>
                    <div className={cn("text-lg font-semibold", isToday(date) ? "text-primary" : "text-foreground")}>
                      {date.getDate()}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => (
                <tr key={venue.id} className="border-b last:border-b-0">
                  <td className="p-3 font-medium text-sm">{venue.name}</td>
                  {weekDays.map((date, idx) => {
                    const dateStr = getDateString(date)
                    const status = getSlotStatus(venue.id, dateStr)
                    const config = statusConfig[status]
                    
                    return (
                      <td key={idx} className="p-2">
                        <button
                          onClick={() => status === "available" && onSlotClick(venue, date)}
                          disabled={status !== "available"}
                          className={cn(
                            "w-full py-3 rounded-md text-xs font-medium transition-colors border",
                            config.className,
                            status === "available" && "hover:bg-emerald-200"
                          )}
                        >
                          {config.label}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

/* ──────────── Day View ──────────── */

function DayView({
  currentDate,
  venues,
  getSlotStatus,
  onSlotClick,
}: {
  currentDate: Date
  venues: typeof externalVenues
  getSlotStatus: (venueId: string, dateStr: string, timeSlot?: string) => SlotStatus
  onSlotClick: (venue: typeof externalVenues[0], date: Date, timeSlot?: string) => void
}) {
  const dateStr = getDateString(currentDate)

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left text-sm font-medium text-muted-foreground w-[100px]">Time</th>
                {venues.map((venue) => (
                  <th key={venue.id} className="p-3 text-center text-sm font-medium text-foreground min-w-[150px]">
                    {venue.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((timeSlot) => (
                <tr key={timeSlot} className="border-b last:border-b-0">
                  <td className="p-3 text-sm text-muted-foreground font-medium">{timeSlot}</td>
                  {venues.map((venue) => {
                    const status = getSlotStatus(venue.id, dateStr, timeSlot)
                    const config = statusConfig[status]
                    
                    return (
                      <td key={venue.id} className="p-2">
                        <button
                          onClick={() => status === "available" && onSlotClick(venue, currentDate, timeSlot)}
                          disabled={status !== "available"}
                          className={cn(
                            "w-full py-2 rounded-md text-xs font-medium transition-colors border",
                            config.className,
                            status === "available" && "hover:bg-emerald-200"
                          )}
                        >
                          {config.label}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
