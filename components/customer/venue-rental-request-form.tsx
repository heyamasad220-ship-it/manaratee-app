"use client"

/**
 * Phase B target form for new Venue Rental requests.
 * Must call submitVenueRentalRequest (venue_rentals → rental_reservations) when wired.
 * Do NOT insert into legacy venue_bookings from this form.
 */

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon, Loader2, Building2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { bookingSpaces } from "@/lib/mock-data"

// Anonymous stub until auth context wires the signed-in user
// User types: "employee" | "member" | "guest" | "volunteer" | "donor"
const mockCurrentUser = {
  id: "",
  name: "",
  email: "",
  type: "guest" as const,
}

// Filter spaces based on user type
// Employees can book Internal and External spaces
// All others can only book External spaces
const getAvailableVenues = (userType: string) => {
  const publishedSpaces = bookingSpaces.filter((space) => space.status === "Published")
  
  if (userType === "employee") {
    return publishedSpaces
  }
  
  // Non-employees can only see External spaces
  return publishedSpaces.filter((space) => space.tag === "External")
}

const eventTypes = [
  "Wedding",
  "Engagement",
  "Birthday Party",
  "Baby Shower",
  "Graduation",
  "Corporate Event",
  "Meeting",
  "Dinner Banquet",
  "Memorial Service",
  "Religious Ceremony",
  "Workshop/Seminar",
  "Other",
]

const setupStyles = [
  "Theater Style",
  "Classroom Style",
  "Banquet Style (Round Tables)",
  "Reception Style",
  "U-Shape",
  "Boardroom Style",
  "Hollow Square",
  "No Setup Required",
  "Custom (describe in notes)",
]

const foodTypes = [
  "No Food",
  "Self-Catered (bringing own food)",
  "In-House Catering",
  "External Catering (hiring a caterer)",
  "Light Refreshments Only",
  "Full Meal Service",
]

const timeSlots = [
  "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM",
  "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM",
  "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
  "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM",
  "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM",
  "10:00 PM", "10:30 PM", "11:00 PM",
]

interface FormData {
  venueName: string
  eventDate: Date | undefined
  startTime: string
  endTime: string
  eventType: string
  expectedGuests: string
  setupStyle: string
  foodType: string
  specialNeeds: string
  notes: string
}

export function VenueRentalRequestForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  
  // Get available venues based on user type
  const userType = mockCurrentUser.type as string
  const availableVenues = getAvailableVenues(userType)
  const isEmployee = userType === "employee"
  
  const [formData, setFormData] = useState<FormData>({
    venueName: "",
    eventDate: undefined,
    startTime: "",
    endTime: "",
    eventType: "",
    expectedGuests: "",
    setupStyle: "",
    foodType: "",
    specialNeeds: "",
    notes: "",
  })

  const handleInputChange = (field: keyof FormData, value: string | Date | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    console.log("Venue rental request submitted:", formData)
    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  const selectedVenue = availableVenues.find((v) => v.id === formData.venueName)

  if (isSubmitted) {
    return (
      <Card className="border border-border shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-6 w-6 text-emerald-600"
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
          <h3 className="text-lg font-semibold text-foreground">Request Submitted!</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Thank you for your venue rental request. Our team will review your submission and contact you within 2-3 business days.
          </p>
          <Button
            className="mt-6"
            onClick={() => {
              setIsSubmitted(false)
              setFormData({
                venueName: "",
                eventDate: undefined,
                startTime: "",
                endTime: "",
                eventType: "",
                expectedGuests: "",
                setupStyle: "",
                foodType: "",
                specialNeeds: "",
                notes: "",
              })
            }}
          >
            Submit Another Request
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Event Details */}
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Event Details</CardTitle>
            <CardDescription>Information about your event</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="venueName">Venue Name <span className="text-destructive">*</span></Label>
              {!isEmployee && (
                <p className="text-xs text-muted-foreground">
                  Showing external venues available for booking
                </p>
              )}
              {isEmployee && (
                <p className="text-xs text-muted-foreground">
                  As an employee, you can book both internal and external venues
                </p>
              )}
              <Select
                value={formData.venueName}
                onValueChange={(value) => handleInputChange("venueName", value)}
                required
              >
                <SelectTrigger id="venueName">
                  <SelectValue placeholder="Select a venue" />
                </SelectTrigger>
                <SelectContent>
                  {availableVenues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{venue.name}</span>
                        <Badge 
                          variant={venue.tag === "Internal" ? "secondary" : "outline"} 
                          className="ml-1 text-xs"
                        >
                          {venue.tag}
                        </Badge>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {venue.capacity}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedVenue && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Maximum capacity: {selectedVenue.capacity} guests</span>
                  <Badge 
                    variant={selectedVenue.tag === "Internal" ? "secondary" : "outline"} 
                    className="text-xs"
                  >
                    {selectedVenue.tag} Space
                  </Badge>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Event Date <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.eventDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.eventDate ? format(formData.eventDate, "PPP") : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.eventDate}
                    onSelect={(date) => handleInputChange("eventDate", date)}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Start Time <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.startTime}
                  onValueChange={(value) => handleInputChange("startTime", value)}
                  required
                >
                  <SelectTrigger id="startTime">
                    <SelectValue placeholder="Start time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime">End Time <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.endTime}
                  onValueChange={(value) => handleInputChange("endTime", value)}
                  required
                >
                  <SelectTrigger id="endTime">
                    <SelectValue placeholder="End time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eventType">Type of Event <span className="text-destructive">*</span></Label>
              <Select
                value={formData.eventType}
                onValueChange={(value) => handleInputChange("eventType", value)}
                required
              >
                <SelectTrigger id="eventType">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expectedGuests">Expected Number of Guests <span className="text-destructive">*</span></Label>
              <Input
                id="expectedGuests"
                type="number"
                min="1"
                placeholder="e.g., 50"
                value={formData.expectedGuests}
                onChange={(e) => handleInputChange("expectedGuests", e.target.value)}
                required
              />
              {selectedVenue && formData.expectedGuests && Number(formData.expectedGuests) > selectedVenue.capacity && (
                <p className="text-xs text-destructive">
                  Warning: Expected guests exceed venue capacity of {selectedVenue.capacity}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Setup & Catering */}
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Setup & Catering</CardTitle>
            <CardDescription>Room arrangement and food service needs</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="setupStyle">Setup Style <span className="text-destructive">*</span></Label>
              <Select
                value={formData.setupStyle}
                onValueChange={(value) => handleInputChange("setupStyle", value)}
                required
              >
                <SelectTrigger id="setupStyle">
                  <SelectValue placeholder="Select setup style" />
                </SelectTrigger>
                <SelectContent>
                  {setupStyles.map((style) => (
                    <SelectItem key={style} value={style}>
                      {style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="foodType">Food Type <span className="text-destructive">*</span></Label>
              <Select
                value={formData.foodType}
                onValueChange={(value) => handleInputChange("foodType", value)}
                required
              >
                <SelectTrigger id="foodType">
                  <SelectValue placeholder="Select food type" />
                </SelectTrigger>
                <SelectContent>
                  {foodTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Additional Information</CardTitle>
            <CardDescription>Any special requirements or notes</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="specialNeeds">Special Needs / Accessibility Requirements</Label>
              <Textarea
                id="specialNeeds"
                placeholder="e.g., wheelchair accessibility, hearing loop, dietary restrictions..."
                value={formData.specialNeeds}
                onChange={(e) => handleInputChange("specialNeeds", e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any other information you would like us to know..."
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submit Button */}
      <div className="mt-6 flex justify-end">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Rental Request"
          )}
        </Button>
      </div>
    </form>
  )
}
