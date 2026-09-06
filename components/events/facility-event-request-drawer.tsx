"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format, isValid, parseISO } from "date-fns"
import {
  Building2,
  Calendar as CalendarIcon,
  ChevronDown,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toDatetimeLocalValue } from "@/components/ui/datetime-input"
import {
  formatTimeDisplay,
  from12HourParts,
  toTime24,
} from "@/components/ui/time-picker"
import { FacilityVenueMultiSelect } from "@/components/reservations/facility-venue-multi-select"
import { SetupStyleField } from "@/components/setup-styles/setup-style-field"
import { cn } from "@/lib/utils"

import {
  INTERNAL_EVENT_LOCATION_TYPE_LABELS,
  INTERNAL_EVENT_LOCATION_TYPES,
  type InternalEventLocationType,
} from "@/lib/events/internal-event-location"
import {
  formatEventRecurrenceSummary,
  type EventRecurrenceConfig,
  type EventRecurrenceFrequency,
} from "@/lib/events/event-recurrence"
import { submitInternalEventRequest, updateInternalEvent } from "@/lib/events/internal-event-actions"
import {
  getFacilityEventEditPayload,
  type FacilityEventEditPayload,
} from "@/lib/events/facility-event-edit-payload"
import type { RoomSetupStyle } from "@/lib/setup-styles/setup-style-types"
import {
  buildFacilitiesCalendarHref,
  VIEW_FACILITY_CALENDAR_CTA_LABEL,
} from "@/lib/events/facility-event-request-href"

export type FacilityEventRequestDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  departments: { id: string; name: string }[]
  eventTypes: { id: string; name: string }[]
  venues: { id: string; name: string }[]
  setupStyles: RoomSetupStyle[]
  canManageSetupStyles?: boolean
  defaults?: {
    departmentId?: string | null
    user?: { id: string; name: string } | null
  }
  lockDepartment?: boolean
  initialSlot?: {
    venueId?: string
    startAt?: string
    endAt?: string
  } | null
  /** When set, drawer loads this event for editing. */
  editEventId?: string | null
  /** After success: call this (parent may router.refresh / redirect). Receives primary event id. */
  onSubmitted?: (eventId: string) => void
  /** Prefer "member-staff" for customer portal — still calls same submit. */
  requestOrigin?: "staff-dashboard" | "member-staff"
  /**
   * `calendar-link`: no room picker on create; staff check Facilities then come back.
   * `select`: pick rooms in this drawer (Facilities calendar / edit).
   */
  spaceMode?: "select" | "calendar-link"
  linkedCampaignId?: string | null
  approvalRequired?: boolean
  calendarReturnTo?: string | null
  calendarDepartmentId?: string | null
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const LOCATION_OPTIONS: { value: InternalEventLocationType; icon: LucideIcon }[] = [
  { value: INTERNAL_EVENT_LOCATION_TYPES.facility, icon: Building2 },
  { value: INTERNAL_EVENT_LOCATION_TYPES.online, icon: Globe },
  { value: INTERNAL_EVENT_LOCATION_TYPES.external, icon: MapPin },
]

const TIME_OPTIONS: string[] = (() => {
  const options: string[] = []
  for (let hour = 6; hour <= 23; hour += 1) {
    for (const minute of [0, 30]) {
      options.push(formatTimeDisplay(toTime24(hour, minute)))
    }
  }
  return options
})()

function parseTime12Label(label: string): string | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label.trim())
  if (!match) return null
  const hour12 = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  const period = match[3].toUpperCase() as "AM" | "PM"
  if (hour12 < 1 || hour12 > 12 || minutes < 0 || minutes > 59) return null
  return toTime24(from12HourParts(hour12, period), minutes)
}

function snapToTimeOption(time24: string): string {
  const label = formatTimeDisplay(time24)
  if (TIME_OPTIONS.includes(label)) return label
  const { hours24, minutes } = (() => {
    const [h, m] = time24.split(":").map((part) => Number.parseInt(part, 10))
    return { hours24: h || 0, minutes: m || 0 }
  })()
  const snapped = minutes < 15 ? 0 : minutes < 45 ? 30 : 0
  const hour = minutes >= 45 ? (hours24 + 1) % 24 : hours24
  const next = formatTimeDisplay(toTime24(hour, snapped))
  return TIME_OPTIONS.includes(next) ? next : TIME_OPTIONS[6] || "9:00 AM"
}

function combineDateAndTime(dateKey: string, time12: string): string {
  const time24 = parseTime12Label(time12)
  if (!dateKey || !time24) return ""
  return `${dateKey}T${time24}`
}

function formatLongDateLabel(dateKey: string): string {
  if (!dateKey) return ""
  const parsed = parseISO(`${dateKey}T12:00:00`)
  if (!isValid(parsed)) return ""
  return format(parsed, "EEEE, MMMM d, yyyy")
}

function nextHalfHourLabel(time12: string): string {
  const time24 = parseTime12Label(time12)
  if (!time24) return TIME_OPTIONS[7] || "9:30 AM"
  const [h, m] = time24.split(":").map((part) => Number.parseInt(part, 10))
  const total = (h || 0) * 60 + (m || 0) + 30
  const next = formatTimeDisplay(toTime24(Math.floor(total / 60) % 24, total % 60))
  return TIME_OPTIONS.includes(next) ? next : time12
}

function slotPartsFromIso(value?: string) {
  if (!value) {
    return { dateKey: "", time12: "" }
  }
  const local = toDatetimeLocalValue(value)
  if (!local.includes("T")) {
    return { dateKey: "", time12: "" }
  }
  const [dateKey, timePart] = local.split("T")
  return {
    dateKey: dateKey || "",
    time12: snapToTimeOption((timePart || "09:00").slice(0, 5)),
  }
}

export function FacilityEventRequestDrawer({
  open,
  onOpenChange,
  departments,
  eventTypes,
  venues,
  setupStyles,
  canManageSetupStyles = false,
  defaults,
  lockDepartment = false,
  initialSlot,
  editEventId = null,
  onSubmitted,
  requestOrigin = "staff-dashboard",
  spaceMode = "select",
  linkedCampaignId = null,
  approvalRequired = false,
  calendarReturnTo = null,
  calendarDepartmentId = null,
}: FacilityEventRequestDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [canEditLoaded, setCanEditLoaded] = useState(true)
  const [editStatus, setEditStatus] = useState<string | null>(null)

  const [locationType, setLocationTypeState] = useState<InternalEventLocationType>(
    INTERNAL_EVENT_LOCATION_TYPES.facility
  )
  const [departmentId, setDepartmentId] = useState("")
  const [eventTypeId, setEventTypeId] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const [venueIds, setVenueIds] = useState<string[]>([])
  const [expectedAttendance, setExpectedAttendance] = useState("")
  const [setupStyle, setSetupStyle] = useState("")
  const [roomSetupNotes, setRoomSetupNotes] = useState("")

  const [externalVenueName, setExternalVenueName] = useState("")
  const [externalAddress, setExternalAddress] = useState("")
  const [meetingUrl, setMeetingUrl] = useState("")

  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<EventRecurrenceFrequency>("weekly")
  const [interval, setIntervalValue] = useState(1)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [endType, setEndType] = useState<"date" | "count">("count")
  const [endDate, setEndDate] = useState("")
  const [endCount, setEndCount] = useState(10)
  const [exceptions, setExceptions] = useState<string[]>([])
  const [exceptionDraft, setExceptionDraft] = useState("")

  const wasOpenRef = useRef(false)

  function applyCreateDefaults() {
    const startParts = slotPartsFromIso(initialSlot?.startAt)
    const endParts = slotPartsFromIso(initialSlot?.endAt)
    const hasSlotTimes = Boolean(initialSlot?.startAt || initialSlot?.endAt)
    const resolvedStart = startParts.time12 || "9:00 AM"
    const resolvedEnd = endParts.time12 || nextHalfHourLabel(resolvedStart)

    setEditingEventId(null)
    setCanEditLoaded(true)
    setEditStatus(null)
    setError(null)
    setName("")
    setDescription("")
    setDepartmentId(defaults?.departmentId || "")
    setEventTypeId(eventTypes[0]?.id || "")
    setLocationTypeState(INTERNAL_EVENT_LOCATION_TYPES.facility)
    setVenueIds(initialSlot?.venueId ? [initialSlot.venueId] : [])
    setEventDate(startParts.dateKey || endParts.dateKey || "")
    setStartTime(hasSlotTimes ? resolvedStart : "")
    setEndTime(hasSlotTimes ? resolvedEnd : "")
    setDatePickerOpen(false)
    setExpectedAttendance("")
    setSetupStyle("")
    setRoomSetupNotes("")
    setExternalVenueName("")
    setExternalAddress("")
    setMeetingUrl("")
    setIsRecurring(false)
    setFrequency("weekly")
    setIntervalValue(1)
    setWeekdays([])
    setEndType("count")
    setEndDate("")
    setEndCount(10)
    setExceptions([])
    setExceptionDraft("")
  }

  function applyEditPayload(payload: FacilityEventEditPayload) {
    const startParts = slotPartsFromIso(payload.startAt || undefined)
    const endParts = slotPartsFromIso(payload.endAt || undefined)
    const resolvedStart = startParts.time12 || "9:00 AM"
    const resolvedEnd = endParts.time12 || nextHalfHourLabel(resolvedStart)

    setEditingEventId(payload.id)
    setCanEditLoaded(payload.canEdit)
    setEditStatus(payload.status)
    setError(
      payload.canEdit
        ? null
        : "You can view this event but do not have permission to save changes."
    )
    setName(payload.name)
    setDescription(payload.description)
    setDepartmentId(payload.departmentId)
    setEventTypeId(payload.eventTypeId)
    setLocationTypeState(payload.locationType)
    setVenueIds(payload.venueIds)
    setEventDate(startParts.dateKey || endParts.dateKey || "")
    setStartTime(payload.startAt ? resolvedStart : "")
    setEndTime(payload.endAt ? resolvedEnd : "")
    setDatePickerOpen(false)
    setExpectedAttendance(payload.expectedAttendance)
    setSetupStyle(payload.setupStyle)
    setRoomSetupNotes(payload.roomSetupNotes)
    setExternalVenueName(
      payload.locationType === "external" ? payload.locationLabel : ""
    )
    setExternalAddress(
      payload.locationType === "external" ? payload.locationAddress : ""
    )
    setMeetingUrl(
      payload.locationType === "online" ? payload.locationAddress : ""
    )
    const recurrence = payload.recurrence
    setIsRecurring(Boolean(recurrence?.enabled))
    if (recurrence?.enabled) {
      setFrequency(recurrence.frequency)
      setIntervalValue(recurrence.interval)
      setWeekdays(recurrence.weekdays || [])
      setEndType(recurrence.endType)
      setEndDate(recurrence.endDate || "")
      setEndCount(recurrence.endCount || 10)
      setExceptions(recurrence.exceptions || [])
    } else {
      setFrequency("weekly")
      setIntervalValue(1)
      setWeekdays([])
      setEndType("count")
      setEndDate("")
      setEndCount(10)
      setExceptions([])
    }
    setExceptionDraft("")
  }

  // Reset / load each time the drawer transitions from closed -> open.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      if (editEventId) {
        setLoadingEdit(true)
        setError(null)
        void getFacilityEventEditPayload(editEventId)
          .then((payload) => {
            if (!payload) {
              setError("Event not found.")
              applyCreateDefaults()
              return
            }
            applyEditPayload(payload)
          })
          .catch(() => {
            setError("Failed to load event.")
            applyCreateDefaults()
          })
          .finally(() => setLoadingEdit(false))
      } else {
        applyCreateDefaults()
      }
    }
    wasOpenRef.current = open
  }, [open, defaults, eventTypes, initialSlot, editEventId])

  const isEditMode = Boolean(editingEventId)

  function setLocationType(next: InternalEventLocationType) {
    setLocationTypeState(next)
    if (next !== INTERNAL_EVENT_LOCATION_TYPES.facility) {
      setVenueIds([])
    }
    if (next !== INTERNAL_EVENT_LOCATION_TYPES.external) {
      setExternalVenueName("")
      setExternalAddress("")
    }
    if (next !== INTERNAL_EVENT_LOCATION_TYPES.online) {
      setMeetingUrl("")
    }
  }

  function toggleWeekday(day: number) {
    setWeekdays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    )
  }

  function addException() {
    if (exceptionDraft && !exceptions.includes(exceptionDraft)) {
      setExceptions((prev) => [...prev, exceptionDraft].sort())
    }
    setExceptionDraft("")
  }

  function removeException(date: string) {
    setExceptions((prev) => prev.filter((d) => d !== date))
  }

  const startAt = useMemo(
    () => combineDateAndTime(eventDate, startTime),
    [eventDate, startTime]
  )
  const endAt = useMemo(
    () => combineDateAndTime(eventDate, endTime),
    [eventDate, endTime]
  )

  const selectedDate = useMemo(() => {
    if (!eventDate) return undefined
    const parsed = parseISO(`${eventDate}T12:00:00`)
    return isValid(parsed) ? parsed : undefined
  }, [eventDate])

  const dateDisplay = formatLongDateLabel(eventDate)

  const recurrenceConfig: EventRecurrenceConfig | null = isRecurring
    ? {
        enabled: true,
        frequency,
        interval,
        weekdays: frequency === "weekly" ? weekdays : undefined,
        endType,
        endDate: endType === "date" ? endDate || null : null,
        endCount: endType === "count" ? endCount : null,
        exceptions,
      }
    : null

  const recurrenceSummary = (() => {
    if (!isRecurring || !startAt || !endAt) return null
    try {
      return formatEventRecurrenceSummary(
        new Date(startAt),
        new Date(endAt),
        recurrenceConfig
      )
    } catch {
      return null
    }
  })()

  const isFacility = locationType === INTERNAL_EVENT_LOCATION_TYPES.facility
  const isExternal = locationType === INTERNAL_EVENT_LOCATION_TYPES.external
  const isOnline = locationType === INTERNAL_EVENT_LOCATION_TYPES.online

  const prefilledDepartment =
    defaults?.departmentId &&
    departments.find((department) => department.id === defaults.departmentId)
  const showLockedDepartment = Boolean(lockDepartment && prefilledDepartment)

  function handleStartTimeChange(next: string) {
    setStartTime(next)
    if (!endTime || (parseTime12Label(endTime) || "") <= (parseTime12Label(next) || "")) {
      setEndTime(nextHalfHourLabel(next))
    }
  }

  function handleDateSelect(date: Date | undefined) {
    if (!date) {
      setEventDate("")
      return
    }
    setEventDate(format(date, "yyyy-MM-dd"))
    setDatePickerOpen(false)
  }

  function validate(): string | null {
    if (!eventDate) return "Date is required."
    if (!startTime || !endTime) return "Start and end times are required."
    if (!startAt || !endAt) return "Start and end times are required."
    if (new Date(startAt) >= new Date(endAt)) {
      return "End time must be after start time."
    }
    if (!name.trim()) return "Event name is required."
    if (!departmentId) return "Department is required."
    if (!eventTypeId) return "Event type is required."
    if (
      isFacility &&
      spaceMode === "select" &&
      !isEditMode &&
      venueIds.length === 0
    ) {
      return "Select at least one venue."
    }
    if (isExternal) {
      if (!externalVenueName.trim()) return "External venue name is required."
      if (!externalAddress.trim()) return "External venue address is required."
    }
    if (isOnline && meetingUrl.trim()) {
      try {
        const parsed = new URL(meetingUrl.trim())
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return "Meeting link must start with http:// or https://."
        }
      } catch {
        return "Meeting link must be a valid URL."
      }
    }
    if (isRecurring && frequency === "weekly" && weekdays.length === 0) {
      return "Select at least one weekday for weekly recurrence."
    }
    if (isRecurring && endType === "date" && !endDate) {
      return "Choose an end date for the recurring series."
    }
    return null
  }

  function handleSubmit() {
    if (isEditMode && !canEditLoaded) {
      setError("You do not have permission to save changes.")
      return
    }

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      queueMicrotask(() =>
        errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      )
      return
    }
    setError(null)
    setIsSubmitting(true)

    void (async () => {
      try {
        const basePayload = {
          name,
          description,
          department_id: departmentId,
          event_type_id: eventTypeId,
          start_at: startAt || null,
          end_at: endAt || null,
          location_type: locationType,
          venue_ids: isFacility ? venueIds : [],
          location_label: isExternal ? externalVenueName : null,
          location_address: isExternal
            ? externalAddress
            : isOnline
              ? meetingUrl.trim() || null
              : null,
          operationalSetup: isFacility
            ? {
                expectedAttendance: expectedAttendance
                  ? Number.parseInt(expectedAttendance, 10)
                  : null,
                setupStyle: setupStyle || null,
                roomSetupNotes: roomSetupNotes || null,
              }
            : undefined,
        }

        let eventId: string
        if (isEditMode && editingEventId) {
          await updateInternalEvent({
            id: editingEventId,
            ...basePayload,
            status: (editStatus as never) || undefined,
          })
          eventId = editingEventId
        } else {
          eventId = await submitInternalEventRequest({
            ...basePayload,
            recurrence_config: recurrenceConfig,
            linkedCampaignId,
          })
        }

        onOpenChange(false)
        onSubmitted?.(eventId)
      } catch (submitError) {
        const message =
          submitError instanceof Error
            ? submitError.message
            : isEditMode
              ? "Failed to save event."
              : "Failed to submit event request."
        setError(message)
        queueMicrotask(() =>
          errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
        )
      } finally {
        setIsSubmitting(false)
      }
    })()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>
            {isEditMode
              ? "Edit Event"
              : requestOrigin === "member-staff"
                ? "Request an Event"
                : "Create event"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {isEditMode
              ? "Update event details. Changes save to this occurrence."
              : isFacility
                ? spaceMode === "calendar-link"
                  ? approvalRequired
                    ? "Check the facility calendar for space, then come back to finish. This on-site event will wait in Pending until it is confirmed."
                    : "Check the facility calendar for space, then come back to finish this form. Online and External Venue skip Facilities."
                  : approvalRequired
                    ? "Center events wait for approval so space can be coordinated."
                    : "Choose spaces on this calendar, then submit. Approval is not required."
                : "Online and External Venue events do not use Facilities and do not wait for approval."}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingEdit ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading event…
            </div>
          ) : (
          <div className="flex flex-col gap-6">
            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {/* Location type */}
            <div className="flex flex-col gap-2">
              <Label>
                Where is this event? <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {LOCATION_OPTIONS.map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLocationType(value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition-colors",
                      locationType === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {INTERNAL_EVENT_LOCATION_TYPE_LABELS[value]}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & time — above event name */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>
                  Date <span className="text-destructive">*</span>
                </Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-10 w-full justify-between px-3 font-normal",
                        !dateDisplay && "text-muted-foreground"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {dateDisplay || "Select date"}
                        </span>
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      defaultMonth={selectedDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Time <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={startTime || undefined} onValueChange={handleStartTimeChange}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="From 7:00 AM" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-60">
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={`start-${time}`} value={time}>
                            From {time}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                  <Select value={endTime || undefined} onValueChange={setEndTime}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="to 7:30 AM" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-60">
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={`end-${time}`} value={time}>
                            to {time}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">
                  {isEditMode ? "Recurring series (view only)" : "Recurring event?"}
                </span>
                <Switch
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                  disabled={isEditMode}
                />
              </div>

              {isRecurring ? (
                <div
                  className={cn(
                    "flex flex-col gap-4 rounded-lg border bg-muted/30 p-4",
                    isEditMode && "pointer-events-none opacity-70"
                  )}
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Frequency</Label>
                      <Select
                        value={frequency}
                        onValueChange={(v) => setFrequency(v as EventRecurrenceFrequency)}
                      >
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
                        value={interval}
                        onChange={(e) =>
                          setIntervalValue(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                        }
                        className="w-16 text-center"
                      />
                      <span className="text-sm text-muted-foreground">
                        {frequency === "daily" && (interval === 1 ? "day" : "days")}
                        {frequency === "weekly" && (interval === 1 ? "week" : "weeks")}
                        {frequency === "monthly" && (interval === 1 ? "month" : "months")}
                      </span>
                    </div>
                  </div>

                  {frequency === "weekly" ? (
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">On days</Label>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_LABELS.map((label, index) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => toggleWeekday(index)}
                            className={cn(
                              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                              weekdays.includes(index)
                                ? "bg-primary text-primary-foreground"
                                : "border bg-background text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">End condition</Label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={endType === "date"}
                          onChange={() => setEndType("date")}
                          className="h-4 w-4 text-primary"
                        />
                        End by
                      </label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={endType !== "date"}
                        className="w-40"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          checked={endType === "count"}
                          onChange={() => setEndType("count")}
                          className="h-4 w-4 text-primary"
                        />
                        End after
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={endCount}
                        onChange={(e) =>
                          setEndCount(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                        }
                        disabled={endType !== "count"}
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-muted-foreground">occurrence(s)</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">Exceptions</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {exceptions.map((date) => (
                        <div
                          key={date}
                          className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive"
                        >
                          {date}
                          <button type="button" onClick={() => removeException(date)}>
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <Input
                        type="date"
                        value={exceptionDraft}
                        onChange={(e) => setExceptionDraft(e.target.value)}
                        className="w-36"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={addException}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                  </div>

                  {recurrenceSummary ? (
                    <p className="rounded-md bg-primary/5 p-3 text-xs text-muted-foreground">
                      {recurrenceSummary}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Requester / classification + name */}
            <div className="flex flex-col gap-4">
              {defaults?.user ? (
                <div className="flex flex-col gap-1.5">
                  <Label>Requested by</Label>
                  <Input value={defaults.user.name} readOnly disabled className="bg-muted" />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Department <span className="text-destructive">*</span>
                  </Label>
                  {showLockedDepartment && prefilledDepartment ? (
                    <Input
                      value={prefilledDepartment.name}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  ) : (
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>
                    Event type <span className="text-destructive">*</span>
                  </Label>
                  <Select value={eventTypeId} onValueChange={setEventTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
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
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Event name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter event name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-20"
                  placeholder="Brief description of the event..."
                />
              </div>
            </div>

            {/* Location details */}
            {isFacility ? (
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Center details
                </Label>
                {spaceMode === "calendar-link" && !isEditMode ? (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-sm text-muted-foreground">
                      Rooms are not picked in this window. Open the facility
                      calendar to check availability, then come back to finish.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" asChild>
                      <Link
                        href={buildFacilitiesCalendarHref({
                          departmentId:
                            calendarDepartmentId || departmentId || null,
                          returnTo: calendarReturnTo,
                        })}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {VIEW_FACILITY_CALENDAR_CTA_LABEL}
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <FacilityVenueMultiSelect
                    label="Venue(s)"
                    value={venueIds}
                    venues={venues}
                    required={spaceMode === "select" && !isEditMode}
                    onChange={setVenueIds}
                  />
                )}
                <SetupStyleField
                  value={setupStyle}
                  setupStyles={setupStyles}
                  canManage={false}
                  onChange={setSetupStyle}
                  allowEmpty
                />
                <div className="flex flex-col gap-1.5">
                  <Label>Expected attendance</Label>
                  <Input
                    type="number"
                    min={1}
                    value={expectedAttendance}
                    onChange={(e) => setExpectedAttendance(e.target.value)}
                    placeholder="Estimated number of attendees"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Room setup notes</Label>
                  <Textarea
                    value={roomSetupNotes}
                    onChange={(e) => setRoomSetupNotes(e.target.value)}
                    className="min-h-16"
                    placeholder="Special setup requirements..."
                  />
                </div>
              </div>
            ) : null}

            {isOnline ? (
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Online details
                </Label>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meeting-url">Meeting link</Label>
                  <Input
                    id="meeting-url"
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://zoom.us/j/…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Shown on Master Calendar and event details for attendees.
                  </p>
                </div>
              </div>
            ) : null}

            {isExternal ? (
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  External venue
                </Label>
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Venue name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={externalVenueName}
                    onChange={(e) => setExternalVenueName(e.target.value)}
                    placeholder="Enter venue name"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Address <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={externalAddress}
                    onChange={(e) => setExternalAddress(e.target.value)}
                    className="min-h-16"
                    placeholder="Street, city, state"
                  />
                </div>
              </div>
            ) : null}
          </div>
          )}
        </div>

        <div className="space-y-3 border-t bg-background px-6 py-4">
          {error ? (
            <div
              ref={errorRef}
              className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || loadingEdit || (isEditMode && !canEditLoaded)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? "Saving…" : "Submitting…"}
                </>
              ) : isEditMode ? (
                "Save changes"
              ) : isFacility && approvalRequired ? (
                "Submit for approval"
              ) : (
                "Create event"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
