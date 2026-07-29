"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type FacilityVenueOption = {
  id: string
  name: string
}

const NONE_VALUE = "__none__"
const PLACEHOLDER_VALUE = "__placeholder__"

/**
 * Shared single-venue picker for Events / Programs facility booking.
 * Multi-space rentals keep their own checkbox list (same venue catalog).
 */
export function FacilityVenueSelect({
  id = "facility-venue",
  label = "Facility / space",
  value,
  venues,
  disabled,
  required,
  allowNone = true,
  noneLabel = "No facility (location only)",
  onChange,
}: {
  id?: string
  label?: string
  value: string
  venues: FacilityVenueOption[]
  disabled?: boolean
  required?: boolean
  allowNone?: boolean
  noneLabel?: string
  onChange: (venueId: string, venueName: string | null) => void
}) {
  const selected = value
    ? value
    : allowNone
      ? NONE_VALUE
      : PLACEHOLDER_VALUE

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Select
        value={selected}
        disabled={disabled}
        onValueChange={(next) => {
          if (next === NONE_VALUE || next === PLACEHOLDER_VALUE) {
            onChange("", null)
            return
          }
          const venue = venues.find((item) => item.id === next)
          onChange(next, venue?.name ?? null)
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select a space" />
        </SelectTrigger>
        <SelectContent>
          {allowNone ? (
            <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem>
          ) : (
            <SelectItem value={PLACEHOLDER_VALUE} disabled>
              Select a space
            </SelectItem>
          )}
          {venues.map((venue) => (
            <SelectItem key={venue.id} value={venue.id}>
              {venue.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
