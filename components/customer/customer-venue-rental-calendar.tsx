"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  MapPin,
  Plus,
} from "lucide-react"

import { submitVenueRentalRequest } from "@/lib/bookings/venue-rental-actions"
import type {
  PublicAvailabilityBlock,
  RentalAddonCatalogItem,
  RentalSpaceSlotInput,
} from "@/lib/bookings/venue-rental-types"
import type { VenuePublicDayHours } from "@/lib/bookings/venue-day-pricing"
import {
  getVenueDayHoursForDate,
  isVenueHourBookable,
  resolveCalendarHourRange,
} from "@/lib/bookings/venue-day-pricing"
import {
  computeVenueRentalTableCount,
  resolveVenueRentalAddonPricingBasis,
  resolveVenueRentalAddonQuantity,
} from "@/lib/bookings/venue-rental-addon-quantity"
import {
  buildVenueRateLookup,
  computeVenueRentalQuotedCharges,
} from "@/lib/bookings/venue-rental-quote"
import type { RoomSetupStyle } from "@/lib/setup-styles/setup-style-types"
import { cn } from "@/lib/utils"
import { SetupStyleField } from "@/components/setup-styles/setup-style-field"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const ROW_HEIGHT = 60

type Venue = {
  id: string
  name: string
  description?: string | null
  capacity?: number | null
  status?: string | null
  daySchedule?: VenuePublicDayHours[]
}

type SelectedSlot = {
  venueId: string
  venueName: string
  date: Date
}

function formatHour(hour: number) {
  const ampm = hour >= 12 ? "PM" : "AM"
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:00 ${ampm}`
}

function formatMinutesLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const ampm = hours >= 12 ? "PM" : "AM"
  const display = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  return `${display}:${String(minutes).padStart(2, "0")} ${ampm}`
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
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function startOfLocalDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function buildDayTimeOptions(dayHours: VenuePublicDayHours | null): number[] {
  if (!dayHours?.open) return []
  const start = parseTimeToMinutes(dayHours.startTime) ?? 7 * 60
  const end = parseTimeToMinutes(dayHours.endTime) ?? 20 * 60
  const options: number[] = []
  for (let minutes = start; minutes <= end; minutes += 30) {
    options.push(minutes)
  }
  return options
}

function slotBoundsFromMinutes(date: Date, startMinutes: number, endMinutes: number) {
  const start = new Date(date)
  start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
  const end = new Date(date)
  end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  }
}

function blockCoversSlot(
  block: PublicAvailabilityBlock,
  venueId: string,
  date: Date,
  hour: number
) {
  if (block.venueId !== venueId) {
    return false
  }

  const { startAt, endAt } = slotBoundsFromMinutes(date, hour * 60, hour * 60 + 60)
  return new Date(block.startAt) < new Date(endAt) && new Date(block.endAt) > new Date(startAt)
}

function blockStartsAtSlot(
  block: PublicAvailabilityBlock,
  venueId: string,
  date: Date,
  hour: number
) {
  if (block.venueId !== venueId) {
    return false
  }

  const blockStart = new Date(block.startAt)
  return toDateKey(blockStart) === toDateKey(date) && blockStart.getHours() === hour
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0)
}

function addonUnitLabel(basis: ReturnType<typeof resolveVenueRentalAddonPricingBasis>) {
  switch (basis) {
    case "per_person":
      return "each"
    case "per_table":
      return "per table"
    default:
      return "flat"
  }
}

function rangeOverlapsBlocks(
  blocks: PublicAvailabilityBlock[],
  venueId: string,
  startAt: string,
  endAt: string
) {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  return blocks.some(
    (block) =>
      block.venueId === venueId &&
      new Date(block.startAt).getTime() < end &&
      new Date(block.endAt).getTime() > start
  )
}

export function CustomerVenueRentalCalendar({
  organizationName,
  venues,
  availabilityBlocks,
  eventTypes,
  addons,
  setupStyles,
  policiesDocumentUrl = null,
  policiesDocumentName = null,
  pricingGuideUrl = null,
  pricingGuideName = null,
  initialVenueId,
  dashboardHref = "/customer/rentals",
  showPageHeader = false,
}: {
  organizationName: string
  venues: Venue[]
  availabilityBlocks: PublicAvailabilityBlock[]
  eventTypes: Array<{ id: string; name: string }>
  addons: RentalAddonCatalogItem[]
  setupStyles: RoomSetupStyle[]
  policiesDocumentUrl?: string | null
  policiesDocumentName?: string | null
  pricingGuideUrl?: string | null
  pricingGuideName?: string | null
  initialVenueId?: string
  dashboardHref?: string
  showPageHeader?: boolean
}) {
  const router = useRouter()
  const filteredVenues = useMemo(() => {
    if (!initialVenueId) return venues
    const match = venues.find((venue) => venue.id === initialVenueId)
    return match ? [match] : venues
  }, [initialVenueId, venues])
  const [isPending, startTransition] = useTransition()
  const [currentDate, setCurrentDate] = useState(() => startOfLocalDay(new Date()))
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [dialogDatePickerOpen, setDialogDatePickerOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false)
  const [eventTypeId, setEventTypeId] = useState("")
  const [notes, setNotes] = useState("")
  const [expectedAttendance, setExpectedAttendance] = useState("")
  const [chairsPerTable, setChairsPerTable] = useState("")
  const [setupStyle, setSetupStyle] = useState("")
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set())
  const [policiesAcknowledged, setPoliciesAcknowledged] = useState(false)
  const [startMinutes, setStartMinutes] = useState(9 * 60)
  const [endMinutes, setEndMinutes] = useState(10 * 60)
  const [error, setError] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const hasPolicyDocuments = Boolean(
    policiesDocumentUrl?.trim() || pricingGuideUrl?.trim()
  )
  const hasBothPolicyDocuments = Boolean(
    policiesDocumentUrl?.trim() && pricingGuideUrl?.trim()
  )
  const hours = useMemo(() => {
    const dayHours = filteredVenues.map((venue) =>
      getVenueDayHoursForDate(venue.daySchedule, currentDate)
    )
    const { startHour, endHourInclusive } = resolveCalendarHourRange(dayHours)
    const result: number[] = []
    for (let hour = startHour; hour <= endHourInclusive; hour += 1) {
      result.push(hour)
    }
    return result
  }, [currentDate, filteredVenues])

  const selectedVenue = selectedSlot
    ? venues.find((venue) => venue.id === selectedSlot.venueId)
    : null
  const selectedDayHours = selectedSlot
    ? getVenueDayHoursForDate(selectedVenue?.daySchedule, selectedSlot.date)
    : null
  const timeOptions = useMemo(
    () => buildDayTimeOptions(selectedDayHours),
    [selectedDayHours]
  )
  const endTimeOptions = useMemo(
    () => timeOptions.filter((minutes) => minutes > startMinutes),
    [timeOptions, startMinutes]
  )

  const attendanceNumber = useMemo(() => {
    const parsed = Number.parseInt(expectedAttendance.trim(), 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }, [expectedAttendance])

  const chairsPerTableNumber = useMemo(() => {
    const parsed = Number.parseInt(chairsPerTable.trim(), 10)
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 0
  }, [chairsPerTable])

  const tableCount = useMemo(
    () =>
      attendanceNumber > 0 && chairsPerTableNumber > 0
        ? computeVenueRentalTableCount(attendanceNumber, chairsPerTableNumber)
        : 0,
    [attendanceNumber, chairsPerTableNumber]
  )

  const selectedAddonLines = useMemo(() => {
    return addons
      .filter((addon) => selectedAddonIds.has(addon.id))
      .map((addon) => {
        const basis = resolveVenueRentalAddonPricingBasis(addon)
        const quantity =
          attendanceNumber > 0 && chairsPerTableNumber > 0
            ? resolveVenueRentalAddonQuantity({
                slug: addon.slug,
                name: addon.name,
                expectedAttendance: attendanceNumber,
                chairsPerTable: chairsPerTableNumber,
              })
            : basis === "flat"
              ? 1
              : 0
        const lineTotal = Math.round(quantity * addon.defaultPrice * 100) / 100
        return { ...addon, basis, quantity, lineTotal }
      })
  }, [addons, selectedAddonIds, attendanceNumber, chairsPerTableNumber])

  const quotePreview = useMemo(() => {
    const currentSpace =
      selectedSlot && endMinutes > startMinutes
        ? {
            venueId: selectedSlot.venueId,
            ...slotBoundsFromMinutes(selectedSlot.date, startMinutes, endMinutes),
          }
        : null
    const finalSpaces = currentSpace ? [currentSpace] : []

    const rates = buildVenueRateLookup({
      venues: venues.map((venue) => ({
        id: venue.id,
        hourly_rate: 0,
        peak_hourly_rate: 0,
        base_price: 0,
        peak_flat_price: 0,
      })),
      dayPricing: venues.flatMap((venue) =>
        (venue.daySchedule || [])
          .filter((day) => day.open)
          .map((day) => ({
            venue_id: venue.id,
            day_of_week: day.dayOfWeek,
            hourly_price: Number(day.hourlyPrice || 0),
            flat_price: Number(day.flatPrice || 0),
            is_active: true,
          }))
      ),
    })

    return computeVenueRentalQuotedCharges(
      finalSpaces,
      selectedAddonLines.map((addon) => ({
        quantity: addon.quantity,
        unitPrice: addon.defaultPrice,
      })),
      rates
    )
  }, [selectedSlot, startMinutes, endMinutes, venues, selectedAddonLines])

  const canSubmitRequest = useMemo(() => {
    if (!selectedSlot || endMinutes <= startMinutes) return false
    if (!eventTypeId.trim()) return false
    if (attendanceNumber < 1) return false
    if (chairsPerTableNumber < 1) return false
    if (!setupStyle.trim()) return false
    if (hasPolicyDocuments && !policiesAcknowledged) return false
    return true
  }, [
    selectedSlot,
    startMinutes,
    endMinutes,
    eventTypeId,
    attendanceNumber,
    chairsPerTableNumber,
    setupStyle,
    hasPolicyDocuments,
    policiesAcknowledged,
  ])

  useEffect(() => {
    if (canSubmitRequest && error) {
      setError(null)
    }
  }, [canSubmitRequest, error])

  function onOpenBooking(venue: Venue, hour: number, date: Date) {
    if (venue.status === "closed" || venue.status === "inactive") {
      return
    }

    const dayHours = getVenueDayHoursForDate(venue.daySchedule, date)
    if (!isVenueHourBookable(dayHours, hour)) {
      return
    }

    const options = buildDayTimeOptions(dayHours)
    const clickedStart = hour * 60
    const nextStart = options.includes(clickedStart)
      ? clickedStart
      : (options.find((minutes) => minutes >= clickedStart) ?? options[0] ?? clickedStart)
    const defaultEnd = nextStart + 60
    const nextEnd = options.includes(defaultEnd)
      ? defaultEnd
      : (options.find((minutes) => minutes > nextStart) ?? defaultEnd)

    setSelectedSlot({
      venueId: venue.id,
      venueName: venue.name,
      date,
    })
    setStartMinutes(nextStart)
    setEndMinutes(nextEnd)
    setEventTypeId("")
    setNotes("")
    setExpectedAttendance("")
    setChairsPerTable("")
    setSetupStyle("")
    setSelectedAddonIds(new Set())
    setPoliciesAcknowledged(false)
    setError(null)
    setIsBookingDialogOpen(true)
  }

  function buildCurrentSpace(): RentalSpaceSlotInput | null {
    if (!selectedSlot) return null
    if (endMinutes <= startMinutes) return null
    const bounds = slotBoundsFromMinutes(selectedSlot.date, startMinutes, endMinutes)
    return {
      venueId: selectedSlot.venueId,
      startAt: bounds.startAt,
      endAt: bounds.endAt,
    }
  }

  function handleSubmitRequest() {
    const currentSpace = buildCurrentSpace()
    if (!currentSpace || !selectedSlot) {
      setError("Choose a valid start and end time.")
      return
    }

    if (
      rangeOverlapsBlocks(
        availabilityBlocks,
        selectedSlot.venueId,
        currentSpace.startAt,
        currentSpace.endAt
      )
    ) {
      setError("That time is no longer available.")
      return
    }

    const venue = venues.find((item) => item.id === selectedSlot.venueId)
    const dayHours = getVenueDayHoursForDate(venue?.daySchedule, selectedSlot.date)
    const startHour = Math.floor(startMinutes / 60)
    const endHourExclusive = Math.ceil(endMinutes / 60)
    for (let hour = startHour; hour < endHourExclusive; hour += 1) {
      if (!isVenueHourBookable(dayHours, hour)) {
        setError("That time extends past the space’s open hours.")
        return
      }
    }

    const finalSpaces = [currentSpace]

    const attendanceValue = expectedAttendance.trim()
      ? Number.parseInt(expectedAttendance.trim(), 10)
      : NaN
    const chairsValue = chairsPerTable.trim()
      ? Number.parseInt(chairsPerTable.trim(), 10)
      : NaN
    if (!Number.isFinite(attendanceValue) || attendanceValue < 1) {
      setError("Enter expected attendance.")
      return
    }
    if (!Number.isFinite(chairsValue) || chairsValue < 1) {
      setError("Enter how many chairs per table.")
      return
    }
    if (!setupStyle.trim()) {
      setError("Select a facility setup style.")
      return
    }
    if (!eventTypeId.trim()) {
      setError("Select an event type.")
      return
    }
    if (hasPolicyDocuments && !policiesAcknowledged) {
      setError(
        hasBothPolicyDocuments
          ? "Confirm you have read the policies and procedures and pricing guide."
          : "Confirm you have read the required documents before submitting."
      )
      return
    }

    if (!canSubmitRequest) {
      setError("Complete all required fields before submitting.")
      return
    }

    setError(null)

    startTransition(async () => {
      try {
        const rentalId = await submitVenueRentalRequest({
          venueRentalEventTypeId: eventTypeId || null,
          notes: notes.trim() || null,
          spaces: finalSpaces,
          addons: selectedAddonLines.map((addon) => ({
            rentalAddonId: addon.id,
            quantity: addon.quantity,
            unitPrice: addon.defaultPrice,
          })),
          operationalSetup: {
            expectedAttendance: attendanceValue,
            chairsPerTable: chairsValue,
            setupStyle: setupStyle.trim(),
          },
          policiesAcknowledged: hasPolicyDocuments ? policiesAcknowledged : true,
        })

        setSubmittedId(rentalId)
        setIsBookingDialogOpen(false)
        router.push(`/customer/rentals/${rentalId}`)
        router.refresh()
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to submit rental request."
        )
      }
    })
  }

  function shiftSelectedDate(deltaDays: number) {
    setCurrentDate((current) => {
      const next = new Date(current)
      next.setDate(next.getDate() + deltaDays)
      return startOfLocalDay(next)
    })
  }

  function updateSelectedSlotDate(date: Date) {
    const nextDate = startOfLocalDay(date)
    setSelectedSlot((current) =>
      current ? { ...current, date: nextDate } : current
    )
    setCurrentDate(nextDate)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {showPageHeader ? (
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Availability</h1>
            <p className="text-sm text-muted-foreground">{organizationName}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{organizationName}</p>
        )}
      </div>

      {submittedId ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-800">
            Your rental request was submitted and is awaiting supervisor approval.
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => router.push(`${dashboardHref}/${submittedId}`)}>
                View request
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSubmittedId(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => shiftSelectedDate(-1)}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex max-w-full items-center justify-center gap-2 rounded-md px-2 py-1 font-medium hover:bg-muted"
                  >
                    <span className="truncate">{formatDate(currentDate)}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => {
                      if (date) {
                        setCurrentDate(startOfLocalDay(date))
                        setDatePickerOpen(false)
                      }
                    }}
                    defaultMonth={currentDate}
                    initialFocus
                  />
                  <div className="border-t p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setCurrentDate(startOfLocalDay(new Date()))
                        setDatePickerOpen(false)
                      }}
                    >
                      Today
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Click an open time slot to request that space.
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => shiftSelectedDate(1)}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <DayView
            venues={filteredVenues}
            availabilityBlocks={availabilityBlocks}
            hours={hours}
            currentDate={currentDate}
            scrollRef={scrollContainerRef}
            onOpenBooking={onOpenBooking}
          />
        </CardContent>
      </Card>

      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="flex max-h-[min(90dvh,900px)] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Request Venue Rental</DialogTitle>
            <DialogDescription>
              Submit a request for supervisor approval. Payment is not collected yet.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {selectedSlot ? (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4" />
                    {selectedSlot.venueName}
                  </div>
                  <Popover open={dialogDatePickerOpen} onOpenChange={setDialogDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="mt-1 flex w-full items-center gap-2 rounded-md text-left text-muted-foreground hover:bg-muted/60"
                      >
                        <CalendarDays className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{formatDate(selectedSlot.date)}</span>
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedSlot.date}
                        onSelect={(date) => {
                          if (date) {
                            updateSelectedSlotDate(date)
                            setDialogDatePickerOpen(false)
                          }
                        }}
                        defaultMonth={selectedSlot.date}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatMinutesLabel(startMinutes)} – {formatMinutesLabel(endMinutes)}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>
                    Time <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select
                      value={String(startMinutes)}
                      onValueChange={(value) => {
                        const nextStart = Number(value)
                        setStartMinutes(nextStart)
                        if (endMinutes <= nextStart) {
                          const nextEnd =
                            timeOptions.find((minutes) => minutes > nextStart) ??
                            nextStart + 30
                          setEndMinutes(nextEnd)
                        }
                      }}
                    >
                      <SelectTrigger aria-label="Start time">
                        <SelectValue placeholder="From" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((minutes) => (
                          <SelectItem key={`start-${minutes}`} value={String(minutes)}>
                            From {formatMinutesLabel(minutes)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(endMinutes)}
                      onValueChange={(value) => setEndMinutes(Number(value))}
                    >
                      <SelectTrigger aria-label="End time">
                        <SelectValue placeholder="to" />
                      </SelectTrigger>
                      <SelectContent>
                        {endTimeOptions.map((minutes) => (
                          <SelectItem key={`end-${minutes}`} value={String(minutes)}>
                            to {formatMinutesLabel(minutes)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Facility setup</p>
                    <p className="text-xs text-muted-foreground">
                      Required so facilities staff can prepare the room.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="expected_attendance">
                        Expected attendance <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="expected_attendance"
                        type="number"
                        min={1}
                        value={expectedAttendance}
                        onChange={(event) => setExpectedAttendance(event.target.value)}
                        placeholder="100"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="chairs_per_table">
                        Chairs per table <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="chairs_per_table"
                        type="number"
                        min={1}
                        max={100}
                        value={chairsPerTable}
                        onChange={(event) => setChairsPerTable(event.target.value)}
                        placeholder="8"
                        required
                      />
                    </div>
                  </div>
                  {tableCount > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Tables needed:{" "}
                      <span className="font-medium text-foreground">{tableCount}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        (ceil({attendanceNumber} ÷ {chairsPerTableNumber}))
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Enter attendance and chairs per table to calculate how many tables you need.
                    </p>
                  )}
                  <SetupStyleField
                    value={setupStyle}
                    setupStyles={setupStyles}
                    onChange={setSetupStyle}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label>
                    Event type <span className="text-destructive">*</span>
                  </Label>
                  <Select value={eventTypeId} onValueChange={setEventTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      {eventTypes.map((eventType) => (
                        <SelectItem key={eventType.id} value={eventType.id}>
                          {eventType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {addons.length ? (
                  <div className="space-y-2">
                    <Label>Add-ons</Label>
                    <p className="text-xs text-muted-foreground">
                      Per-person items use attendance; table covers use the table count above.
                    </p>
                    {addons.map((addon) => {
                      const basis = resolveVenueRentalAddonPricingBasis(addon)
                      const selectedLine = selectedAddonLines.find((line) => line.id === addon.id)
                      return (
                        <label key={addon.id} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={selectedAddonIds.has(addon.id)}
                            onCheckedChange={(checked) => {
                              setSelectedAddonIds((current) => {
                                const next = new Set(current)
                                if (checked) {
                                  next.add(addon.id)
                                } else {
                                  next.delete(addon.id)
                                }
                                return next
                              })
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{addon.name}</span>
                            {addon.defaultPrice > 0 ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · {formatMoney(addon.defaultPrice)} {addonUnitLabel(basis)}
                              </span>
                            ) : null}
                            {selectedLine && selectedLine.quantity > 0 ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {selectedLine.quantity} × {formatMoney(addon.defaultPrice)} ={" "}
                                {formatMoney(selectedLine.lineTotal)}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Tell us about your event..."
                    rows={3}
                  />
                </div>

                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-sm font-medium">Total charges</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estimated amount due after your request is approved (before any staff
                    discounts).
                  </p>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Space fee</span>
                      <span>{formatMoney(quotePreview.spaceFee)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Add-ons</span>
                      <span>{formatMoney(quotePreview.addonFees)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t pt-2 font-semibold">
                      <span>Total</span>
                      <span>{formatMoney(quotePreview.totalCharges)}</span>
                    </div>
                  </div>
                </div>

                {hasPolicyDocuments ? (
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                    <div>
                      <p className="text-sm font-medium">Policies & pricing</p>
                      <p className="text-xs text-muted-foreground">
                        Open and review these documents before submitting your request.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 text-sm">
                      {policiesDocumentUrl ? (
                        <a
                          href={policiesDocumentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          {policiesDocumentName?.trim() || "Policies & procedures"}
                        </a>
                      ) : null}
                      {pricingGuideUrl ? (
                        <a
                          href={pricingGuideUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          {pricingGuideName?.trim() || "Pricing guide"}
                        </a>
                      ) : null}
                    </div>
                    <label className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={policiesAcknowledged}
                        onCheckedChange={(checked) =>
                          setPoliciesAcknowledged(Boolean(checked))
                        }
                        className="mt-0.5"
                      />
                      <span>
                        I have read the{" "}
                        {hasBothPolicyDocuments
                          ? "policies and procedures and pricing guide"
                          : policiesDocumentUrl
                            ? "policies and procedures"
                            : "pricing guide"}
                        .
                        <span className="text-destructive"> *</span>
                      </span>
                    </label>
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending || !canSubmitRequest}
              onClick={handleSubmitRequest}
            >
              {isPending ? "Submitting..." : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DayView({
  venues,
  availabilityBlocks,
  hours,
  currentDate,
  scrollRef,
  onOpenBooking,
}: {
  venues: Venue[]
  availabilityBlocks: PublicAvailabilityBlock[]
  hours: number[]
  currentDate: Date
  scrollRef: React.RefObject<HTMLDivElement | null>
  onOpenBooking: (venue: Venue, hour: number, date: Date) => void
}) {
  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div
        className="grid min-w-[700px]"
        style={{
          gridTemplateColumns: `70px repeat(${Math.max(venues.length, 1)}, minmax(140px, 1fr))`,
        }}
      >
        <div className="sticky top-0 z-10 border-b border-r border-border bg-muted/50 p-2" />
        {venues.length === 0 ? (
          <div className="sticky top-0 z-10 border-b border-border bg-muted/50 px-2 py-3 text-center text-xs font-semibold">
            No spaces
          </div>
        ) : (
          venues.map((venue) => (
            <div
              key={venue.id}
              className="sticky top-0 z-10 border-b border-r border-border bg-muted/50 px-2 py-3 text-center text-xs font-semibold last:border-r-0"
            >
              {venue.name}
            </div>
          ))
        )}

        {venues.length === 0 ? (
          <div className="col-span-2 border-b border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No bookable spaces are available right now.
          </div>
        ) : hours.length === 0 ? (
          <div className="col-span-full border-b border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No spaces are open on this day.
          </div>
        ) : (
          hours.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-b border-r border-border px-2 py-3 text-xs text-muted-foreground">
                {formatHour(hour)}
              </div>
              {venues.map((venue) => {
                const statusClosed =
                  venue.status === "closed" || venue.status === "inactive"
                const dayHours = getVenueDayHoursForDate(venue.daySchedule, currentDate)
                const outsideHours = !isVenueHourBookable(dayHours, hour)
                const isClosed = statusClosed || outsideHours
                const startingBlock = availabilityBlocks.find((block) =>
                  blockStartsAtSlot(block, venue.id, currentDate, hour)
                )
                const isBlocked = availabilityBlocks.some((block) =>
                  blockCoversSlot(block, venue.id, currentDate, hour)
                )
                const canBook = !isClosed && !isBlocked

                return (
                  <div
                    key={`${hour}-${venue.id}`}
                    className={cn(
                      "relative border-b border-r border-border last:border-r-0",
                      canBook && "cursor-pointer hover:bg-primary/5"
                    )}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => {
                      if (canBook) {
                        onOpenBooking(venue, hour, currentDate)
                      }
                    }}
                  >
                    {isClosed ? (
                      <div className="absolute inset-x-1 top-1 rounded-md border border-gray-300 bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                        {statusClosed
                          ? "Closed"
                          : dayHours && !dayHours.open
                            ? "Closed"
                            : "Outside hours"}
                      </div>
                    ) : startingBlock ? (
                      <div
                        className="absolute inset-x-1 top-1 z-[5] overflow-hidden rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 shadow-sm"
                        style={{
                          height: `${Math.max(
                            ((new Date(startingBlock.endAt).getHours() || hour + 1) - hour) *
                              ROW_HEIGHT -
                              8,
                            ROW_HEIGHT - 8
                          )}px`,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          <span className="truncate">Unavailable</span>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100">
                        <Plus className="h-5 w-5 text-primary/50" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
