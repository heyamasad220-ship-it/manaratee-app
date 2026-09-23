"use client"

import { useEffect, useState } from "react"
import {
  fetchBazaarLinkedVenueIds,
  fetchSelectedOrganizationName,
  fetchVenuesForBazaarPicker,
  upsertBazaarEvent,
  type BazaarVenueOption,
} from "@/lib/vendor-hub/vendor-hub-event-actions"
import {
  BAZAAR_CALENDAR_VISIBILITY_OPTIONS,
  visibilityFromCalendarStatus,
  type BazaarCalendarVisibility,
} from "@/lib/vendor-hub/calendar-visibility"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { HrContactPicker, type HrContactOption } from "@/components/hr/hr-contact-picker"
import { QuickAddContactDialog } from "@/components/contacts/quick-add-contact-dialog"
import { FacilityVenueMultiSelect } from "@/components/reservations/facility-venue-multi-select"
import {
  formatVolunteerHourOption,
  volunteerHourOptions,
} from "@/lib/events/volunteer-windows"
import {
  ChevronDown,
  ChevronRight,
  Plus,
  User,
  Calendar,
  Globe,
} from "lucide-react"

interface CreateBazaarEventDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventData?: {
    id: string
    name?: string | null
    event_type?: string | null
    event_date?: string | null
    start_time?: string | null
    end_time?: string | null
    location?: string | null
    description?: string | null
    calendar_status?: string | null
    organizer_contact_id?: string | null
    organizer_name?: string | null
    venue_id?: string | null
    organizer_contact?: {
      id: string
      full_name: string | null
      email: string | null
      phone: string | null
    } | null
  }
}

function toHourValue(time: string | null | undefined) {
  if (!time) return ""
  const match = /^(\d{2}):(\d{2})/.exec(time)
  return match ? `${match[1]}:${match[2]}` : ""
}

function toSupabaseTime(time24: string): string | null {
  if (!time24.trim()) return null
  return `${time24.slice(0, 5)}:00`
}

function HourSelect({
  id,
  label,
  value,
  onValueChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  placeholder: string
}) {
  const options = volunteerHourOptions(value)
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="mt-1.5" aria-label={label}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {formatVolunteerHourOption(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function CreateBazaarEventDrawer({
  open,
  onOpenChange,
  eventData,
}: CreateBazaarEventDrawerProps) {
  const isEditing = !!eventData
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [venues, setVenues] = useState<BazaarVenueOption[]>([])
  const [loadingVenues, setLoadingVenues] = useState(false)
  const [organizationName, setOrganizationName] = useState("")
  const [quickAddContactOpen, setQuickAddContactOpen] = useState(false)
  const [calendarSection, setCalendarSection] = useState(false)

  const [calendarVisibility, setCalendarVisibility] =
    useState<BazaarCalendarVisibility>("private")

  const [eventName, setEventName] = useState("")
  const [startDate, setStartDate] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [endDate, setEndDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [linkedSpaceIds, setLinkedSpaceIds] = useState<string[]>([])
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(null)
  const [primaryContactLabel, setPrimaryContactLabel] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")

  function applyOrganizerContact(contact: {
    contactId: string
    full_name: string | null
    email: string | null
    phone: string | null
  }) {
    setPrimaryContactId(contact.contactId)
    setPrimaryContactLabel(contact.full_name?.trim() || "Selected contact")
    setContactEmail(contact.email ?? "")
    setContactPhone(contact.phone ?? "")
  }

  function clearOrganizerContact() {
    setPrimaryContactId(null)
    setPrimaryContactLabel("")
    setContactEmail("")
    setContactPhone("")
  }

  useEffect(() => {
    if (!open) return

    setSaveError(null)
    setLoadingVenues(true)
    void fetchVenuesForBazaarPicker()
      .then(setVenues)
      .finally(() => setLoadingVenues(false))
    void fetchSelectedOrganizationName()
      .then((name) => setOrganizationName(name || ""))
      .catch(() => setOrganizationName(""))
  }, [open])

  useEffect(() => {
    if (!open || !eventData?.id) return
    let cancelled = false
    void fetchBazaarLinkedVenueIds(eventData.id).then((ids) => {
      if (!cancelled) setLinkedSpaceIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [open, eventData?.id])

  useEffect(() => {
    if (!open) return

    if (eventData) {
      setEventName(eventData.name ?? "")
      setStartDate(eventData.event_date ?? "")
      setLocation(eventData.location ?? "")
      setDescription(eventData.description ?? "")
      setCalendarVisibility(visibilityFromCalendarStatus(eventData.calendar_status))
      setLinkedSpaceIds(eventData.venue_id ? [eventData.venue_id] : [])

      if (eventData.organizer_contact) {
        applyOrganizerContact({
          contactId: eventData.organizer_contact.id,
          full_name: eventData.organizer_contact.full_name,
          email: eventData.organizer_contact.email,
          phone: eventData.organizer_contact.phone,
        })
      } else if (eventData.organizer_contact_id) {
        setPrimaryContactId(eventData.organizer_contact_id)
        setPrimaryContactLabel("Selected contact")
        setContactEmail("")
        setContactPhone("")
      } else {
        clearOrganizerContact()
      }

      setStartTime(toHourValue(eventData.start_time))
      setEndTime(toHourValue(eventData.end_time))
      return
    }

    setEventName("")
    setStartDate("")
    setLocation("")
    setDescription("")
    setEndDate("")
    setCalendarVisibility("private")
    setStartTime("")
    setEndTime("")
    setLinkedSpaceIds([])
    clearOrganizerContact()
  }, [open, eventData])

  const handleSave = async () => {
    if (!eventName.trim()) {
      setSaveError("Please enter an event name.")
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      await upsertBazaarEvent({
        id: eventData?.id,
        name: eventName.trim(),
        event_date: startDate || null,
        start_time: toSupabaseTime(startTime),
        end_time: toSupabaseTime(endTime),
        location: location || null,
        description: description || null,
        calendar_visibility: calendarVisibility,
        organizer_contact_id: primaryContactId,
        venue_ids: linkedSpaceIds,
      })

      onOpenChange(false)
      window.location.reload()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save bazaar event")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-lg">
            {isEditing ? "Edit Bazaar Event" : "Create Bazaar Event"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update the bazaar name, schedule, place, and contact."
              : "Set up a new bazaar, festival, or community event"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 p-6">
            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Core Details
              </h3>
              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="eventName">Event Name</Label>
                  <Input
                    id="eventName"
                    placeholder="e.g., Annual Community Bazaar 2026"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date (optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <HourSelect
                    id="bazaar-start-time"
                    label="Start Time"
                    value={startTime}
                    onValueChange={setStartTime}
                    placeholder="Select start time"
                  />
                  <HourSelect
                    id="bazaar-end-time"
                    label="End Time"
                    value={endTime}
                    onValueChange={setEndTime}
                    placeholder="Select end time"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Main Hall & Outdoor Area"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description for staff and calendar listings..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1.5"
                    rows={3}
                  />
                </div>
                <div>
                  <FacilityVenueMultiSelect
                    id="linkedSpace"
                    label="On-site spaces (optional)"
                    value={linkedSpaceIds}
                    venues={venues}
                    disabled={loadingVenues}
                    emptyLabel="Off-site — no facility hold"
                    onChange={(venueIds) => {
                      setLinkedSpaceIds(venueIds)
                      if (!location.trim() && venueIds[0]) {
                        const venueName = venues.find((venue) => venue.id === venueIds[0])?.name
                        if (venueName) setLocation(venueName)
                      }
                    }}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Check every space this bazaar uses so Facilities can hold them on the calendar.
                    Leave them all unchecked if it is off-site.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <User className="h-4 w-4 text-muted-foreground" />
                Organizer
              </h3>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-medium">Organization</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {organizationName || "This bazaar is organized by your organization."}
                  </p>
                </div>
                <div className="space-y-2">
                  <HrContactPicker
                    label="Primary Contact"
                    selectedContactId={primaryContactId}
                    selectedLabel={primaryContactLabel}
                    onChange={(contact: HrContactOption) => applyOrganizerContact(contact)}
                    onClear={clearOrganizerContact}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => setQuickAddContactOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create new contact
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="From selected contact"
                      value={contactEmail}
                      readOnly
                      className="mt-1.5 bg-muted/40"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      placeholder="From selected contact"
                      value={contactPhone}
                      readOnly
                      className="mt-1.5 bg-muted/40"
                    />
                  </div>
                </div>
              </div>
            </section>

            <Collapsible open={calendarSection} onOpenChange={setCalendarSection}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-lg py-2 text-left hover:bg-muted/50">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    Community Calendar
                    {calendarVisibility !== "private" ? (
                      <Badge variant="outline" className="ml-2 border-emerald-200 bg-emerald-50 text-emerald-700">
                        {calendarVisibility === "published" ? "Public" : "Community Visible"}
                      </Badge>
                    ) : null}
                  </h3>
                  {calendarSection ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-col gap-4 pl-6">
                  <div>
                    <Label htmlFor="calendarVisibility">Calendar Visibility</Label>
                    <Select
                      value={calendarVisibility}
                      onValueChange={(value) =>
                        setCalendarVisibility(value as BazaarCalendarVisibility)
                      }
                    >
                      <SelectTrigger id="calendarVisibility" className="mt-1.5">
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        {BAZAAR_CALENDAR_VISIBILITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {
                        BAZAAR_CALENDAR_VISIBILITY_OPTIONS.find(
                          (option) => option.value === calendarVisibility
                        )?.description
                      }
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <p className="text-sm text-muted-foreground">
              Booth setup, payments, vendor applications, public info, and internal notes are on
              the bazaar Settings tab after the event is created.
            </p>
          </div>
        </div>

        <SheetFooter className="flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:justify-between">
          {saveError ? (
            <p className="w-full text-sm text-destructive sm:order-first sm:w-auto">{saveError}</p>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none">
              {saving
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Event"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>

      <QuickAddContactDialog
        open={quickAddContactOpen}
        onOpenChange={setQuickAddContactOpen}
        onCreated={(contact) => {
          applyOrganizerContact({
            contactId: contact.contactId,
            full_name: contact.full_name,
            email: contact.email,
            phone: contact.phone,
          })
        }}
      />
    </Sheet>
  )
}
