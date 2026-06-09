/**
 * Venue Rentals transition safety (Phase A → Phase B).
 *
 * ## Migration / transition strategy
 *
 * 1. **Legacy path (unchanged until Phase B UI cutover)**
 *    - Customer/staff pages under `venue_bookings` continue to work.
 *    - Sync: `venue_bookings` → `resource_reservations` (`source_type = 'venue_rental'`, `source_id = venue_bookings.id`).
 *
 * 2. **New path (Phase B customer flow)**
 *    - `submitVenueRentalRequest` writes ONLY:
 *      `venue_rentals` → `rental_reservations` → `resource_reservations` (DB sync trigger).
 *    - Must NEVER insert into `venue_bookings`.
 *
 * 3. **No dual-write**
 *    - Do not create both a `venue_bookings` row and a `venue_rentals` row for the same rental.
 *    - Staff migration links one legacy booking to one rental via `legacy_venue_booking_id` (unique).
 *    - When migrating, cancel the legacy `venue_bookings` row first so its sync removes the old block
 *      before the new `rental_reservations` sync creates the replacement block.
 *
 * 4. **Monitoring**
 *    - Run `getDuplicateVenueRentalBlockReport()` during transition to find overlapping
 *      `resource_reservations` rows with different `source_id` values (legacy + new double-blocks).
 *
 * 5. **Retirement (post Phase B)**
 *    - Stop new `venue_bookings` inserts after customer UI is rewired.
 *    - Migrate historical rows with `importLegacyVenueBookingAsVenueRental`.
 *    - Eventually retire `venue_bookings` (not in this phase).
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { RentalSpaceSlotInput } from "./venue-rental-types"

/** Tables the new Venue Rental workflow is allowed to write (customer + staff rental flow). */
export const NEW_VENUE_RENTAL_WRITE_TABLES = [
  "venue_rentals",
  "rental_reservations",
  "rental_selected_addons",
  "rental_payments",
  "rental_contracts",
] as const

/**
 * Legacy table — still used by existing customer/staff pages until Phase B replacement.
 * New customer Venue Rental flow must NOT insert here.
 */
export const LEGACY_VENUE_BOOKING_TABLE = "venue_bookings" as const

export const VENUE_RENTAL_SYNC_ORIGINS = {
  legacyVenueBooking: "legacy_venue_booking",
  venueRentalReservation: "venue_rental_reservation",
} as const

export type VenueRentalReservationSyncOrigin =
  (typeof VENUE_RENTAL_SYNC_ORIGINS)[keyof typeof VENUE_RENTAL_SYNC_ORIGINS]

export class VenueRentalTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VenueRentalTransitionError"
  }
}

/** Pure guard — throws when a legacy booking is already linked to a venue rental. */
export function assertLegacyVenueBookingNotAlreadyLinked(input: {
  legacyVenueBookingId: string
  existingVenueRentalId: string | null | undefined
}): void {
  if (input.existingVenueRentalId) {
    throw new VenueRentalTransitionError(
      `Legacy venue booking ${input.legacyVenueBookingId} is already linked to venue rental ${input.existingVenueRentalId}. ` +
        "Do not create a second venue_rentals row for the same legacy booking."
    )
  }
}

export function classifyReservationSyncOrigin(input: {
  sourceId: string | null
  metadataSyncOrigin?: string | null
  legacyVenueBookingSourceIds: ReadonlySet<string>
  rentalReservationSourceIds: ReadonlySet<string>
}): VenueRentalReservationSyncOrigin | "unknown" {
  const fromMetadata = input.metadataSyncOrigin?.trim()
  if (
    fromMetadata === VENUE_RENTAL_SYNC_ORIGINS.legacyVenueBooking ||
    fromMetadata === VENUE_RENTAL_SYNC_ORIGINS.venueRentalReservation
  ) {
    return fromMetadata
  }

  if (!input.sourceId) {
    return "unknown"
  }

  if (input.rentalReservationSourceIds.has(input.sourceId)) {
    return VENUE_RENTAL_SYNC_ORIGINS.venueRentalReservation
  }

  if (input.legacyVenueBookingSourceIds.has(input.sourceId)) {
    return VENUE_RENTAL_SYNC_ORIGINS.legacyVenueBooking
  }

  return "unknown"
}

export function isLegacyNewDuplicatePair(
  originA: VenueRentalReservationSyncOrigin | "unknown",
  originB: VenueRentalReservationSyncOrigin | "unknown"
): boolean {
  return (
    (originA === VENUE_RENTAL_SYNC_ORIGINS.legacyVenueBooking &&
      originB === VENUE_RENTAL_SYNC_ORIGINS.venueRentalReservation) ||
    (originA === VENUE_RENTAL_SYNC_ORIGINS.venueRentalReservation &&
      originB === VENUE_RENTAL_SYNC_ORIGINS.legacyVenueBooking)
  )
}

/** Convert legacy venue_bookings date/time fields to a rental_reservations slot. */
export function legacyVenueBookingToSpaceSlot(input: {
  venueId: string
  eventDate: string
  startTime: string | null
  endTime: string | null
}): RentalSpaceSlotInput {
  const startTime = normalizeLegacyTime(input.startTime, "09:00")
  const endTime = normalizeLegacyTime(input.endTime, "10:00")

  let startAt = `${input.eventDate}T${startTime}:00.000Z`
  let endAt = `${input.eventDate}T${endTime}:00.000Z`

  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    endAt = new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString()
  } else {
    startAt = new Date(startAt).toISOString()
    endAt = new Date(endAt).toISOString()
  }

  return {
    venueId: input.venueId,
    startAt,
    endAt,
  }
}

function normalizeLegacyTime(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    return fallback
  }

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5)
  }

  return fallback
}

type LegacyLinkQueryClient = Pick<SupabaseClient, "from">

/**
 * DB guard: refuse to create another venue_rentals row for a legacy booking that is already linked.
 */
export async function assertLegacyVenueBookingAvailableForMigration(
  supabase: LegacyLinkQueryClient,
  organizationId: string,
  legacyVenueBookingId: string
): Promise<void> {
  const { data: linkedRental, error: linkError } = await supabase
    .from("venue_rentals")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("legacy_venue_booking_id", legacyVenueBookingId)
    .maybeSingle()

  if (linkError) {
    throw new VenueRentalTransitionError("Failed to verify legacy venue booking link.")
  }

  assertLegacyVenueBookingNotAlreadyLinked({
    legacyVenueBookingId,
    existingVenueRentalId: linkedRental?.id as string | undefined,
  })

  const { data: legacyBooking, error: legacyError } = await supabase
    .from("venue_bookings")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", legacyVenueBookingId)
    .maybeSingle()

  if (legacyError) {
    throw new VenueRentalTransitionError("Failed to load legacy venue booking.")
  }

  if (!legacyBooking) {
    throw new VenueRentalTransitionError("Legacy venue booking not found for this organization.")
  }
}
