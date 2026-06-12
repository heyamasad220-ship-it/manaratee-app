"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"

import {
  normalizeVenueStatus,
  parseAmenities,
  VENUE_STATUSES,
  type VenueStatus,
} from "./venue-types"

type UpsertVenueInput = {
  id?: string
  name: string
  description?: string | null
  location?: string | null
  capacity?: number
  base_price?: number
  hourly_rate?: number
  peak_flat_price?: number
  peak_hourly_rate?: number
  available_for_bookings?: boolean
  availability_start?: string | null
  availability_end?: string | null
  amenities?: string[] | string | null
  status?: VenueStatus
}

async function assertCanManageVenues() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  if (!canManage) {
    throw new Error("You do not have permission to manage spaces.")
  }
}

function validateVenueInput(input: UpsertVenueInput) {
  const name = input.name.trim()

  if (!name) {
    throw new Error("Venue name is required.")
  }

  const status = input.status
    ? normalizeVenueStatus(input.status)
    : VENUE_STATUSES.active

  if (!Object.values(VENUE_STATUSES).includes(status)) {
    throw new Error("Invalid venue status.")
  }

  return {
    name,
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
    capacity: Math.max(0, Number(input.capacity || 0)),
    base_price: Math.max(0, Number(input.base_price || 0)),
    hourly_rate: Math.max(0, Number(input.hourly_rate || 0)),
    peak_flat_price: Math.max(0, Number(input.peak_flat_price || 0)),
    peak_hourly_rate: Math.max(0, Number(input.peak_hourly_rate || 0)),
    available_for_bookings: Boolean(input.available_for_bookings),
    availability_start: input.availability_start?.trim() || null,
    availability_end: input.availability_end?.trim() || null,
    amenities: parseAmenities(input.amenities),
    status,
  }
}

function toLegacyVenuePayload(payload: ReturnType<typeof validateVenueInput>) {
  const {
    peak_flat_price: _peakFlat,
    peak_hourly_rate: _peakHourly,
    available_for_bookings: _availableForBookings,
    availability_start: _availabilityStart,
    availability_end: _availabilityEnd,
    ...legacy
  } = payload

  return legacy
}

function isMissingVenueColumnError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ""
  return (
    message.includes("available_for_bookings") ||
    message.includes("usage_tag") ||
    message.includes("peak_flat_price") ||
    message.includes("peak_hourly_rate") ||
    message.includes("availability_start") ||
    message.includes("availability_end") ||
    message.includes("does not exist")
  )
}

function revalidateVenuePaths() {
  revalidatePath("/facilities/settings/spaces")
  revalidatePath("/facilities/settings")
  revalidatePath("/facilities/calendar")
  revalidatePath("/facilities/availability")
  revalidatePath("/bookings/overview")
  revalidatePath("/bookings/calendar")
  revalidatePath("/event-management")
  revalidatePath("/customer/rentals")
  revalidatePath("/customer/rentals/new")
}

export async function upsertVenue(input: UpsertVenueInput) {
  await assertCanManageVenues()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const payload = validateVenueInput(input)

  async function writeVenueRecord(recordPayload: Record<string, unknown>) {
    if (input.id) {
      return supabase
        .from("venues")
        .update(recordPayload)
        .eq("id", input.id)
        .eq("organization_id", organizationId)
    }

    return supabase.from("venues").insert({
      organization_id: organizationId,
      ...recordPayload,
    })
  }

  let { error } = await writeVenueRecord(payload)

  if (error && isMissingVenueColumnError(error)) {
    const legacyResult = await writeVenueRecord(toLegacyVenuePayload(payload))
    error = legacyResult.error
  }

  if (error) {
    console.error(error)
    throw new Error(error.message || (input.id ? "Failed to update venue" : "Failed to create venue"))
  }

  revalidateVenuePaths()
}

export async function deleteVenue(id: string) {
  await assertCanManageVenues()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { count, error: bookingCountError } = await supabase
    .from("venue_bookings")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("venue_id", id)

  if (bookingCountError && bookingCountError.code !== "42P01") {
    console.error(bookingCountError)
    throw new Error("Failed to check venue bookings")
  }

  if ((count ?? 0) > 0) {
    throw new Error("This venue has bookings and cannot be deleted.")
  }

  const { error } = await supabase
    .from("venues")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error(error.message || "Failed to delete venue")
  }

  revalidateVenuePaths()
}
