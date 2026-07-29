"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Search } from "lucide-react"

import { createStaffVenueRentalRequest } from "@/lib/bookings/venue-rental-actions"
import { fetchContactsList } from "@/lib/contacts/contact-list-actions"
import {
  getContactRecordTypeLabel,
  type ContactRecordType,
} from "@/lib/contacts/contact-constants"
import type { RoomSetupStyle } from "@/lib/setup-styles/setup-style-types"
import { SetupStyleField } from "@/components/setup-styles/setup-style-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type VenueRentalCreateVenueOption = {
  id: string
  name: string
}

export type VenueRentalCreateEventTypeOption = {
  id: string
  name: string
}

type ContactOption = {
  id: string
  name: string
  email: string
  phone: string
  recordType: ContactRecordType
  primaryContactName: string
}

type VenueRentalCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  venues: VenueRentalCreateVenueOption[]
  eventTypes: VenueRentalCreateEventTypeOption[]
  setupStyles?: RoomSetupStyle[]
}

function todayDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function localDateTimeToIso(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const local = new Date(year, month - 1, day, hour, minute, 0, 0)
  return local.toISOString()
}

export function VenueRentalCreateDialog({
  open,
  onOpenChange,
  venues,
  eventTypes,
  setupStyles = [],
}: VenueRentalCreateDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [contactSearch, setContactSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null)

  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([])
  const [eventDate, setEventDate] = useState(todayDateInputValue)
  const [startTime, setStartTime] = useState("10:00")
  const [endTime, setEndTime] = useState("14:00")
  const [eventTypeId, setEventTypeId] = useState("")
  const [setupStyle, setSetupStyle] = useState("")
  const [expectedAttendance, setExpectedAttendance] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(contactSearch.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [contactSearch])

  const loadContacts = useCallback(async () => {
    if (!open || selectedContact || debouncedSearch.length < 2) {
      setContactOptions([])
      return
    }

    setLoadingContacts(true)
    try {
      const result = await fetchContactsList({
        search: debouncedSearch,
        page: 1,
        pageSize: 12,
      })
      setContactOptions(
        result.contacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          recordType: contact.recordType,
          primaryContactName: contact.primaryContactName,
        }))
      )
    } catch (loadError) {
      console.error(loadError)
      setContactOptions([])
    } finally {
      setLoadingContacts(false)
    }
  }, [debouncedSearch, open, selectedContact])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts])

  useEffect(() => {
    if (!open) return
    setError(null)
    setContactSearch("")
    setDebouncedSearch("")
    setContactOptions([])
    setSelectedContact(null)
    setSelectedVenueIds([])
    setEventDate(todayDateInputValue())
    setStartTime("10:00")
    setEndTime("14:00")
    setEventTypeId("")
    setSetupStyle("")
    setExpectedAttendance("")
    setNotes("")
  }, [open, venues])

  function toggleVenue(venueId: string, checked: boolean) {
    setSelectedVenueIds((current) => {
      if (checked) {
        return current.includes(venueId) ? current : [...current, venueId]
      }
      return current.filter((id) => id !== venueId)
    })
  }

  function handleSubmit() {
    setError(null)

    if (!selectedContact) {
      setError("Select a contact for this booking.")
      return
    }
    if (selectedVenueIds.length === 0) {
      setError("Select at least one space.")
      return
    }
    if (!eventDate || !startTime || !endTime) {
      setError("Enter the event date and time.")
      return
    }

    const startAt = localDateTimeToIso(eventDate, startTime)
    const endAt = localDateTimeToIso(eventDate, endTime)

    if (new Date(endAt) <= new Date(startAt)) {
      setError("End time must be after start time.")
      return
    }

    const attendanceValue = expectedAttendance.trim()
      ? Number.parseInt(expectedAttendance.trim(), 10)
      : null

    if (
      attendanceValue !== null &&
      (!Number.isFinite(attendanceValue) || attendanceValue <= 0)
    ) {
      setError("Expected attendance must be a positive number.")
      return
    }

    startTransition(async () => {
      try {
        const rentalId = await createStaffVenueRentalRequest({
          billingContactId: selectedContact.id,
          venueRentalEventTypeId: eventTypeId || null,
          notes: notes.trim() || null,
          expectedAttendance: attendanceValue,
          setupStyle: setupStyle.trim() || null,
          spaces: selectedVenueIds.map((venueId) => ({ venueId, startAt, endAt })),
        })
        onOpenChange(false)
        router.push(`/bookings/rentals/${rentalId}`)
        router.refresh()
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to create booking."
        )
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add booking</DialogTitle>
          <DialogDescription>
            Create a venue rental request for any contact. It will appear in Requests as
            submitted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="booking-contact-search">Contact</Label>
            {selectedContact ? (
              <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{selectedContact.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getContactRecordTypeLabel(selectedContact.recordType)}
                    {selectedContact.email ? ` · ${selectedContact.email}` : ""}
                    {selectedContact.phone ? ` · ${selectedContact.phone}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setSelectedContact(null)
                    setContactSearch("")
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="booking-contact-search"
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                    placeholder="Search by name, email, or phone"
                    className="pl-9"
                    disabled={isPending}
                    autoComplete="off"
                  />
                </div>
                {loadingContacts ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </p>
                ) : null}
                {contactOptions.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto rounded-md border">
                    {contactOptions.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-0 hover:bg-muted/50"
                        onClick={() => {
                          setSelectedContact(contact)
                          setContactOptions([])
                          setContactSearch("")
                        }}
                      >
                        <span className="font-medium">{contact.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {getContactRecordTypeLabel(contact.recordType)}
                          {contact.primaryContactName
                            ? ` · ${contact.primaryContactName}`
                            : ""}
                          {contact.email ? ` · ${contact.email}` : ""}
                          {contact.phone ? ` · ${contact.phone}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : debouncedSearch.length >= 2 && !loadingContacts ? (
                  <p className="text-sm text-muted-foreground">No contacts found.</p>
                ) : null}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>Spaces</Label>
            {venues.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No bookable spaces. Enable “Available for bookings” in Bookings settings.
              </p>
            ) : (
              <div className="space-y-2 rounded-md border p-3">
                {venues.map((venue) => {
                  const checked = selectedVenueIds.includes(venue.id)
                  const checkboxId = `booking-venue-${venue.id}`
                  return (
                    <label
                      key={venue.id}
                      htmlFor={checkboxId}
                      className="flex cursor-pointer items-center gap-3 text-sm"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={checked}
                        disabled={isPending}
                        onCheckedChange={(value) =>
                          toggleVenue(venue.id, value === true)
                        }
                      />
                      <span>{venue.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="booking-date">Date</Label>
              <Input
                id="booking-date"
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-start">Start</Label>
              <Input
                id="booking-start"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-end">End</Label>
              <Input
                id="booking-end"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Event type</Label>
            <Select
              value={eventTypeId || "__none__"}
              onValueChange={(value) => setEventTypeId(value === "__none__" ? "" : value)}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {eventTypes.map((eventType) => (
                  <SelectItem key={eventType.id} value={eventType.id}>
                    {eventType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SetupStyleField
            id="booking-setup-style"
            label="Setup"
            value={setupStyle}
            setupStyles={setupStyles}
            onChange={setSetupStyle}
            canManage
            allowEmpty
            disabled={isPending}
          />

          <div className="space-y-2">
            <Label htmlFor="booking-attendance">Expected attendance</Label>
            <Input
              id="booking-attendance"
              type="number"
              min={1}
              inputMode="numeric"
              value={expectedAttendance}
              onChange={(event) => setExpectedAttendance(event.target.value)}
              placeholder="Optional"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="booking-notes">Notes</Label>
            <Textarea
              id="booking-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              rows={3}
              disabled={isPending}
            />
          </div>

          {error ? (
            <p className={cn("text-sm text-red-600")} role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
