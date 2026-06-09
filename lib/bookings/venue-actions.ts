"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"

import {
  normalizeVenueStatus,
  normalizeVenueUsageTag,
  parseAmenities,
  VENUE_STATUSES,
  type VenueStatus,
  type VenueUsageTag,
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
  usage_tag?: VenueUsageTag
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
    usage_tag: normalizeVenueUsageTag(input.usage_tag),
    availability_start: input.availability_start?.trim() || null,
    availability_end: input.availability_end?.trim() || null,
    amenities: parseAmenities(input.amenities),
    status,
  }
}

function revalidateVenuePaths() {
  revalidatePath("/facilities/settings/spaces")
  revalidatePath("/facilities/settings")
  revalidatePath("/facilities/calendar")
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

  if (input.id) {
    const { error } = await supabase
      .from("venues")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      throw new Error(error.message || "Failed to update venue")
    }
  } else {
    const { error } = await supabase.from("venues").insert({
      organization_id: organizationId,
      ...payload,
    })

    if (error) {
      console.error(error)
      throw new Error(error.message || "Failed to create venue")
    }
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
