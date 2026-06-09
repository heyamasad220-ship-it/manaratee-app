"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react"

import { submitVenueRentalRequest } from "@/lib/bookings/venue-rental-actions"
import type {
  PublicAvailabilityBlock,
  RentalAddonCatalogItem,
  RentalSpaceSlotInput,
} from "@/lib/bookings/venue-rental-types"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

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

function slotBounds(date: Date, hour: number, durationHours = 1) {
  const start = new Date(date)
  start.setHours(hour, 0, 0, 0)
  const end = new Date(start)
  end.setHours(start.getHours() + durationHours, 0, 0, 0)
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

  const { startAt, endAt } = slotBounds(date, hour)
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
  return (
    blockStart.toISOString().slice(0, 10) === toDateKey(date) &&
    blockStart.getHours() === hour
  )
}

export function CustomerVenueRentalCalendar({
  organizationName,
  venues,
  availabilityBlocks,
  eventTypes,
  addons,
  initialVenueId,
  dashboardHref = "/customer/rentals",
  showPageHeader = false,
}: {
  organizationName: string
  venues: Venue[]
  availabilityBlocks: PublicAvailabilityBlock[]
  eventTypes: Array<{ id: string; name: string }>
  addons: RentalAddonCatalogItem[]
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
  const [activeView, setActiveView] = useState<ViewMode>("Day")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false)
  const [spaces, setSpaces] = useState<RentalSpaceSlotInput[]>([])
  const [eventTypeId, setEventTypeId] = useState("")
  const [notes, setNotes] = useState("")
  const [expectedAttendance, setExpectedAttendance] = useState("")
  const [setupStyle, setSetupStyle] = useState("")
  const [equipmentNotes, setEquipmentNotes] = useState("")
  const [primaryContactPhone, setPrimaryContactPhone] = useState("")
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set())
  const [durationHours, setDurationHours] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const hours = useMemo(() => {
    const result: number[] = []
    for (let hour = HOURS_START; hour <= HOURS_END; hour += 1) {
      result.push(hour)
    }
    return result
  }, [])

  const weekDays = useMemo(() => {
    const start = getWeekStart(currentDate)
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [currentDate])

  function onOpenBooking(venue: Venue, hour: number, date: Date) {
    if (venue.status === "closed" || venue.status === "inactive") {
      return
    }

    setSelectedSlot({
      venueId: venue.id,
      venueName: venue.name,
      hour,
      date,
    })
    setDurationHours(1)
    setEventTypeId("")
    setNotes("")
    setSelectedAddonIds(new Set())
    setSpaces([])
    setError(null)
    setIsBookingDialogOpen(true)
  }

  function addCurrentSlotToRequest() {
    if (!selectedSlot) {
      return
    }

    const bounds = slotBounds(selectedSlot.date, selectedSlot.hour, durationHours)
    const nextSpace: RentalSpaceSlotInput = {
      venueId: selectedSlot.venueId,
      startAt: bounds.startAt,
      endAt: bounds.endAt,
    }

    const overlapsExisting = spaces.some(
      (space) =>
        space.venueId === nextSpace.venueId &&
        new Date(space.startAt) < new Date(nextSpace.endAt) &&
        new Date(space.endAt) > new Date(nextSpace.startAt)
    )

    if (overlapsExisting) {
      setError("That space and time is already in your request.")
      return
    }

    const blocked = availabilityBlocks.some((block) => {
      const startHour = selectedSlot.hour
      for (let hour = startHour; hour < startHour + durationHours; hour += 1) {
        if (blockCoversSlot(block, selectedSlot.venueId, selectedSlot.date, hour)) {
          return true
        }
      }
      return false
    })

    if (blocked) {
      setError("That time is no longer available.")
      return
    }

    setSpaces((current) => [...current, nextSpace])
    setError(null)
  }

  function handleSubmitRequest() {
    let finalSpaces = [...spaces]

    if (!finalSpaces.length && selectedSlot) {
      const bounds = slotBounds(selectedSlot.date, selectedSlot.hour, durationHours)
      finalSpaces = [
        {
          venueId: selectedSlot.venueId,
          startAt: bounds.startAt,
          endAt: bounds.endAt,
        },
      ]
    }

    if (!finalSpaces.length) {
      setError("Add at least one space and time.")
      return
    }

    setError(null)

    startTransition(async () => {
      try {
        const rentalId = await submitVenueRentalRequest({
          venueRentalEventTypeId: eventTypeId || null,
          notes: notes.trim() || null,
          spaces: finalSpaces,
          addons: Array.from(selectedAddonIds).map((rentalAddonId) => ({
            rentalAddonId,
            quantity: 1,
          })),
          operationalSetup: {
            expectedAttendance: expectedAttendance
              ? Number.parseInt(expectedAttendance, 10)
              : null,
            setupStyle: setupStyle.trim() || null,
            equipmentNotes: equipmentNotes.trim() || null,
            primaryContactPhone: primaryContactPhone.trim() || null,
          },
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
        <div className="flex items-center gap-2">
          {viewModes.map((mode) => (
            <Button
              key={mode}
              variant={activeView === mode ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveView(mode)}
            >
              {mode}
            </Button>
          ))}
        </div>
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
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const next = new Date(currentDate)
                next.setDate(next.getDate() + (activeView === "Week" ? -7 : -1))
                setCurrentDate(next)
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="font-medium">{formatDate(currentDate)}</p>
              <p className="text-xs text-muted-foreground">
                Unavailable slots are blocked. No event details are shown.
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const next = new Date(currentDate)
                next.setDate(next.getDate() + (activeView === "Week" ? 7 : 1))
                setCurrentDate(next)
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {activeView === "Day" ? (
            <DayView
              venues={filteredVenues}
              availabilityBlocks={availabilityBlocks}
              hours={hours}
              currentDate={currentDate}
              scrollRef={scrollContainerRef}
              onOpenBooking={onOpenBooking}
            />
          ) : (
            <WeekView
              venues={filteredVenues}
              availabilityBlocks={availabilityBlocks}
              weekDays={weekDays}
              scrollRef={scrollContainerRef}
              onOpenBooking={onOpenBooking}
            />
          )}
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
                <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(selectedSlot.date)}
                </div>
                <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {formatHour(selectedSlot.hour)} – {formatHour(selectedSlot.hour + durationHours)}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="duration">Duration (hours)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={8}
                  value={durationHours}
                  onChange={(event) => setDurationHours(Number(event.target.value) || 1)}
                />
              </div>

              <Button type="button" variant="outline" onClick={addCurrentSlotToRequest}>
                Add this space/time to request
              </Button>

              {spaces.length ? (
                <div className="space-y-2">
                  <Label>Selected spaces</Label>
                  {spaces.map((space, index) => {
                    const venue = venues.find((item) => item.id === space.venueId)
                    return (
                      <div
                        key={`${space.venueId}-${space.startAt}-${index}`}
                        className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                      >
                        <span>
                          {venue?.name || "Space"} · {new Date(space.startAt).toLocaleString()} –{" "}
                          {new Date(space.endAt).toLocaleTimeString()}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setSpaces((current) => current.filter((_, itemIndex) => itemIndex !== index))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label>Event type</Label>
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
                  {addons.map((addon) => (
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
                      <span>
                        {addon.name}
                        {addon.defaultPrice > 0 ? ` · $${addon.defaultPrice.toFixed(2)}` : ""}
                      </span>
                    </label>
                  ))}
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

              <details className="rounded-lg border px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">
                  Facility setup details (optional)
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="expected_attendance">Expected attendance</Label>
                      <Input
                        id="expected_attendance"
                        type="number"
                        min={1}
                        value={expectedAttendance}
                        onChange={(event) => setExpectedAttendance(event.target.value)}
                        placeholder="120"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="setup_style">Setup style</Label>
                      <Input
                        id="setup_style"
                        value={setupStyle}
                        onChange={(event) => setSetupStyle(event.target.value)}
                        placeholder="Banquet, theater, classroom..."
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="equipment_notes">Equipment / AV needs</Label>
                    <Textarea
                      id="equipment_notes"
                      value={equipmentNotes}
                      onChange={(event) => setEquipmentNotes(event.target.value)}
                      placeholder="Projector, microphones, stage..."
                      rows={2}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="primary_contact_phone">Contact phone</Label>
                    <Input
                      id="primary_contact_phone"
                      value={primaryContactPhone}
                      onChange={(event) => setPrimaryContactPhone(event.target.value)}
                      placeholder="Best number for day-of coordination"
                    />
                  </div>
                </div>
              </details>

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
            <Button disabled={isPending} onClick={handleSubmitRequest}>
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
        style={{ gridTemplateColumns: `70px repeat(${venues.length}, minmax(140px, 1fr))` }}
      >
        <div className="sticky top-0 z-10 border-b border-r border-border bg-muted/50 p-2" />
        {venues.map((venue) => (
          <div
            key={venue.id}
            className="sticky top-0 z-10 border-b border-r border-border bg-muted/50 px-2 py-3 text-center text-xs font-semibold last:border-r-0"
          >
            {venue.name}
          </div>
        ))}

        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div className="border-b border-r border-border px-2 py-3 text-xs text-muted-foreground">
              {formatHour(hour)}
            </div>
            {venues.map((venue) => {
              const isClosed = venue.status === "closed" || venue.status === "inactive"
              const startingBlock = availabilityBlocks.find((block) =>
                blockStartsAtSlot(block, venue.id, currentDate, hour)
              )
              const isBlocked = availabilityBlocks.some((block) =>
                blockCoversSlot(block, venue.id, currentDate, hour)
              )

              return (
                <div
                  key={`${hour}-${venue.id}`}
                  className={cn(
                    "relative border-b border-r border-border last:border-r-0",
                    !isBlocked && !isClosed && "cursor-pointer hover:bg-primary/5"
                  )}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => {
                    if (!isBlocked && !isClosed) {
                      onOpenBooking(venue, hour, currentDate)
                    }
                  }}
                >
                  {isClosed ? (
                    <div className="absolute inset-x-1 top-1 rounded-md border border-gray-300 bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                      Closed
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
                  ) : !isBlocked ? (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100">
                      <Plus className="h-5 w-5 text-primary/50" />
                    </div>
                  ) : null}
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
  availabilityBlocks,
  weekDays,
  scrollRef,
  onOpenBooking,
}: {
  venues: Venue[]
  availabilityBlocks: PublicAvailabilityBlock[]
  weekDays: Date[]
  scrollRef: React.RefObject<HTMLDivElement | null>
  onOpenBooking: (venue: Venue, hour: number, date: Date) => void
}) {
  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div
        className="grid min-w-[700px]"
        style={{ gridTemplateColumns: `70px repeat(${venues.length}, minmax(140px, 1fr))` }}
      >
        <div className="sticky top-0 z-10 border-b border-r border-border bg-muted/50 p-2" />
        {venues.map((venue) => (
          <div
            key={venue.id}
            className="sticky top-0 z-10 border-b border-r border-border bg-muted/50 px-2 py-3 text-center text-xs font-semibold last:border-r-0"
          >
            {venue.name}
          </div>
        ))}

        {weekDays.map((day) => {
          const dayKey = toDateKey(day)
          return (
            <div key={dayKey} className="contents">
              <div className="border-b border-r border-border px-2 py-3 text-xs">
                <div className="font-semibold text-primary">{day.getDate()}</div>
                <div>{DAY_LABELS[day.getDay()]}</div>
              </div>
              {venues.map((venue) => {
                const isClosed = venue.status === "closed" || venue.status === "inactive"
                const hasBlock = availabilityBlocks.some(
                  (block) =>
                    block.venueId === venue.id &&
                    block.startAt.slice(0, 10) <= dayKey &&
                    block.endAt.slice(0, 10) >= dayKey
                )

                return (
                  <div
                    key={`${dayKey}-${venue.id}`}
                    className={cn(
                      "min-h-[80px] border-b border-r border-border px-2 py-2 last:border-r-0",
                      !hasBlock && !isClosed && "cursor-pointer hover:bg-primary/5"
                    )}
                    onClick={() => {
                      if (!hasBlock && !isClosed) {
                        onOpenBooking(venue, 9, day)
                      }
                    }}
                  >
                    {isClosed ? (
                      <span className="text-xs text-gray-500">Closed</span>
                    ) : hasBlock ? (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                        <Lock className="h-3 w-3" /> Unavailable
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-700">Available</span>
                    )}
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
