"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  MapPin,
  Users,
  Ticket,
  Heart,
  Baby,
  Store,
  DollarSign,
  Megaphone,
  FileText,
  Plus,
  X,
  Trash2,
  Info,
  Repeat,
} from "lucide-react"

// Types
type BookingType = "internal" | "rental" | "blocked"
type EventSetting = "onsite" | "offsite" | "virtual" | "hybrid"

interface TicketType {
  id: string
  name: string
  price: number
  quantity: number
}

interface VolunteerRole {
  id: string
  name: string
  slots: number
}

interface NewBookingRequestDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date
  initialHour?: number
}

const TIME_OPTIONS = [
  "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM",
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM",
  "9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM",
]

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const SPACES = [
  { id: "main-hall", name: "Main Hall", capacity: 500 },
  { id: "room-a", name: "Room A", capacity: 50 },
  { id: "room-b", name: "Room B", capacity: 50 },
  { id: "conference-room", name: "Conference Room", capacity: 20 },
  { id: "classrooms", name: "Classrooms", capacity: 30 },
  { id: "library", name: "Library", capacity: 40 },
]

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDateDisplay(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}

function SectionHeader({ 
  title, 
  icon: Icon, 
  isOpen, 
  onToggle,
  disabled = false,
}: { 
  title: string
  icon: React.ElementType
  isOpen: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <CollapsibleTrigger 
      onClick={onToggle} 
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 py-3 text-left text-sm font-medium transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "hover:text-foreground",
        isOpen ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{title}</span>
      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </CollapsibleTrigger>
  )
}

export function NewBookingRequestDrawer({
  open,
  onOpenChange,
  initialDate,
  initialHour,
}: NewBookingRequestDrawerProps) {
  // Classification
  const [bookingType, setBookingType] = useState<BookingType>("internal")
  const [eventSetting, setEventSetting] = useState<EventSetting>("onsite")

  // Event Details
  const [eventName, setEventName] = useState("")
  const [eventType, setEventType] = useState("")
  const [description, setDescription] = useState("")
  const [department, setDepartment] = useState("")
  const [expectedAttendance, setExpectedAttendance] = useState("")
  const [eventDate, setEventDate] = useState(initialDate ? formatDateForInput(initialDate) : "")
  const [startTime, setStartTime] = useState(initialHour ? `${initialHour > 12 ? initialHour - 12 : initialHour}:00 ${initialHour >= 12 ? 'PM' : 'AM'}` : "")
  const [endTime, setEndTime] = useState("")
  const [isRecurring, setIsRecurring] = useState(false)
  const [repeatFreq, setRepeatFreq] = useState("weekly")
  const [repeatInterval, setRepeatInterval] = useState(1)
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [endCondition, setEndCondition] = useState<"date" | "occurrences">("date")
  const [endDate, setEndDate] = useState("")
  const [endOccurrences, setEndOccurrences] = useState(10)
  const [exceptions, setExceptions] = useState<string[]>([])
  const [showExceptionPicker, setShowExceptionPicker] = useState(false)
  const [exceptionDate, setExceptionDate] = useState("")

  // Location - Onsite
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([])
  const [setupStyle, setSetupStyle] = useState("")
  const [avNeeds, setAvNeeds] = useState("")
  const [setupNotes, setSetupNotes] = useState("")

  // Location - Offsite
  const [externalVenueName, setExternalVenueName] = useState("")
  const [externalAddress, setExternalAddress] = useState("")
  const [externalNotes, setExternalNotes] = useState("")

  // Location - Virtual
  const [virtualPlatform, setVirtualPlatform] = useState("")
  const [meetingLink, setMeetingLink] = useState("")

  // Coordination & Visibility
  const [isMajorEvent, setIsMajorEvent] = useState(false)
  const [isPublicEvent, setIsPublicEvent] = useState(false)
  const [showOnCalendar, setShowOnCalendar] = useState(true)
  const [audienceType, setAudienceType] = useState("")

  // Optional Modules
  const [sellTickets, setSellTickets] = useState(false)
  const [volunteerSignups, setVolunteerSignups] = useState(false)
  const [childcareEnabled, setChildcareEnabled] = useState(false)
  const [vendorsEnabled, setVendorsEnabled] = useState(false)

  // Ticket Details
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [salesEndDate, setSalesEndDate] = useState("")
  const [ticketCapacity, setTicketCapacity] = useState("")

  // Volunteer Details
  const [volunteerRoles, setVolunteerRoles] = useState<VolunteerRole[]>([])
  const [maxVolunteers, setMaxVolunteers] = useState("")

  // Childcare Details
  const [childcareCapacity, setChildcareCapacity] = useState("")
  const [ageRange, setAgeRange] = useState("")
  const [childcareDeadline, setChildcareDeadline] = useState("")

  // Vendor Details
  const [maxVendors, setMaxVendors] = useState("")
  const [vendorDeadline, setVendorDeadline] = useState("")
  const [vendorFee, setVendorFee] = useState("")
  const [vendorApprovalRequired, setVendorApprovalRequired] = useState(true)

  // Payments (Rental only)
  const [totalFee, setTotalFee] = useState("")
  const [depositRequired, setDepositRequired] = useState(false)
  const [depositAmount, setDepositAmount] = useState("")
  const [depositDueDate, setDepositDueDate] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")

  // Public / Marketing
  const [flyerUrl, setFlyerUrl] = useState("")
  const [publicDescription, setPublicDescription] = useState("")
  const [registrationLink, setRegistrationLink] = useState("")
  const [marketingNotes, setMarketingNotes] = useState("")

  // Internal Notes
  const [internalNotes, setInternalNotes] = useState("")
  const [staffInstructions, setStaffInstructions] = useState("")

  // Section visibility
  const [coordinationOpen, setCoordinationOpen] = useState(false)
  const [modulesOpen, setModulesOpen] = useState(false)
  const [moduleDetailsOpen, setModuleDetailsOpen] = useState(false)
  const [paymentsOpen, setPaymentsOpen] = useState(false)
  const [marketingOpen, setMarketingOpen] = useState(false)
  const [internalNotesOpen, setInternalNotesOpen] = useState(false)

  // Reset form when drawer opens
  useEffect(() => {
    if (open && initialDate) {
      setEventDate(formatDateForInput(initialDate))
    }
    if (open && initialHour) {
      const hour = initialHour > 12 ? initialHour - 12 : initialHour
      const ampm = initialHour >= 12 ? 'PM' : 'AM'
      setStartTime(`${hour}:00 ${ampm}`)
    }
  }, [open, initialDate, initialHour])

  const isBlocked = bookingType === "blocked"
  const isRental = bookingType === "rental"
  const showOnsiteFields = eventSetting === "onsite" || eventSetting === "hybrid"
  const showOffsiteFields = eventSetting === "offsite"
  const showVirtualFields = eventSetting === "virtual" || eventSetting === "hybrid"
  const showModules = !isBlocked
  const anyModuleEnabled = sellTickets || volunteerSignups || childcareEnabled || vendorsEnabled
  const showMarketingSection = sellTickets || isPublicEvent

  // Calculate remaining balance
  const remainingBalance = totalFee && depositAmount 
    ? (parseFloat(totalFee) - parseFloat(depositAmount)).toFixed(2)
    : totalFee

  const addTicketType = () => {
    setTicketTypes([...ticketTypes, { id: `ticket-${Date.now()}`, name: "", price: 0, quantity: 0 }])
  }

  const removeTicketType = (id: string) => {
    setTicketTypes(ticketTypes.filter(t => t.id !== id))
  }

  const updateTicketType = (id: string, field: keyof TicketType, value: string | number) => {
    setTicketTypes(ticketTypes.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const addVolunteerRole = () => {
    setVolunteerRoles([...volunteerRoles, { id: `role-${Date.now()}`, name: "", slots: 1 }])
  }

  const removeVolunteerRole = (id: string) => {
    setVolunteerRoles(volunteerRoles.filter(r => r.id !== id))
  }

  const updateVolunteerRole = (id: string, field: keyof VolunteerRole, value: string | number) => {
    setVolunteerRoles(volunteerRoles.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const handleSubmit = () => {
    // Handle form submission
    console.log("Submitting booking request...")
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>New Booking Request</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-6">
            {/* SECTION 1: Booking Classification */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-foreground">Booking Classification</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Booking Type <span className="text-destructive">*</span></Label>
                  <Select value={bookingType} onValueChange={(v) => setBookingType(v as BookingType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="rental">Rental</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Event Setting <span className="text-destructive">*</span></Label>
                  <Select value={eventSetting} onValueChange={(v) => setEventSetting(v as EventSetting)} disabled={isBlocked}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select setting" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onsite">Onsite</SelectItem>
                      <SelectItem value="offsite">Offsite</SelectItem>
                      <SelectItem value="virtual">Virtual</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* SECTION 2: Event Details */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-foreground">Event Details</h3>
              
              <div className="flex flex-col gap-1.5">
                <Label>Event Name <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder={isBlocked ? "Block reason (e.g., Maintenance)" : "Enter event name"} 
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
              </div>

              {!isBlocked && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label>Event Type</Label>
                      <Select value={eventType} onValueChange={setEventType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prayer">Prayer Service</SelectItem>
                          <SelectItem value="lecture">Lecture/Talk</SelectItem>
                          <SelectItem value="class">Class/Workshop</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="community">Community Event</SelectItem>
                          <SelectItem value="fundraiser">Fundraiser</SelectItem>
                          <SelectItem value="youth">Youth Program</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Department / Organizer</Label>
                      <Select value={department} onValueChange={setDepartment}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administration</SelectItem>
                          <SelectItem value="youth">Youth Committee</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="outreach">Outreach</SelectItem>
                          <SelectItem value="women">Women&apos;s Committee</SelectItem>
                          <SelectItem value="external">External Organizer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Description</Label>
                    <Textarea 
                      placeholder="Brief description of the event..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-20"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Expected Attendance</Label>
                    <Input 
                      type="number" 
                      placeholder="Estimated number of attendees"
                      value={expectedAttendance}
                      onChange={(e) => setExpectedAttendance(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Date & Time */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Date <span className="text-destructive">*</span></Label>
                  <Input 
                    type="date" 
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Start Time <span className="text-destructive">*</span></Label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Start" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>End Time <span className="text-destructive">*</span></Label>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="End" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Recurring toggle */}
              {!isBlocked && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Recurring Event?</span>
                  </div>
                  <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                </div>
              )}

              {/* Enhanced Recurring Options */}
              {isRecurring && !isBlocked && (
                <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
                  {/* Recurrence Rules Row */}
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Repeat</Label>
                      <Select value={repeatFreq} onValueChange={setRepeatFreq}>
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Every</span>
                      <Input 
                        type="number" 
                        min={1}
                        max={99}
                        value={repeatInterval}
                        onChange={(e) => setRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 text-center"
                      />
                      <span className="text-sm text-muted-foreground">
                        {repeatFreq === "daily" && (repeatInterval === 1 ? "day" : "days")}
                        {repeatFreq === "weekly" && (repeatInterval === 1 ? "week" : "weeks")}
                        {repeatFreq === "monthly" && (repeatInterval === 1 ? "month" : "months")}
                      </span>
                    </div>
                  </div>

                  {/* Day selector (only for Weekly) */}
                  {repeatFreq === "weekly" && (
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">On days</Label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setSelectedDays(prev => 
                                prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                              )
                            }}
                            className={cn(
                              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                              selectedDays.includes(day)
                                ? "bg-primary text-primary-foreground"
                                : "bg-background border text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {day.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                      {selectedDays.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Days: {selectedDays.map(d => d.slice(0, 3)).join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* End Condition */}
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">End condition</Label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="endCondition"
                            checked={endCondition === "date"}
                            onChange={() => setEndCondition("date")}
                            className="h-4 w-4 text-primary"
                          />
                          <span className="text-sm">End by</span>
                        </label>
                        <Input 
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          disabled={endCondition !== "date"}
                          className="w-40"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="endCondition"
                            checked={endCondition === "occurrences"}
                            onChange={() => setEndCondition("occurrences")}
                            className="h-4 w-4 text-primary"
                          />
                          <span className="text-sm">End after</span>
                        </label>
                        <Input 
                          type="number"
                          min={1}
                          max={999}
                          value={endOccurrences}
                          onChange={(e) => setEndOccurrences(Math.max(1, parseInt(e.target.value) || 1))}
                          disabled={endCondition !== "occurrences"}
                          className="w-20 text-center"
                        />
                        <span className="text-sm text-muted-foreground">occurrence(s)</span>
                      </div>
                    </div>
                  </div>

                  {/* Exceptions */}
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">Exceptions</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {exceptions.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No exceptions</span>
                      ) : (
                        exceptions.map((exc) => (
                          <div key={exc} className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive">
                            {new Date(exc).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            <button
                              type="button"
                              onClick={() => setExceptions(prev => prev.filter(e => e !== exc))}
                              className="ml-1 hover:text-destructive/80"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      )}
                      {!showExceptionPicker ? (
                        <button
                          type="button"
                          onClick={() => setShowExceptionPicker(true)}
                          className="flex items-center gap-1 rounded-full border border-dashed px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                        >
                          <Plus className="h-3 w-3" />
                          Add exception
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input 
                            type="date"
                            value={exceptionDate}
                            onChange={(e) => setExceptionDate(e.target.value)}
                            className="w-36"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (exceptionDate && !exceptions.includes(exceptionDate)) {
                                setExceptions(prev => [...prev, exceptionDate])
                              }
                              setExceptionDate("")
                              setShowExceptionPicker(false)
                            }}
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setExceptionDate("")
                              setShowExceptionPicker(false)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recurrence Summary */}
                  <div className="flex gap-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
                    <Info className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                    <div className="flex flex-col gap-1 text-sm text-blue-800 dark:text-blue-200">
                      <span className="font-medium">Repeat summary:</span>
                      <span>
                        {repeatInterval === 1 
                          ? `Every ${repeatFreq === "daily" ? "day" : repeatFreq === "weekly" ? "week" : "month"}`
                          : `Every ${repeatInterval} ${repeatFreq === "daily" ? "days" : repeatFreq === "weekly" ? "weeks" : "months"}`}
                        {repeatFreq === "weekly" && selectedDays.length > 0 && ` on ${selectedDays.map(d => d.slice(0, 3)).join(", ")}`}.
                      </span>
                      {eventDate && startTime && (
                        <span>
                          Begins on {new Date(eventDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at {startTime}.
                        </span>
                      )}
                      {endCondition === "date" && endDate && (
                        <span>
                          Ends on {new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}{endTime && ` at ${endTime}`}.
                        </span>
                      )}
                      {endCondition === "occurrences" && (
                        <span>
                          Ends after {endOccurrences} occurrence{endOccurrences > 1 ? "s" : ""}.
                        </span>
                      )}
                      {exceptions.length > 0 && (
                        <span className="text-amber-700 dark:text-amber-300">
                          Excluding: {exceptions.map(e => new Date(e + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })).join(", ")}.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: Location / Venue Details */}
            {!isBlocked && (
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Details
                </h3>

                {/* Onsite Fields */}
                {showOnsiteFields && (
                  <div className="flex flex-col gap-3 rounded-lg border p-4">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Onsite Venue</Label>
                    <div className="flex flex-col gap-1.5">
                      <Label>Select Space(s) <span className="text-destructive">*</span></Label>
                      <div className="grid grid-cols-2 gap-2">
                        {SPACES.map((space) => (
                          <label
                            key={space.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors",
                              selectedSpaces.includes(space.id) 
                                ? "border-primary bg-primary/5" 
                                : "hover:bg-muted/50"
                            )}
                          >
                            <Checkbox
                              checked={selectedSpaces.includes(space.id)}
                              onCheckedChange={(checked) => {
                                setSelectedSpaces(prev =>
                                  checked
                                    ? [...prev, space.id]
                                    : prev.filter(s => s !== space.id)
                                )
                              }}
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{space.name}</span>
                              <span className="text-xs text-muted-foreground">Capacity: {space.capacity}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label>Setup Style</Label>
                        <Select value={setupStyle} onValueChange={setSetupStyle}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select style" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="theater">Theater</SelectItem>
                            <SelectItem value="classroom">Classroom</SelectItem>
                            <SelectItem value="banquet">Banquet</SelectItem>
                            <SelectItem value="conference">Conference</SelectItem>
                            <SelectItem value="open">Open Floor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>AV Needs</Label>
                        <Select value={avNeeds} onValueChange={setAvNeeds}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select AV" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="projector">Projector</SelectItem>
                            <SelectItem value="microphone">Microphone</SelectItem>
                            <SelectItem value="full">Full AV Setup</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Setup Notes</Label>
                      <Textarea 
                        placeholder="Special setup requirements..."
                        value={setupNotes}
                        onChange={(e) => setSetupNotes(e.target.value)}
                        className="min-h-16"
                      />
                    </div>
                  </div>
                )}

                {/* Offsite Fields */}
                {showOffsiteFields && (
                  <div className="flex flex-col gap-3 rounded-lg border p-4">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">External Venue</Label>
                    <div className="flex flex-col gap-1.5">
                      <Label>Venue Name <span className="text-destructive">*</span></Label>
                      <Input 
                        placeholder="Enter venue name"
                        value={externalVenueName}
                        onChange={(e) => setExternalVenueName(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Address</Label>
                      <Input 
                        placeholder="Full address"
                        value={externalAddress}
                        onChange={(e) => setExternalAddress(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Notes</Label>
                      <Textarea 
                        placeholder="Additional venue details..."
                        value={externalNotes}
                        onChange={(e) => setExternalNotes(e.target.value)}
                        className="min-h-16"
                      />
                    </div>
                  </div>
                )}

                {/* Virtual Fields */}
                {showVirtualFields && (
                  <div className="flex flex-col gap-3 rounded-lg border p-4">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Virtual Meeting</Label>
                    <div className="flex flex-col gap-1.5">
                      <Label>Platform <span className="text-destructive">*</span></Label>
                      <Select value={virtualPlatform} onValueChange={setVirtualPlatform}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="zoom">Zoom</SelectItem>
                          <SelectItem value="teams">Microsoft Teams</SelectItem>
                          <SelectItem value="meet">Google Meet</SelectItem>
                          <SelectItem value="webex">Webex</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Meeting Link</Label>
                      <Input 
                        placeholder="https://..."
                        value={meetingLink}
                        onChange={(e) => setMeetingLink(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 4: Coordination & Visibility */}
            {!isBlocked && (
              <Collapsible open={coordinationOpen} onOpenChange={setCoordinationOpen}>
                <SectionHeader
                  title="Coordination & Visibility"
                  icon={Users}
                  isOpen={coordinationOpen}
                  onToggle={() => setCoordinationOpen(!coordinationOpen)}
                />
                <CollapsibleContent className="flex flex-col gap-4 pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm">Major Event</span>
                      <Switch checked={isMajorEvent} onCheckedChange={setIsMajorEvent} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm">Public Event</span>
                      <Switch checked={isPublicEvent} onCheckedChange={setIsPublicEvent} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex flex-col">
                      <span className="text-sm">Show on Organization Calendar</span>
                      <span className="text-xs text-muted-foreground">Helps avoid scheduling conflicts</span>
                    </div>
                    <Switch checked={showOnCalendar} onCheckedChange={setShowOnCalendar} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Audience Type</Label>
                    <Select value={audienceType} onValueChange={setAudienceType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select audience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="families">Families</SelectItem>
                        <SelectItem value="youth">Youth</SelectItem>
                        <SelectItem value="adults">Adults</SelectItem>
                        <SelectItem value="seniors">Seniors</SelectItem>
                        <SelectItem value="general">General Public</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* SECTION 5: Optional Modules */}
            {showModules && (
              <Collapsible open={modulesOpen} onOpenChange={setModulesOpen}>
                <SectionHeader
                  title="Optional Modules"
                  icon={Plus}
                  isOpen={modulesOpen}
                  onToggle={() => setModulesOpen(!modulesOpen)}
                />
                <CollapsibleContent className="flex flex-col gap-3 pb-4">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Sell Tickets</span>
                    </div>
                    <Switch checked={sellTickets} onCheckedChange={setSellTickets} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Volunteer Sign-ups</span>
                    </div>
                    <Switch checked={volunteerSignups} onCheckedChange={setVolunteerSignups} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Baby className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Childcare</span>
                    </div>
                    <Switch checked={childcareEnabled} onCheckedChange={setChildcareEnabled} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Vendors</span>
                    </div>
                    <Switch checked={vendorsEnabled} onCheckedChange={setVendorsEnabled} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* SECTION 6: Module Details */}
            {anyModuleEnabled && (
              <Collapsible open={moduleDetailsOpen} onOpenChange={setModuleDetailsOpen}>
                <SectionHeader
                  title="Module Details"
                  icon={FileText}
                  isOpen={moduleDetailsOpen}
                  onToggle={() => setModuleDetailsOpen(!moduleDetailsOpen)}
                />
                <CollapsibleContent className="flex flex-col gap-4 pb-4">
                  {/* Ticket Details */}
                  {sellTickets && (
                    <div className="flex flex-col gap-3 rounded-lg border p-4">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticket Settings</Label>
                      <div className="flex flex-col gap-2">
                        {ticketTypes.map((ticket) => (
                          <div key={ticket.id} className="flex items-center gap-2">
                            <Input 
                              placeholder="Ticket name" 
                              value={ticket.name}
                              onChange={(e) => updateTicketType(ticket.id, 'name', e.target.value)}
                              className="flex-1"
                            />
                            <Input 
                              type="number" 
                              placeholder="Price" 
                              value={ticket.price || ''}
                              onChange={(e) => updateTicketType(ticket.id, 'price', parseFloat(e.target.value) || 0)}
                              className="w-24"
                            />
                            <Input 
                              type="number" 
                              placeholder="Qty" 
                              value={ticket.quantity || ''}
                              onChange={(e) => updateTicketType(ticket.id, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-20"
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeTicketType(ticket.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addTicketType} className="w-fit">
                          <Plus className="mr-1 h-4 w-4" /> Add Ticket Type
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label>Sales End Date</Label>
                          <Input 
                            type="date" 
                            value={salesEndDate}
                            onChange={(e) => setSalesEndDate(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Capacity</Label>
                          <Input 
                            type="number" 
                            placeholder="Max tickets"
                            value={ticketCapacity}
                            onChange={(e) => setTicketCapacity(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Volunteer Details */}
                  {volunteerSignups && (
                    <div className="flex flex-col gap-3 rounded-lg border p-4">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Volunteer Settings</Label>
                      <div className="flex flex-col gap-2">
                        {volunteerRoles.map((role) => (
                          <div key={role.id} className="flex items-center gap-2">
                            <Input 
                              placeholder="Role name" 
                              value={role.name}
                              onChange={(e) => updateVolunteerRole(role.id, 'name', e.target.value)}
                              className="flex-1"
                            />
                            <Input 
                              type="number" 
                              placeholder="Slots" 
                              value={role.slots || ''}
                              onChange={(e) => updateVolunteerRole(role.id, 'slots', parseInt(e.target.value) || 1)}
                              className="w-24"
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeVolunteerRole(role.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addVolunteerRole} className="w-fit">
                          <Plus className="mr-1 h-4 w-4" /> Add Role
                        </Button>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Max Volunteers</Label>
                        <Input 
                          type="number" 
                          placeholder="Total volunteer limit"
                          value={maxVolunteers}
                          onChange={(e) => setMaxVolunteers(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Childcare Details */}
                  {childcareEnabled && (
                    <div className="flex flex-col gap-3 rounded-lg border p-4">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Childcare Settings</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label>Capacity</Label>
                          <Input 
                            type="number" 
                            placeholder="Max children"
                            value={childcareCapacity}
                            onChange={(e) => setChildcareCapacity(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Age Range</Label>
                          <Select value={ageRange} onValueChange={setAgeRange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0-2">0-2 years</SelectItem>
                              <SelectItem value="3-5">3-5 years</SelectItem>
                              <SelectItem value="6-10">6-10 years</SelectItem>
                              <SelectItem value="0-10">All ages (0-10)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Registration Deadline</Label>
                        <Input 
                          type="date" 
                          value={childcareDeadline}
                          onChange={(e) => setChildcareDeadline(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Vendor Details */}
                  {vendorsEnabled && (
                    <div className="flex flex-col gap-3 rounded-lg border p-4">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendor Settings</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label>Max Vendors</Label>
                          <Input 
                            type="number" 
                            placeholder="Vendor limit"
                            value={maxVendors}
                            onChange={(e) => setMaxVendors(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Application Deadline</Label>
                          <Input 
                            type="date" 
                            value={vendorDeadline}
                            onChange={(e) => setVendorDeadline(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Vendor Fee</Label>
                        <Input 
                          type="number" 
                          placeholder="0.00"
                          value={vendorFee}
                          onChange={(e) => setVendorFee(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm">Approval Required</span>
                        <Switch checked={vendorApprovalRequired} onCheckedChange={setVendorApprovalRequired} />
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* SECTION 7: Payments (Rental only) */}
            {isRental && (
              <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen}>
                <SectionHeader
                  title="Payments"
                  icon={DollarSign}
                  isOpen={paymentsOpen}
                  onToggle={() => setPaymentsOpen(!paymentsOpen)}
                />
                <CollapsibleContent className="flex flex-col gap-4 pb-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Total Fee <span className="text-destructive">*</span></Label>
                    <Input 
                      type="number" 
                      placeholder="0.00"
                      value={totalFee}
                      onChange={(e) => setTotalFee(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm">Deposit Required</span>
                    <Switch checked={depositRequired} onCheckedChange={setDepositRequired} />
                  </div>
                  {depositRequired && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label>Deposit Amount</Label>
                        <Input 
                          type="number" 
                          placeholder="0.00"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Deposit Due Date</Label>
                        <Input 
                          type="date" 
                          value={depositDueDate}
                          onChange={(e) => setDepositDueDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  {totalFee && (
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                      <span className="text-sm text-muted-foreground">Remaining Balance</span>
                      <span className="font-semibold">${remainingBalance}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Label>Payment Notes</Label>
                    <Textarea 
                      placeholder="Special payment arrangements..."
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="min-h-16"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* SECTION 8: Public / Marketing */}
            {showMarketingSection && (
              <Collapsible open={marketingOpen} onOpenChange={setMarketingOpen}>
                <SectionHeader
                  title="Public / Marketing"
                  icon={Megaphone}
                  isOpen={marketingOpen}
                  onToggle={() => setMarketingOpen(!marketingOpen)}
                />
                <CollapsibleContent className="flex flex-col gap-4 pb-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Upload Flyer</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="file" 
                        accept="image/*,.pdf"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Public Description</Label>
                    <Textarea 
                      placeholder="Description for public display..."
                      value={publicDescription}
                      onChange={(e) => setPublicDescription(e.target.value)}
                      className="min-h-20"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Registration Link</Label>
                    <Input 
                      placeholder="https://..."
                      value={registrationLink}
                      onChange={(e) => setRegistrationLink(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Marketing Notes</Label>
                    <Textarea 
                      placeholder="Notes for marketing team..."
                      value={marketingNotes}
                      onChange={(e) => setMarketingNotes(e.target.value)}
                      className="min-h-16"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* SECTION 9: Internal Notes */}
            <Collapsible open={internalNotesOpen} onOpenChange={setInternalNotesOpen}>
              <SectionHeader
                title="Internal Notes"
                icon={FileText}
                isOpen={internalNotesOpen}
                onToggle={() => setInternalNotesOpen(!internalNotesOpen)}
              />
              <CollapsibleContent className="flex flex-col gap-4 pb-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Internal Notes</Label>
                  <Textarea 
                    placeholder="Notes visible only to staff..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    className="min-h-20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Staff Instructions</Label>
                  <Textarea 
                    placeholder="Setup instructions, special requirements..."
                    value={staffInstructions}
                    onChange={(e) => setStaffInstructions(e.target.value)}
                    className="min-h-20"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-between border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Submit Request
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
