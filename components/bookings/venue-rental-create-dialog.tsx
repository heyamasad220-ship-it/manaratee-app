"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronsUpDown, Loader2, Plus, Search } from "lucide-react"

import { createStaffVenueRentalRequest } from "@/lib/bookings/venue-rental-actions"
import {
  buildVenueRateLookup,
  computeVenueRentalQuotedCharges,
  emptyVenueRateLookup,
} from "@/lib/bookings/venue-rental-quote"
import type { RentalAddonCatalogItem } from "@/lib/bookings/venue-rental-types"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type VenueRentalCreateVenueOption = {
  id: string
  name: string
  hourlyRate?: number
  peakHourlyRate?: number
  basePrice?: number
  peakFlatPrice?: number
  dayHourlyRates?: Array<{ dayOfWeek: number; hourlyPrice: number }>
  dayFlatRates?: Array<{ dayOfWeek: number; flatPrice: number }>
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

type SelectedAddonState = {
  quantity: number
}

type VenueRentalCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  venues: VenueRentalCreateVenueOption[]
  eventTypes: VenueRentalCreateEventTypeOption[]
  setupStyles?: RoomSetupStyle[]
  addons?: RentalAddonCatalogItem[]
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0)
}

export function VenueRentalCreateDialog({
  open,
  onOpenChange,
  venues,
  eventTypes,
  setupStyles = [],
  addons = [],
}: VenueRentalCreateDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [addonsOpen, setAddonsOpen] = useState(false)

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
  const [selectedAddons, setSelectedAddons] = useState<
    Record<string, SelectedAddonState>
  >({})

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
    setAddonsOpen(false)
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
    setSelectedAddons({})
  }, [open, venues])

  const selectedAddonList = useMemo(
    () =>
      addons
        .filter((addon) => selectedAddons[addon.id])
        .map((addon) => ({
          ...addon,
          quantity: Math.max(1, selectedAddons[addon.id]?.quantity || 1),
        })),
    [addons, selectedAddons]
  )

  const quote = useMemo(() => {
    if (!eventDate || !startTime || !endTime || selectedVenueIds.length === 0) {
      return computeVenueRentalQuotedCharges(
        [],
        selectedAddonList.map((addon) => ({
          quantity: addon.quantity,
          unitPrice: addon.defaultPrice,
        })),
        emptyVenueRateLookup()
      )
    }

    const startAt = localDateTimeToIso(eventDate, startTime)
    const endAt = localDateTimeToIso(eventDate, endTime)
    if (new Date(endAt) <= new Date(startAt)) {
      return computeVenueRentalQuotedCharges(
        [],
        selectedAddonList.map((addon) => ({
          quantity: addon.quantity,
          unitPrice: addon.defaultPrice,
        })),
        emptyVenueRateLookup()
      )
    }

    const rates = buildVenueRateLookup({
      venues: venues.map((venue) => ({
        id: venue.id,
        hourly_rate: venue.hourlyRate ?? 0,
        peak_hourly_rate: venue.peakHourlyRate ?? venue.hourlyRate ?? 0,
        base_price: venue.basePrice ?? 0,
        peak_flat_price: venue.peakFlatPrice ?? venue.basePrice ?? 0,
      })),
      dayPricing: venues.flatMap((venue) => {
        const byDay = new Map<
          number,
          { hourly_price: number; flat_price: number }
        >()
        for (const day of venue.dayHourlyRates || []) {
          byDay.set(day.dayOfWeek, {
            hourly_price: day.hourlyPrice,
            flat_price: byDay.get(day.dayOfWeek)?.flat_price ?? 0,
          })
        }
        for (const day of venue.dayFlatRates || []) {
          const existing = byDay.get(day.dayOfWeek)
          byDay.set(day.dayOfWeek, {
            hourly_price: existing?.hourly_price ?? 0,
            flat_price: day.flatPrice,
          })
        }
        return Array.from(byDay.entries()).map(([dayOfWeek, prices]) => ({
          venue_id: venue.id,
          day_of_week: dayOfWeek,
          hourly_price: prices.hourly_price,
          flat_price: prices.flat_price,
          is_active: true,
        }))
      }),
    })

    return computeVenueRentalQuotedCharges(
      selectedVenueIds.map((venueId) => ({ venueId, startAt, endAt })),
      selectedAddonList.map((addon) => ({
        quantity: addon.quantity,
        unitPrice: addon.defaultPrice,
      })),
      rates
    )
  }, [
    eventDate,
    endTime,
    selectedAddonList,
    selectedVenueIds,
    startTime,
    venues,
  ])

  const addonsSummary =
    selectedAddonList.length === 0
      ? "Select add-ons"
      : selectedAddonList.length <= 2
        ? selectedAddonList
            .map((addon) => `${addon.name} × ${addon.quantity}`)
            .join(", ")
        : `${selectedAddonList.length} add-ons selected`

  function toggleVenue(venueId: string, checked: boolean) {
    setSelectedVenueIds((current) => {
      if (checked) {
        return current.includes(venueId) ? current : [...current, venueId]
      }
      return current.filter((id) => id !== venueId)
    })
  }

  function toggleAddon(addonId: string, checked: boolean) {
    setSelectedAddons((current) => {
      if (!checked) {
        const next = { ...current }
        delete next[addonId]
        return next
      }
      if (current[addonId]) return current
      return { ...current, [addonId]: { quantity: 1 } }
    })
  }

  function setAddonQuantity(addonId: string, rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10)
    const quantity = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
    setSelectedAddons((current) => ({
      ...current,
      [addonId]: { quantity },
    }))
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
          addons: selectedAddonList.map((addon) => ({
            rentalAddonId: addon.id,
            quantity: addon.quantity,
            unitPrice: addon.defaultPrice,
          })),
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
          <DialogTitle>Create New Rental Request</DialogTitle>
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
                No bookable spaces. Enable “Available for bookings” in Facilities settings.
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
            allowEmpty
            disabled={isPending}
          />

          <div className="space-y-2">
            <Label>Add-ons</Label>
            {addons.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No add-ons yet. Configure them in Venue Rentals → Settings → Add-ons.
              </p>
            ) : (
              <Popover open={addonsOpen} onOpenChange={setAddonsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={addonsOpen}
                    disabled={isPending}
                    className={cn(
                      "h-auto min-h-10 w-full justify-between px-3 py-2 font-normal",
                      selectedAddonList.length === 0 && "text-muted-foreground"
                    )}
                  >
                    <span className="truncate text-left">{addonsSummary}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <div className="max-h-72 overflow-y-auto p-2">
                    <ul className="space-y-2">
                      {addons.map((addon) => {
                        const checked = Boolean(selectedAddons[addon.id])
                        const quantity = selectedAddons[addon.id]?.quantity ?? 1
                        const checkboxId = `booking-addon-${addon.id}`
                        return (
                          <li
                            key={addon.id}
                            className="rounded-md border px-2 py-2"
                          >
                            <div className="flex items-start gap-2">
                              <Checkbox
                                id={checkboxId}
                                checked={checked}
                                disabled={isPending}
                                onCheckedChange={(value) =>
                                  toggleAddon(addon.id, value === true)
                                }
                              />
                              <label
                                htmlFor={checkboxId}
                                className="min-w-0 flex-1 cursor-pointer text-sm"
                              >
                                <span className="font-medium">{addon.name}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {formatMoney(addon.defaultPrice)} each
                                  {addon.description ? ` · ${addon.description}` : ""}
                                </span>
                              </label>
                            </div>
                            {checked ? (
                              <div className="mt-2 flex items-center gap-2 pl-6">
                                <Label
                                  htmlFor={`${checkboxId}-qty`}
                                  className="text-xs text-muted-foreground"
                                >
                                  Qty
                                </Label>
                                <Input
                                  id={`${checkboxId}-qty`}
                                  type="number"
                                  min={1}
                                  step={1}
                                  inputMode="numeric"
                                  className="h-8 w-20"
                                  value={quantity}
                                  disabled={isPending}
                                  onChange={(event) =>
                                    setAddonQuantity(addon.id, event.target.value)
                                  }
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {formatMoney(addon.defaultPrice * quantity)}
                                </span>
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

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

          <div className="rounded-md border bg-muted/30 px-3 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Space fee</span>
              <span className="tabular-nums">{formatMoney(quote.spaceFee)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Add-ons</span>
              <span className="tabular-nums">{formatMoney(quote.addonFees)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 border-t pt-2 font-medium">
              <span>Total fee</span>
              <span className="tabular-nums">{formatMoney(quote.totalCharges)}</span>
            </div>
            {selectedVenueIds.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Select spaces and a time range to estimate the space fee.
              </p>
            ) : null}
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
