"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import {
  Building2,
  DollarSign,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Users,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { FacilitiesSettingsNav } from "@/components/bookings/bookings-settings-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { deleteVenue, upsertVenue } from "@/lib/bookings/venue-actions"
import {
  formatVenueAvailabilityWindow,
  toVenueTimeInputValue,
} from "@/lib/bookings/venue-usage"
import {
  getVenueStatusLabel,
  getVenueSummaryStats,
  parseAmenities,
  VENUE_STATUSES,
  type VenueStatus,
  type VenueWithStats,
} from "@/lib/bookings/venue-types"

type VenueFormState = {
  id?: string
  name: string
  description: string
  location: string
  capacity: string
  basePrice: string
  hourlyRate: string
  peakFlatPrice: string
  peakHourlyRate: string
  availableForBookings: boolean
  availabilityStart: string
  availabilityEnd: string
  amenities: string
  status: VenueStatus
}

const emptyForm: VenueFormState = {
  name: "",
  description: "",
  location: "",
  capacity: "",
  basePrice: "",
  hourlyRate: "",
  peakFlatPrice: "",
  peakHourlyRate: "",
  availableForBookings: false,
  availabilityStart: "08:00",
  availabilityEnd: "22:00",
  amenities: "",
  status: VENUE_STATUSES.active,
}

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-gray-100 text-gray-700",
  Maintenance: "bg-amber-100 text-amber-700",
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatRentalPrice(amount: number, openForRentals: boolean) {
  return openForRentals ? formatCurrency(amount) : "---"
}

function toFormState(venue: VenueWithStats): VenueFormState {
  return {
    id: venue.id,
    name: venue.name,
    description: venue.description || "",
    location: venue.location || "",
    capacity: String(venue.capacity || ""),
    basePrice: String(venue.base_price || ""),
    hourlyRate: String(venue.hourly_rate || ""),
    peakFlatPrice: String(venue.peak_flat_price || venue.base_price || ""),
    peakHourlyRate: String(venue.peak_hourly_rate || venue.hourly_rate || ""),
    availableForBookings: venue.available_for_bookings,
    availabilityStart: toVenueTimeInputValue(venue.availability_start) || "08:00",
    availabilityEnd: toVenueTimeInputValue(venue.availability_end) || "22:00",
    amenities: venue.amenities.join(", "),
    status: venue.status,
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
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [bookingsFilter, setBookingsFilter] = useState<string>("all")
  const [dialogView, setDialogView] = useState<DialogView>("none")
  const [selectedVenue, setSelectedVenue] = useState<VenueWithStats | null>(null)
  const [form, setForm] = useState<VenueFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const summary = useMemo(() => getVenueSummaryStats(venues), [venues])

  const filteredVenues = venues.filter((venue) => {
    const query = search.trim().toLowerCase()
    const statusLabel = getVenueStatusLabel(venue.status)

    const matchesSearch =
      !query ||
      venue.name.toLowerCase().includes(query) ||
      venue.description?.toLowerCase().includes(query) ||
      venue.location?.toLowerCase().includes(query)

    const matchesStatus = statusFilter === "all" || statusLabel === statusFilter
    const matchesBookings =
      bookingsFilter === "all" ||
      (bookingsFilter === "yes" && venue.available_for_bookings) ||
      (bookingsFilter === "no" && !venue.available_for_bookings)

    return matchesSearch && matchesStatus && matchesBookings
  })

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

  function handleSave() {
    setError(null)

    startTransition(async () => {
      try {
        await upsertVenue({
          id: form.id,
          name: form.name,
          description: form.description,
          location: form.location,
          capacity: Number(form.capacity || 0),
          base_price: Number(form.basePrice || 0),
          hourly_rate: Number(form.hourlyRate || 0),
          peak_flat_price: Number(form.peakFlatPrice || form.basePrice || 0),
          peak_hourly_rate: Number(form.peakHourlyRate || form.hourlyRate || 0),
          available_for_bookings: form.availableForBookings,
          availability_start: form.availabilityStart || null,
          availability_end: form.availabilityEnd || null,
          amenities: parseAmenities(form.amenities),
          status: form.status,
        })

        setForm(emptyForm)
        closeDialog()
        router.refresh()
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Failed to save venue"
        )
      }
    })
  }

  function handleDelete(venue: VenueWithStats) {
    if (!window.confirm(`Delete "${venue.name}"?`)) {
      return
    }

    startTransition(async () => {
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
      }
    })
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

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Spaces</h1>
          <p className="text-muted-foreground">
            All active spaces are available for Event Management and Programs. Use the bookings
            toggle to expose a space in Venue Rentals.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 [&>*]:w-fit">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Venues</p>
                  <p className="text-xl font-bold">{summary.totalVenues}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Building2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Venues</p>
                  <p className="text-xl font-bold">{summary.activeVenues}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Capacity</p>
                  <p className="text-xl font-bold">
                    {summary.totalCapacity.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {!facilitiesOnly ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                    <DollarSign className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(summary.totalRevenue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search venues..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bookingsFilter} onValueChange={setBookingsFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Bookings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Spaces</SelectItem>
                <SelectItem value="yes">Open for rentals</SelectItem>
                <SelectItem value="no">Events/programs only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canManage ? (
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Space
            </Button>
          ) : null}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Non-Peak</TableHead>
                  <TableHead>Peak</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVenues.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {venues.length === 0
                        ? "No venues yet. Add your first space to get started."
                        : "No venues match your filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVenues.map((venue) => {
                    const statusLabel = getVenueStatusLabel(venue.status)
                    const hoursLabel = formatVenueAvailabilityWindow(
                      venue.availability_start,
                      venue.availability_end
                    )

                    return (
                      <TableRow
                        key={venue.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openDetailDialog(venue)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{venue.name}</p>
                            {venue.description ? (
                              <p className="line-clamp-1 text-sm text-muted-foreground">
                                {venue.description}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              venue.available_for_bookings
                                ? "bg-blue-100 text-blue-700"
                                : "bg-zinc-100 text-zinc-600"
                            }
                          >
                            {venue.available_for_bookings
                              ? "Open for rentals"
                              : "Events/programs only"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {venue.location || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{venue.capacity}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {venue.available_for_bookings ? (
                            <>
                              <p>{formatCurrency(venue.base_price)} flat</p>
                              <p className="text-muted-foreground">
                                {formatCurrency(venue.hourly_rate)}/hr
                              </p>
                            </>
                          ) : (
                            <p className="text-muted-foreground">---</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {venue.available_for_bookings ? (
                            <>
                              <p>{formatCurrency(venue.peak_flat_price)} flat</p>
                              <p className="text-muted-foreground">
                                {formatCurrency(venue.peak_hourly_rate)}/hr
                              </p>
                            </>
                          ) : (
                            <p className="text-muted-foreground">---</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {hoursLabel || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={statusStyles[statusLabel]}
                          >
                            {statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openDetailDialog(venue)}
                              >
                                View Details
                              </DropdownMenuItem>
                              {canManage ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => openEditDialog(venue)}
                                  >
                                    Edit Venue
                                  </DropdownMenuItem>
                                  {!facilitiesOnly ? (
                                    <DropdownMenuItem asChild>
                                      <Link href="/bookings/overview">
                                        View Bookings
                                      </Link>
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => handleDelete(venue)}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog
          open={dialogView !== "none"}
          onOpenChange={(open) => {
            if (!open) {
              closeDialog()
            }
          }}
        >
          <DialogContent className="max-w-2xl">
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
                      className={`${statusStyles[getVenueStatusLabel(selectedVenue.status)]}`}
                    >
                      {getVenueStatusLabel(selectedVenue.status)}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={
                        selectedVenue.available_for_bookings
                          ? "bg-blue-100 text-blue-700"
                          : "bg-zinc-100 text-zinc-600"
                      }
                    >
                      {selectedVenue.available_for_bookings
                        ? "Open for rentals"
                        : "Events/programs only"}
                    </Badge>
                  </div>

                  {selectedVenue.description ? (
                    <div>
                      <h4 className="mb-1 text-sm font-medium text-muted-foreground">
                        Description
                      </h4>
                      <p className="text-sm">{selectedVenue.description}</p>
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xl font-bold">{selectedVenue.capacity}</p>
                      <p className="text-xs text-muted-foreground">Capacity</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xl font-bold">
                        {formatRentalPrice(
                          selectedVenue.base_price,
                          selectedVenue.available_for_bookings
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Non-peak flat</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xl font-bold">
                        {formatRentalPrice(
                          selectedVenue.peak_flat_price,
                          selectedVenue.available_for_bookings
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Peak flat</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-sm font-semibold">
                        {formatVenueAvailabilityWindow(
                          selectedVenue.availability_start,
                          selectedVenue.availability_end
                        ) || "Not set"}
                      </p>
                      <p className="text-xs text-muted-foreground">Availability</p>
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
                        disabled={isPending}
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
            <div className="grid gap-4 py-4">
              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

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

              <div className="grid gap-4 sm:grid-cols-3">
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
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label>Hours of availability</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="venue-availability-start"
                      type="time"
                      value={form.availabilityStart}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          availabilityStart: event.target.value,
                        }))
                      }
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      id="venue-availability-end"
                      type="time"
                      value={form.availabilityEnd}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          availabilityEnd: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/40 p-3">
                  <Label className="text-sm font-semibold text-blue-800">
                    Non-peak pricing (Mon–Thu)
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="venue-base-price" className="text-xs font-normal">
                        Flat fee ($)
                      </Label>
                      <Input
                        id="venue-base-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.basePrice}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            basePrice: event.target.value,
                          }))
                        }
                        placeholder="350"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="venue-hourly-rate" className="text-xs font-normal">
                        Hourly ($)
                      </Label>
                      <Input
                        id="venue-hourly-rate"
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.hourlyRate}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            hourlyRate: event.target.value,
                          }))
                        }
                        placeholder="50"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50/40 p-3">
                  <Label className="text-sm font-semibold text-amber-800">
                    Peak pricing (Fri–Sun)
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="venue-peak-flat" className="text-xs font-normal">
                        Flat fee ($)
                      </Label>
                      <Input
                        id="venue-peak-flat"
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.peakFlatPrice}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            peakFlatPrice: event.target.value,
                          }))
                        }
                        placeholder="500"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="venue-peak-hourly" className="text-xs font-normal">
                        Hourly ($)
                      </Label>
                      <Input
                        id="venue-peak-hourly"
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.peakHourlyRate}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            peakHourlyRate: event.target.value,
                          }))
                        }
                        placeholder="75"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="flex flex-col gap-2">
                  <Label htmlFor="venue-status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        status: value as VenueStatus,
                      }))
                    }
                  >
                    <SelectTrigger id="venue-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={VENUE_STATUSES.active}>Active</SelectItem>
                      <SelectItem value={VENUE_STATUSES.inactive}>
                        Inactive
                      </SelectItem>
                      <SelectItem value={VENUE_STATUSES.maintenance}>
                        Maintenance
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  Venue is available for bookings (venue rentals)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeDialog}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? (
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
