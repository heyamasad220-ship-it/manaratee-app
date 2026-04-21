"use client"

import { useState } from "react"
import { Building2, Users, Wifi, Car, Coffee, Projector, Music, Utensils, CalendarDays, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

// Venue data with only two venues
const venues = [
  {
    id: "venue-a",
    name: "Grand Hall",
    capacity: 300,
    description: "Our largest and most elegant venue, perfect for weddings, galas, and large corporate events. Features floor-to-ceiling windows with natural lighting and a stunning chandelier centerpiece.",
    image: "/placeholder.svg?height=240&width=400",
    amenities: ["Wi-Fi", "A/V Equipment", "Catering Kitchen", "Stage", "Dance Floor", "Parking"],
    priceRange: "$2,000 - $4,500",
    sqft: "5,000 sq ft",
  },
  {
    id: "venue-b",
    name: "Garden Pavilion",
    capacity: 150,
    description: "A charming indoor-outdoor space surrounded by landscaped gardens. Ideal for intimate weddings, receptions, and social gatherings with a touch of nature.",
    image: "/placeholder.svg?height=240&width=400",
    amenities: ["Wi-Fi", "Outdoor Seating", "Garden Access", "Catering Kitchen", "Parking"],
    priceRange: "$1,200 - $2,800",
    sqft: "2,500 sq ft",
  },
]

const eventTypes = [
  { value: "all", label: "All Event Types" },
  { value: "wedding", label: "Wedding" },
  { value: "corporate", label: "Corporate Event" },
  { value: "birthday", label: "Birthday Party" },
  { value: "reception", label: "Reception" },
  { value: "meeting", label: "Meeting" },
  { value: "other", label: "Other" },
]

const guestCounts = [
  { value: "all", label: "Any Guest Count" },
  { value: "50", label: "Up to 50 guests" },
  { value: "100", label: "Up to 100 guests" },
  { value: "150", label: "Up to 150 guests" },
  { value: "200", label: "Up to 200 guests" },
  { value: "300", label: "Up to 300 guests" },
]

const amenityIcons: Record<string, React.ElementType> = {
  "Wi-Fi": Wifi,
  "A/V Equipment": Projector,
  "Catering Kitchen": Utensils,
  "Parking": Car,
  "Stage": Music,
  "Dance Floor": Music,
  "Outdoor Seating": Coffee,
  "Garden Access": Coffee,
}

export default function BookVenuePage() {
  const [venueFilter, setVenueFilter] = useState("all")
  const [eventTypeFilter, setEventTypeFilter] = useState("all")
  const [guestCountFilter, setGuestCountFilter] = useState("all")
  const [selectedVenue, setSelectedVenue] = useState<typeof venues[0] | null>(null)
  const [showBookingDialog, setShowBookingDialog] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [bookingSubmitted, setBookingSubmitted] = useState(false)

  // Filter venues based on guest count
  const filteredVenues = venues.filter((venue) => {
    if (guestCountFilter === "all") return true
    return venue.capacity >= parseInt(guestCountFilter)
  })

  const handleViewAvailability = (venue: typeof venues[0]) => {
    setSelectedVenue(venue)
    setShowBookingDialog(true)
    setBookingSubmitted(false)
    setSelectedDate(undefined)
  }

  const handleSubmitRequest = () => {
    setBookingSubmitted(true)
  }

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Book a Venue
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Explore our beautiful spaces and find the perfect venue for your next event. 
            View available dates, check amenities, and submit a booking request in minutes.
          </p>
        </div>
      </section>

      {/* Filter Section */}
      <section className="border-b bg-card px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="venue-filter" className="text-sm font-medium">
                Venue
              </Label>
              <Select value={venueFilter} onValueChange={setVenueFilter}>
                <SelectTrigger id="venue-filter" className="bg-background">
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Venues</SelectItem>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="event-filter" className="text-sm font-medium">
                Event Type
              </Label>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger id="event-filter" className="bg-background">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="guest-filter" className="text-sm font-medium">
                Guest Count
              </Label>
              <Select value={guestCountFilter} onValueChange={setGuestCountFilter}>
                <SelectTrigger id="guest-filter" className="bg-background">
                  <SelectValue placeholder="Select guest count" />
                </SelectTrigger>
                <SelectContent>
                  {guestCounts.map((count) => (
                    <SelectItem key={count.value} value={count.value}>
                      {count.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Venue Cards */}
      <section className="px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Available Venues</h2>
            <span className="text-sm text-muted-foreground">{filteredVenues.length} venues</span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {filteredVenues.map((venue) => (
              <Card key={venue.id} className="flex flex-col overflow-hidden border shadow-sm transition-shadow hover:shadow-md">
                {/* Venue Image */}
                <div className="relative aspect-[16/10] bg-muted">
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                    <Building2 className="h-16 w-16 text-primary/30" />
                  </div>
                  <Badge className="absolute right-3 top-3 bg-background/90 text-foreground backdrop-blur-sm">
                    {venue.sqft}
                  </Badge>
                </div>

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{venue.name}</CardTitle>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          Up to {venue.capacity} guests
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="whitespace-nowrap">
                      {venue.priceRange}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pb-4">
                  <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                    {venue.description}
                  </p>

                  {/* Amenities */}
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Amenities
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {venue.amenities.slice(0, 5).map((amenity) => {
                        const Icon = amenityIcons[amenity] || Building2
                        return (
                          <Badge
                            key={amenity}
                            variant="outline"
                            className="gap-1 font-normal"
                          >
                            <Icon className="h-3 w-3" />
                            {amenity}
                          </Badge>
                        )
                      })}
                      {venue.amenities.length > 5 && (
                        <Badge variant="outline" className="font-normal">
                          +{venue.amenities.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="border-t bg-muted/30 pt-4">
                  <Button
                    className="w-full gap-2"
                    onClick={() => handleViewAvailability(venue)}
                  >
                    <CalendarDays className="h-4 w-4" />
                    View Availability
                    <ChevronRight className="ml-auto h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {filteredVenues.length === 0 && (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">No venues match your criteria</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Try adjusting your filters to see more options.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setVenueFilter("all")
                  setEventTypeFilter("all")
                  setGuestCountFilter("all")
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Booking Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {!bookingSubmitted ? (
            <>
              <DialogHeader>
                <DialogTitle>Book {selectedVenue?.name}</DialogTitle>
                <DialogDescription>
                  Select your preferred date and provide event details. Our team will confirm availability within 1-2 business days.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-6 py-4">
                {/* Calendar - Full width on mobile */}
                <div className="flex flex-col gap-2">
                  <Label>Select Date</Label>
                  <div className="rounded-lg border p-2 sm:p-3 overflow-x-auto">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date()}
                      className="mx-auto"
                    />
                  </div>
                  {selectedDate && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {format(selectedDate, "EEEE, MMMM d, yyyy")}
                    </p>
                  )}
                </div>

                {/* Event Details */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="event-type">Event Type</Label>
                    <Select>
                      <SelectTrigger id="event-type" className="h-11">
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventTypes.filter(t => t.value !== "all").map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="guests">Expected Guests</Label>
                    <Input
                      id="guests"
                      type="number"
                      placeholder={`Max ${selectedVenue?.capacity}`}
                      min={1}
                      max={selectedVenue?.capacity}
                      className="h-11"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="start-time">Start Time</Label>
                      <Select>
                        <SelectTrigger id="start-time" className="h-11">
                          <SelectValue placeholder="Start" />
                        </SelectTrigger>
                        <SelectContent>
                          {["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM"].map((time) => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="end-time">End Time</Label>
                      <Select>
                        <SelectTrigger id="end-time" className="h-11">
                          <SelectValue placeholder="End" />
                        </SelectTrigger>
                        <SelectContent>
                          {["12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM"].map((time) => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="notes">Additional Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Tell us more about your event..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowBookingDialog(false)} className="w-full sm:w-auto h-11">
                  Cancel
                </Button>
                <Button onClick={handleSubmitRequest} disabled={!selectedDate} className="w-full sm:w-auto h-11">
                  Submit Request
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="flex flex-col items-center py-6 sm:py-8 text-center">
              <div className="mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-emerald-100">
                <svg
                  className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <DialogTitle className="mb-2">Request Submitted!</DialogTitle>
              <DialogDescription className="mb-6 max-w-sm px-4">
                Thank you for your booking request for {selectedVenue?.name}. 
                Our team will review your request and contact you within 1-2 business days to confirm availability.
              </DialogDescription>
              <Button onClick={() => setShowBookingDialog(false)} className="w-full sm:w-auto h-11">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
