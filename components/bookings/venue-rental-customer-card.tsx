"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil } from "lucide-react"

import { updateVenueRentalRequestDetails } from "@/lib/bookings/venue-rental-actions"
import {
  formatVenueRentalSpaceLine,
  getVenueRentalDisplayNotes,
} from "@/lib/bookings/venue-rental-format"
import type { VenueRentalQueueRow } from "@/lib/bookings/venue-rental-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { TimeInput } from "@/components/ui/time-input"
import { toTime24 } from "@/components/ui/time-picker"

export type VenueRentalEditVenueOption = {
  id: string
  name: string
}

export type VenueRentalEditEventTypeOption = {
  id: string
  name: string
}

type VenueRentalCustomerCardProps = {
  rental: VenueRentalQueueRow
  canManage: boolean
  venues: VenueRentalEditVenueOption[]
  eventTypes: VenueRentalEditEventTypeOption[]
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function isoToLocalDateInput(iso: string) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function isoToLocalTimeInput(iso: string, minuteStep = 5) {
  const date = new Date(iso)
  const hours = date.getHours()
  const rawMinutes = date.getMinutes()
  const step = Math.max(1, Math.min(30, minuteStep))
  let minutes = Math.round(rawMinutes / step) * step
  if (minutes >= 60) {
    return toTime24(hours + 1, 0)
  }
  return toTime24(hours, minutes)
}

function localDateTimeToIso(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number)
  const [hourPart, minutePart] = time.split(":")
  const hour = Number.parseInt(hourPart, 10)
  const minute = Number.parseInt(minutePart, 10)
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    throw new Error("Invalid date or time.")
  }
  const local = new Date(year, month - 1, day, hour, minute, 0, 0)
  return local.toISOString()
}

function buildEditState(rental: VenueRentalQueueRow) {
  const primary = rental.spaces[0]
  return {
    selectedVenueIds: rental.spaces.map((space) => space.venueId),
    eventDate: primary ? isoToLocalDateInput(primary.startAt) : "",
    startTime: primary ? isoToLocalTimeInput(primary.startAt) : "10:00",
    endTime: primary ? isoToLocalTimeInput(primary.endAt) : "14:00",
    eventTypeId: rental.eventTypeId || "",
    notes: getVenueRentalDisplayNotes(rental.notes) || "",
  }
}

export function VenueRentalCustomerCard({
  rental,
  canManage,
  venues,
  eventTypes,
}: VenueRentalCustomerCardProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editState, setEditState] = useState(() => buildEditState(rental))

  const displayNotes = useMemo(
    () => getVenueRentalDisplayNotes(rental.notes),
    [rental.notes]
  )

  useEffect(() => {
    if (!isEditing) {
      setEditState(buildEditState(rental))
      setError(null)
    }
  }, [isEditing, rental])

  const venueOptions = useMemo(() => {
    const byId = new Map(venues.map((venue) => [venue.id, venue]))
    for (const space of rental.spaces) {
      if (!byId.has(space.venueId)) {
        byId.set(space.venueId, { id: space.venueId, name: space.venueName })
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [rental.spaces, venues])

  function toggleVenue(venueId: string, checked: boolean) {
    setEditState((current) => {
      if (checked) {
        return {
          ...current,
          selectedVenueIds: current.selectedVenueIds.includes(venueId)
            ? current.selectedVenueIds
            : [...current.selectedVenueIds, venueId],
        }
      }
      return {
        ...current,
        selectedVenueIds: current.selectedVenueIds.filter((id) => id !== venueId),
      }
    })
  }

  function handleCancel() {
    setIsEditing(false)
    setError(null)
    setEditState(buildEditState(rental))
  }

  function handleSave() {
    setError(null)

    if (editState.selectedVenueIds.length === 0) {
      setError("Select at least one space.")
      return
    }
    if (!editState.eventDate || !editState.startTime || !editState.endTime) {
      setError("Enter the event date and time.")
      return
    }

    const startAt = localDateTimeToIso(editState.eventDate, editState.startTime)
    const endAt = localDateTimeToIso(editState.eventDate, editState.endTime)

    if (new Date(endAt) <= new Date(startAt)) {
      setError("End time must be after start time.")
      return
    }

    startTransition(async () => {
      try {
        await updateVenueRentalRequestDetails({
          venueRentalId: rental.id,
          venueRentalEventTypeId: editState.eventTypeId || null,
          notes: editState.notes,
          spaces: editState.selectedVenueIds.map((venueId) => ({
            venueId,
            startAt,
            endAt,
          })),
        })
        setIsEditing(false)
        router.refresh()
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to update this request."
        )
      }
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Customer</CardTitle>
        {canManage && !isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-medium">{rental.customerName}</p>
        <p className="text-muted-foreground">
          {rental.customerEmail || "No email on file"}
        </p>
        <p className="text-muted-foreground">
          {rental.customerPhone || "No phone on file"}
        </p>

        {isEditing ? (
          <div className="space-y-4 border-t pt-4">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Spaces</Label>
              {venueOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No bookable spaces. Enable “Available for bookings” in Facilities
                  settings.
                </p>
              ) : (
                <div className="space-y-2 rounded-md border p-3">
                  {venueOptions.map((venue) => {
                    const checked = editState.selectedVenueIds.includes(venue.id)
                    const checkboxId = `edit-rental-venue-${venue.id}`
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
              <div className="grid gap-2 sm:col-span-1">
                <Label htmlFor="edit-rental-date">Date</Label>
                <Input
                  id="edit-rental-date"
                  type="date"
                  value={editState.eventDate}
                  disabled={isPending}
                  onChange={(event) =>
                    setEditState((current) => ({
                      ...current,
                      eventDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-rental-start">Start</Label>
                <TimeInput
                  id="edit-rental-start"
                  value={editState.startTime}
                  disabled={isPending}
                  minuteStep={5}
                  onChange={(value) =>
                    setEditState((current) => ({
                      ...current,
                      startTime: value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-rental-end">End</Label>
                <TimeInput
                  id="edit-rental-end"
                  value={editState.endTime}
                  disabled={isPending}
                  minuteStep={5}
                  onChange={(value) =>
                    setEditState((current) => ({
                      ...current,
                      endTime: value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Event type</Label>
              <Select
                value={editState.eventTypeId || "__none__"}
                disabled={isPending}
                onValueChange={(value) =>
                  setEditState((current) => ({
                    ...current,
                    eventTypeId: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No event type</SelectItem>
                  {eventTypes.map((eventType) => (
                    <SelectItem key={eventType.id} value={eventType.id}>
                      {eventType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-rental-notes">Notes</Label>
              <Textarea
                id="edit-rental-notes"
                value={editState.notes}
                disabled={isPending}
                rows={4}
                placeholder="Add or update customer notes"
                onChange={(event) =>
                  setEditState((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={isPending} onClick={handleSave}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {rental.eventTypeName ? (
              <p>Event type: {rental.eventTypeName}</p>
            ) : null}
            {rental.spaces.map((space) => (
              <p key={`${space.venueId}-${space.startAt}`}>
                {formatVenueRentalSpaceLine(
                  space.venueName,
                  space.startAt,
                  space.endAt
                )}
              </p>
            ))}
            {displayNotes ? (
              <p className="whitespace-pre-wrap text-muted-foreground">
                {displayNotes}
              </p>
            ) : null}
            {rental.addons.length ? (
              <div className="pt-1">
                <p className="mb-1 font-medium">Add-ons</p>
                <ul className="space-y-1 text-muted-foreground">
                  {rental.addons.map((addon) => (
                    <li key={addon.id}>
                      {addon.name} × {addon.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
