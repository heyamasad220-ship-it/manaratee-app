"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import {
  deriveLegacyPricingFromDaySchedule,
  formScheduleToInput,
  type VenueDayScheduleFormRow,
  type VenueDayScheduleInput,
} from "@/lib/bookings/venue-day-pricing"

import {
  normalizeVenueColor,
  normalizeVenueStatus,
  parseAmenities,
  VENUE_STATUSES,
  type VenueStatus,
} from "./venue-types"
import { clampBufferMinutes } from "./venue-rental-buffers"

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
  color?: string | null
  flyer_url?: string | null
  /** null = inherit org default; omit to leave unchanged is not supported — always pass. */
  setup_minutes?: number | null
  cleanup_minutes?: number | null
  daySchedule?: VenueDayScheduleFormRow[] | VenueDayScheduleInput[]
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

function normalizeOptionalBufferMinutes(
  value: number | null | undefined
): number | null {
  if (value == null) return null
  return clampBufferMinutes(value)
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
    color: normalizeVenueColor(input.color),
    flyer_url: input.flyer_url?.trim() || null,
    setup_minutes: normalizeOptionalBufferMinutes(input.setup_minutes),
    cleanup_minutes: normalizeOptionalBufferMinutes(input.cleanup_minutes),
  }
}

function toLegacyVenuePayload(payload: ReturnType<typeof validateVenueInput>) {
  const {
    peak_flat_price: _peakFlat,
    peak_hourly_rate: _peakHourly,
    available_for_bookings: _availableForBookings,
    availability_start: _availabilityStart,
    availability_end: _availabilityEnd,
    color: _color,
    flyer_url: _flyerUrl,
    setup_minutes: _setupMinutes,
    cleanup_minutes: _cleanupMinutes,
    ...legacy
  } = payload

  return legacy
}

/** Drop color/flyer when migration 204 has not been applied yet. */
function toPayloadWithoutBranding(payload: ReturnType<typeof validateVenueInput>) {
  const { color: _color, flyer_url: _flyerUrl, ...rest } = payload
  return rest
}

/** Drop buffer columns when migration 222 has not been applied yet. */
function toPayloadWithoutBuffers(payload: ReturnType<typeof validateVenueInput>) {
  const { setup_minutes: _setup, cleanup_minutes: _cleanup, ...rest } = payload
  return rest
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
    message.includes("flyer_url") ||
    message.includes("'color'") ||
    message.includes('"color"') ||
    message.includes("venues.color") ||
    message.includes("column \"color\"") ||
    message.includes("setup_minutes") ||
    message.includes("cleanup_minutes") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  )
}

function isMissingBrandingColumnError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ""
  return (
    message.includes("flyer_url") ||
    message.includes("'color'") ||
    message.includes('"color"') ||
    message.includes("venues.color") ||
    (message.includes("color") && message.includes("venues"))
  )
}

function isMissingBufferColumnError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ""
  return (
    message.includes("setup_minutes") ||
    message.includes("cleanup_minutes")
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

function normalizeDayScheduleInput(
  schedule: UpsertVenueInput["daySchedule"]
): VenueDayScheduleInput[] | null {
  if (!schedule?.length) return null
  if ("flatPrice" in schedule[0] && typeof (schedule[0] as VenueDayScheduleFormRow).flatPrice === "string") {
    return formScheduleToInput(schedule as VenueDayScheduleFormRow[])
  }
  return schedule as VenueDayScheduleInput[]
}

function toPgTime(value: string) {
  const trimmed = value.trim()
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(":")
    return `${hours.padStart(2, "0")}:${minutes}:00`
  }
  if (/^\d{1,2}:\d{2}:\d{2}/.test(trimmed)) {
    const [hours, minutes, seconds] = trimmed.split(":")
    return `${hours.padStart(2, "0")}:${minutes}:${seconds.slice(0, 2)}`
  }
  return trimmed
}

function validateOpenDayTimes(rows: VenueDayScheduleInput[]) {
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]
  for (const row of rows) {
    if (!row.open) continue
    const start = toPgTime(row.startTime)
    const end = toPgTime(row.endTime)
    if (!row.startTime || !row.endTime) {
      throw new Error(`Set hours for ${dayNames[row.dayOfWeek]}.`)
    }
    if (end <= start) {
      throw new Error(`End time must be after start time for ${dayNames[row.dayOfWeek]}.`)
    }
  }
}

export async function upsertVenue(input: UpsertVenueInput) {
  await assertCanManageVenues()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const daySchedule = normalizeDayScheduleInput(input.daySchedule)
  if (daySchedule) {
    validateOpenDayTimes(daySchedule)
  }

  const legacyFromDays = daySchedule ? deriveLegacyPricingFromDaySchedule(daySchedule) : null
  const payload = validateVenueInput({
    ...input,
    ...(legacyFromDays
      ? {
          base_price: legacyFromDays.base_price,
          hourly_rate: legacyFromDays.hourly_rate,
          peak_flat_price: legacyFromDays.peak_flat_price,
          peak_hourly_rate: legacyFromDays.peak_hourly_rate,
          availability_start: legacyFromDays.availability_start,
          availability_end: legacyFromDays.availability_end,
        }
      : {}),
  })

  let venueId = input.id || null
  let brandingSkipped = false
  let buffersSkipped = false

  if (input.id) {
    let { error } = await supabase
      .from("venues")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", organizationId)

    if (error && isMissingBufferColumnError(error)) {
      buffersSkipped = true
      const withoutBuffers = await supabase
        .from("venues")
        .update(toPayloadWithoutBuffers(payload))
        .eq("id", input.id)
        .eq("organization_id", organizationId)
      error = withoutBuffers.error
    }

    if (error && isMissingBrandingColumnError(error)) {
      brandingSkipped = true
      const withoutBranding = await supabase
        .from("venues")
        .update(toPayloadWithoutBranding(payload))
        .eq("id", input.id)
        .eq("organization_id", organizationId)
      error = withoutBranding.error

      if (error && isMissingBufferColumnError(error)) {
        buffersSkipped = true
        const withoutBoth = await supabase
          .from("venues")
          .update(toPayloadWithoutBuffers(toPayloadWithoutBranding(payload)))
          .eq("id", input.id)
          .eq("organization_id", organizationId)
        error = withoutBoth.error
      }
    }

    if (error && isMissingVenueColumnError(error)) {
      brandingSkipped = true
      buffersSkipped = true
      const legacyResult = await supabase
        .from("venues")
        .update(toLegacyVenuePayload(payload))
        .eq("id", input.id)
        .eq("organization_id", organizationId)
      error = legacyResult.error
    }

    if (error) {
      console.error(error)
      throw new Error(error.message || "Failed to update venue")
    }
  } else {
    let { data, error } = await supabase
      .from("venues")
      .insert({
        organization_id: organizationId,
        ...payload,
      })
      .select("id")
      .single()

    if (error && isMissingBufferColumnError(error)) {
      buffersSkipped = true
      const withoutBuffers = await supabase
        .from("venues")
        .insert({
          organization_id: organizationId,
          ...toPayloadWithoutBuffers(payload),
        })
        .select("id")
        .single()
      data = withoutBuffers.data
      error = withoutBuffers.error
    }

    if (error && isMissingBrandingColumnError(error)) {
      brandingSkipped = true
      const withoutBranding = await supabase
        .from("venues")
        .insert({
          organization_id: organizationId,
          ...toPayloadWithoutBranding(payload),
        })
        .select("id")
        .single()
      data = withoutBranding.data
      error = withoutBranding.error

      if (error && isMissingBufferColumnError(error)) {
        buffersSkipped = true
        const withoutBoth = await supabase
          .from("venues")
          .insert({
            organization_id: organizationId,
            ...toPayloadWithoutBuffers(toPayloadWithoutBranding(payload)),
          })
          .select("id")
          .single()
        data = withoutBoth.data
        error = withoutBoth.error
      }
    }

    if (error && isMissingVenueColumnError(error)) {
      brandingSkipped = true
      buffersSkipped = true
      const legacyResult = await supabase
        .from("venues")
        .insert({
          organization_id: organizationId,
          ...toLegacyVenuePayload(payload),
        })
        .select("id")
        .single()
      data = legacyResult.data
      error = legacyResult.error
    }

    if (error || !data) {
      console.error(error)
      throw new Error(error?.message || "Failed to create venue")
    }

    venueId = data.id as string
  }

  const brandingWarning = brandingSkipped
    ? "Venue saved, but color/flyer could not be stored. Run scripts/204_venue_color_flyer.sql in the Supabase SQL Editor, then save again."
    : undefined

  const buffersWarning = buffersSkipped
    ? "Venue saved, but setup/cleanup buffers could not be stored. Run scripts/222_venue_rental_setup_cleanup_buffers.sql in the Supabase SQL Editor, then save again."
    : undefined

  if (venueId && daySchedule) {
    try {
      await replaceVenueDayPricing(supabase, organizationId, venueId, daySchedule)
    } catch (pricingError) {
      console.error("Venue day pricing save failed:", pricingError)
      revalidateVenuePaths()
      return {
        id: venueId as string,
        brandingWarning,
        buffersWarning,
        pricingWarning:
          pricingError instanceof Error
            ? pricingError.message
            : "Venue saved, but day hours/rates could not be saved.",
      }
    }
  }

  revalidateVenuePaths()
  return { id: venueId as string, brandingWarning, buffersWarning }
}

async function replaceVenueDayPricing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  venueId: string,
  schedule: VenueDayScheduleInput[]
) {
  const { error: deleteError } = await supabase
    .from("rental_space_pricing")
    .delete()
    .eq("organization_id", organizationId)
    .eq("venue_id", venueId)

  if (deleteError) {
    if (deleteError.code === "42P01") {
      return
    }
    console.error(deleteError)
    throw new Error(deleteError.message || "Failed to update day pricing")
  }

  const rows = schedule
    .filter((row) => row.open)
    .map((row) => ({
      organization_id: organizationId,
      venue_id: venueId,
      day_of_week: row.dayOfWeek,
      start_time: toPgTime(row.startTime),
      end_time: toPgTime(row.endTime),
      flat_price: row.flatPrice,
      hourly_price: row.hourlyPrice,
      is_active: true,
    }))

  if (rows.length === 0) {
    return
  }

  const { error: insertError } = await supabase.from("rental_space_pricing").insert(rows)

  if (insertError) {
    if (insertError.code === "42P01") {
      return
    }
    console.error(insertError)
    throw new Error(
      insertError.message ||
        "Failed to save day pricing. Run scripts/046_venue_rentals_workflow.sql if the pricing table is missing."
    )
  }
}

export async function updateVenueFlyer(input: {
  id: string
  flyerUrl: string | null
}) {
  await assertCanManageVenues()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("venues")
    .update({
      flyer_url: input.flyerUrl?.trim() || null,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error(error.message || "Failed to update venue flyer")
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
