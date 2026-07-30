"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type FacilityVenueOption = {
  id: string
  name: string
}

/**
 * Multi-venue picker with checkbox menu (Events facility booking).
 * Popover stays open while selecting; closes on Done or outside click.
 */
export function FacilityVenueMultiSelect({
  id = "facility-venues",
  label = "Venue",
  value,
  venues,
  disabled,
  required,
  onChange,
}: {
  id?: string
  label?: string
  value: string[]
  venues: FacilityVenueOption[]
  disabled?: boolean
  required?: boolean
  onChange: (venueIds: string[]) => void
}) {
  const [open, setOpen] = useState(false)

  const selectedIds = useMemo(
    () => value.filter((venueId) => venues.some((venue) => venue.id === venueId)),
    [value, venues]
  )

  const selectedNames = venues
    .filter((venue) => selectedIds.includes(venue.id))
    .map((venue) => venue.name)

  const summary =
    selectedNames.length === 0
      ? "Select venues"
      : selectedNames.length <= 2
        ? selectedNames.join(", ")
        : `${selectedNames.slice(0, 2).join(", ")} +${selectedNames.length - 2}`

  function toggleVenue(venueId: string, checked: boolean) {
    if (checked) {
      onChange(selectedIds.includes(venueId) ? selectedIds : [...selectedIds, venueId])
      return
    }
    onChange(selectedIds.filter((idValue) => idValue !== venueId))
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-auto min-h-10 w-full justify-between px-3 py-2 font-normal",
              selectedNames.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="truncate text-left">{summary}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="max-h-60 overflow-y-auto p-2">
            {venues.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No venues available.</p>
            ) : (
              <ul className="space-y-1">
                {venues.map((venue) => {
                  const checked = selectedIds.includes(venue.id)
                  const checkboxId = `${id}-${venue.id}`
                  return (
                    <li key={venue.id}>
                      <label
                        htmlFor={checkboxId}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                          checked && "bg-muted/60"
                        )}
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          onCheckedChange={(next) =>
                            toggleVenue(venue.id, next === true)
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{venue.name}</span>
                        {checked ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                        ) : null}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between border-t px-2 py-2">
            <p className="px-1 text-xs text-muted-foreground">
              {selectedIds.length === 0
                ? "Select one or more"
                : `${selectedIds.length} selected`}
            </p>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
