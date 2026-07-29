"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { FacilitiesSettingsNav } from "@/components/bookings/bookings-settings-nav"
import { ProgramFlyerField } from "@/components/programs/edit/program-flyer-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { deleteVenue, upsertVenue } from "@/lib/bookings/venue-actions"
import {
  buildDefaultVenueDaySchedule,
  formatVenueDayHours,
  VENUE_DAY_LABELS,
  type VenueDayScheduleFormRow,
} from "@/lib/bookings/venue-day-pricing"
import {
  normalizeVenueColor,
  parseAmenities,
  VENUE_STATUSES,
  type VenueWithStats,
} from "@/lib/bookings/venue-types"
import { cn } from "@/lib/utils"

type VenueFormState = {
  id?: string
  name: string
  description: string
  location: string
  capacity: string
  availableForBookings: boolean
  amenities: string
  color: string
  flyerUrl: string
  daySchedule: VenueDayScheduleFormRow[]
}

const emptyForm: VenueFormState = {
  name: "",
  description: "",
  location: "",
  capacity: "",
  availableForBookings: false,
  amenities: "",
  color: "#3b82f6",
  flyerUrl: "",
  daySchedule: buildDefaultVenueDaySchedule(),
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount)
}

function toFormState(venue: VenueWithStats): VenueFormState {
  return {
    id: venue.id,
    name: venue.name,
    description: venue.description || "",
    location: venue.location || "",
    capacity: String(venue.capacity || ""),
    availableForBookings: venue.available_for_bookings,
    amenities: venue.amenities.join(", "),
    color: normalizeVenueColor(venue.color),
    flyerUrl: venue.flyer_url || "",
    daySchedule:
      venue.daySchedule?.length > 0
        ? venue.daySchedule
        : buildDefaultVenueDaySchedule({
            startTime: venue.availability_start,
            endTime: venue.availability_end,
            baseFlat: venue.base_price,
            baseHourly: venue.hourly_rate,
            peakFlat: venue.peak_flat_price,
            peakHourly: venue.peak_hourly_rate,
          }),
  }
}

type DialogView = "none" | "detail" | "edit"

export function SpacesSettingsClient({
  venues,
  canManage,
  supportsExtendedFields = true,
  facilitiesOnly = false,
}: {
  venues: VenueWithStats[]
  canManage: boolean
  supportsExtendedFields?: boolean
  facilitiesOnly?: boolean
}) {
  const router = useRouter()
  const [dialogView, setDialogView] = useState<DialogView>("none")
  const [selectedVenue, setSelectedVenue] = useState<VenueWithStats | null>(null)
  const [form, setForm] = useState<VenueFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function closeDialog() {
    setDialogView("none")
    setSelectedVenue(null)
    setError(null)
  }

  function openCreateDialog() {
    setForm(emptyForm)
    setError(null)
    setSelectedVenue(null)
    setDialogView("edit")
  }

  function openEditDialog(venue: VenueWithStats) {
    setForm(toFormState(venue))
    setError(null)
    setSelectedVenue(venue)
    setDialogView("edit")
  }

  function openDetailDialog(venue: VenueWithStats) {
    setSelectedVenue(venue)
    setDialogView("detail")
  }

  async function handleSave() {
    setError(null)
    setIsSaving(true)

    try {
      const result = await upsertVenue({
        id: form.id,
        name: form.name,
        description: form.description,
        location: form.location,
        capacity: Number(form.capacity || 0),
        available_for_bookings: form.availableForBookings,
        amenities: parseAmenities(form.amenities),
        status: selectedVenue?.status ?? VENUE_STATUSES.active,
        color: form.color,
        flyer_url: form.flyerUrl.trim() || null,
        daySchedule: form.daySchedule,
      })

      setForm(emptyForm)
      closeDialog()
      const warnings = [result.brandingWarning, result.pricingWarning].filter(Boolean)
      if (warnings.length > 0) {
        window.alert(warnings.join("\n\n"))
      }
      router.refresh()
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Failed to save venue"
      setError(message)
      window.alert(message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(venue: VenueWithStats) {
    if (!window.confirm(`Delete "${venue.name}"?`)) {
      return
    }

    setIsSaving(true)
    try {
      await deleteVenue(venue.id)
      closeDialog()
      router.refresh()
    } catch (deleteError) {
      window.alert(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete venue"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Header title="Facilities" />

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure spaces and facility options for your organization.
          </p>
        </div>

        <FacilitiesSettingsNav />

        {!supportsExtendedFields ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Run migrations{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">
              068_venue_usage_tags_and_pricing.sql
            </code>{" "}
            and{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">
              069_venue_available_for_bookings.sql
            </code>{" "}
            in Supabase to enable peak pricing, availability hours, and the bookings toggle.
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Spaces</h1>
            <p className="text-muted-foreground">
              All active spaces are available for Event Management and Programs. Use the
              bookings toggle to expose a space in Venue Rentals.
            </p>
          </div>
          {canManage ? (
            <Button onClick={openCreateDialog} className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Add Space
            </Button>
          ) : null}
        </div>

        {venues.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No venues yet. Add your first space to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {venues.map((venue) => {
              const color = normalizeVenueColor(venue.color)
              return (
                <Card
                  key={venue.id}
                  className="overflow-hidden border-border/80 shadow-sm"
                >
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg sm:w-20"
                        style={venue.flyer_url ? undefined : { backgroundColor: color }}
                        onClick={() => openDetailDialog(venue)}
                        aria-label={`View ${venue.name}`}
                      >
                        {venue.flyer_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={venue.flyer_url}
                            alt={`${venue.name} flyer`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <span className="text-xl font-semibold text-white/90">
                              {venue.name.trim().charAt(0).toUpperCase() || "S"}
                            </span>
                          </div>
                        )}
                      </button>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block size-2.5 shrink-0 rounded-full border"
                                style={{ backgroundColor: color }}
                                title="Space color"
                              />
                              <button
                                type="button"
                                className="truncate text-left text-base font-semibold leading-snug tracking-tight text-primary hover:underline"
                                onClick={() => openDetailDialog(venue)}
                              >
                                {venue.name}
                              </button>
                            </div>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              {venue.capacity} capacity
                              {venue.location ? ` · ${venue.location}` : ""}
                            </p>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                aria-label={`${venue.name} actions`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openDetailDialog(venue)}>
                                View details
                              </DropdownMenuItem>
                              {canManage ? (
                                <>
                                  <DropdownMenuItem onClick={() => openEditDialog(venue)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  {!facilitiesOnly ? (
                                    <DropdownMenuItem asChild>
                                      <Link href="/bookings/overview">View bookings</Link>
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleDelete(venue)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {venue.description || "No description"}
                        </p>

                        <Badge
                          variant="secondary"
                          className={cn(
                            "w-fit",
                            venue.available_for_bookings
                              ? "bg-blue-100 text-blue-700"
                              : "bg-zinc-100 text-zinc-600"
                          )}
                        >
                          {venue.available_for_bookings
                            ? "Available for rental"
                            : "Events/programs only"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <Dialog
          open={dialogView !== "none"}
          onOpenChange={(open) => {
            if (!open) {
              closeDialog()
            }
          }}
        >
          <DialogContent className="flex max-h-[90vh] w-full flex-col gap-4 overflow-hidden sm:max-w-5xl">
            {dialogView === "detail" && selectedVenue ? (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedVenue.name}</DialogTitle>
                  <DialogDescription>
                    {selectedVenue.location || "No location specified"}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className={
                        selectedVenue.available_for_bookings
                          ? "bg-blue-100 text-blue-700"
                          : "bg-zinc-100 text-zinc-600"
                      }
                    >
                      {selectedVenue.available_for_bookings
                        ? "Available for rental"
                        : "Events/programs only"}
                    </Badge>
                  </div>

                  {selectedVenue.flyer_url ? (
                    <div className="overflow-hidden rounded-lg border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedVenue.flyer_url}
                        alt={`${selectedVenue.name} flyer`}
                        className="max-h-56 w-full object-cover"
                      />
                    </div>
                  ) : null}

                  {selectedVenue.description ? (
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-muted-foreground">
                        Description
                      </h4>
                      <p className="text-sm">{selectedVenue.description}</p>
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xl font-bold">{selectedVenue.capacity}</p>
                      <p className="text-xs text-muted-foreground">Capacity</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-sm font-semibold">
                        {selectedVenue.available_for_bookings
                          ? "Available for rental"
                          : "Events/programs only"}
                      </p>
                      <p className="text-xs text-muted-foreground">Rental status</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                      Hours & rates by day
                    </h4>
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Day</TableHead>
                            <TableHead>Hours</TableHead>
                            <TableHead className="text-right">Flat</TableHead>
                            <TableHead className="text-right">Hourly</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(selectedVenue.daySchedule?.length
                            ? selectedVenue.daySchedule
                            : buildDefaultVenueDaySchedule({
                                startTime: selectedVenue.availability_start,
                                endTime: selectedVenue.availability_end,
                                baseFlat: selectedVenue.base_price,
                                baseHourly: selectedVenue.hourly_rate,
                                peakFlat: selectedVenue.peak_flat_price,
                                peakHourly: selectedVenue.peak_hourly_rate,
                              })
                          ).map((day) => (
                            <TableRow key={day.dayOfWeek}>
                              <TableCell className="font-medium">
                                {VENUE_DAY_LABELS[day.dayOfWeek]}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatVenueDayHours(day)}
                              </TableCell>
                              <TableCell className="text-right">
                                {day.open
                                  ? formatCurrency(Number(day.flatPrice || 0))
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {day.open
                                  ? `${formatCurrency(Number(day.hourlyPrice || 0))}/hr`
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {selectedVenue.amenities.length > 0 ? (
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                        Amenities
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedVenue.amenities.map((amenity) => (
                          <Badge key={amenity} variant="outline">
                            {amenity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {!facilitiesOnly ? (
                    <div className="rounded-lg bg-emerald-50 p-4">
                      <p className="text-sm text-emerald-700">Total Revenue</p>
                      <p className="text-2xl font-bold text-emerald-700">
                        {formatCurrency(selectedVenue.revenue)}
                      </p>
                    </div>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeDialog}>
                    Close
                  </Button>
                  {!facilitiesOnly ? (
                    <Button variant="outline" asChild>
                      <Link href="/bookings/overview">View Bookings</Link>
                    </Button>
                  ) : null}
                  {canManage ? (
                    <>
                      <Button
                        variant="outline"
                        className="text-destructive"
                        onClick={() => handleDelete(selectedVenue)}
                        disabled={isSaving}
                      >
                        Delete
                      </Button>
                      <Button onClick={() => openEditDialog(selectedVenue)}>
                        Edit Venue
                      </Button>
                    </>
                  ) : null}
                </DialogFooter>
              </>
            ) : dialogView === "edit" ? (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {form.id ? "Edit Venue" : "Add New Venue"}
                  </DialogTitle>
                  <DialogDescription>
                    {form.id
                      ? "Update venue details used across bookings and calendars."
                      : "Create a space for events, programs, and optional venue rentals."}
                  </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="venue-name">Venue Name</Label>
                      <Input
                        id="venue-name"
                        value={form.name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="e.g., Conference Room C"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="venue-location">Location</Label>
                      <Input
                        id="venue-location"
                        value={form.location}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            location: event.target.value,
                          }))
                        }
                        placeholder="e.g., Building A, Floor 2"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="venue-color">Color</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="venue-color"
                        type="color"
                        className="h-10 w-20 cursor-pointer p-1"
                        value={form.color}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            color: event.target.value,
                          }))
                        }
                      />
                      <span className="text-sm text-muted-foreground">
                        Used on the card when no flyer is uploaded
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="venue-description">Description</Label>
                    <Textarea
                      id="venue-description"
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Describe the venue, features, and ideal use cases..."
                      rows={3}
                    />
                  </div>

                  <ProgramFlyerField
                    programId={form.id || "venue-draft"}
                    value={form.flyerUrl}
                    onValueChange={(url) =>
                      setForm((current) => ({ ...current, flyerUrl: url }))
                    }
                    hideHiddenInput
                  />

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="venue-capacity">Capacity</Label>
                    <Input
                      id="venue-capacity"
                      type="number"
                      min={0}
                      value={form.capacity}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          capacity: event.target.value,
                        }))
                      }
                      placeholder="100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Hours & rates by day</Label>
                    <p className="text-xs text-muted-foreground">
                      Turn off a day to mark it closed. Set hours and pricing for each open
                      day.
                    </p>
                    <div className="rounded-lg border">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[18%]">Day</TableHead>
                            <TableHead className="w-[10%]">Open</TableHead>
                            <TableHead className="w-[18%]">Start</TableHead>
                            <TableHead className="w-[18%]">End</TableHead>
                            <TableHead className="w-[18%]">Flat ($)</TableHead>
                            <TableHead className="w-[18%]">Hourly ($)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {form.daySchedule.map((day, index) => (
                            <TableRow key={day.dayOfWeek}>
                              <TableCell className="font-medium">
                                {VENUE_DAY_LABELS[day.dayOfWeek]}
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={day.open}
                                  onCheckedChange={(checked) =>
                                    setForm((current) => ({
                                      ...current,
                                      daySchedule: current.daySchedule.map((row, i) =>
                                        i === index ? { ...row, open: checked } : row
                                      ),
                                    }))
                                  }
                                  aria-label={`${VENUE_DAY_LABELS[day.dayOfWeek]} open`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="time"
                                  disabled={!day.open}
                                  value={day.startTime}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      daySchedule: current.daySchedule.map((row, i) =>
                                        i === index
                                          ? { ...row, startTime: event.target.value }
                                          : row
                                      ),
                                    }))
                                  }
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="time"
                                  disabled={!day.open}
                                  value={day.endTime}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      daySchedule: current.daySchedule.map((row, i) =>
                                        i === index
                                          ? { ...row, endTime: event.target.value }
                                          : row
                                      ),
                                    }))
                                  }
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  disabled={!day.open}
                                  value={day.flatPrice}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      daySchedule: current.daySchedule.map((row, i) =>
                                        i === index
                                          ? { ...row, flatPrice: event.target.value }
                                          : row
                                      ),
                                    }))
                                  }
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  disabled={!day.open}
                                  value={day.hourlyPrice}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      daySchedule: current.daySchedule.map((row, i) =>
                                        i === index
                                          ? { ...row, hourlyPrice: event.target.value }
                                          : row
                                      ),
                                    }))
                                  }
                                  className="h-8"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="venue-amenities">Amenities</Label>
                    <Input
                      id="venue-amenities"
                      value={form.amenities}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          amenities: event.target.value,
                        }))
                      }
                      placeholder="Projector, WiFi, Kitchen Access (comma separated)"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="venue-available-for-bookings"
                      checked={form.availableForBookings}
                      onCheckedChange={(checked) =>
                        setForm((current) => ({
                          ...current,
                          availableForBookings: checked,
                        }))
                      }
                    />
                    <Label htmlFor="venue-available-for-bookings">
                      Available for rental
                    </Label>
                  </div>
                </div>
                {error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
                <DialogFooter>
                  <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : form.id ? (
                      "Save Changes"
                    ) : (
                      "Add Space"
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
