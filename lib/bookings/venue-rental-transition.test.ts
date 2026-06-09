import assert from "node:assert/strict"
import { test } from "node:test"

import {
  assertLegacyVenueBookingNotAlreadyLinked,
  classifyReservationSyncOrigin,
  isLegacyNewDuplicatePair,
  VENUE_RENTAL_SYNC_ORIGINS,
  VenueRentalTransitionError,
} from "./venue-rental-transition"

test("assertLegacyVenueBookingNotAlreadyLinked rejects duplicate links", () => {
  assert.throws(
    () =>
      assertLegacyVenueBookingNotAlreadyLinked({
        legacyVenueBookingId: "booking-1",
        existingVenueRentalId: "rental-1",
      }),
    VenueRentalTransitionError
  )

  assert.doesNotThrow(() =>
    assertLegacyVenueBookingNotAlreadyLinked({
      legacyVenueBookingId: "booking-1",
      existingVenueRentalId: null,
    })
  )
})

test("classifyReservationSyncOrigin prefers metadata then table membership", () => {
  const legacyIds = new Set(["legacy-1"])
  const rentalIds = new Set(["rental-res-1"])

  assert.equal(
    classifyReservationSyncOrigin({
      sourceId: "legacy-1",
      metadataSyncOrigin: VENUE_RENTAL_SYNC_ORIGINS.legacyVenueBooking,
      legacyVenueBookingSourceIds: legacyIds,
      rentalReservationSourceIds: rentalIds,
    }),
    VENUE_RENTAL_SYNC_ORIGINS.legacyVenueBooking
  )

  assert.equal(
    classifyReservationSyncOrigin({
      sourceId: "rental-res-1",
      metadataSyncOrigin: null,
      legacyVenueBookingSourceIds: legacyIds,
      rentalReservationSourceIds: rentalIds,
    }),
    VENUE_RENTAL_SYNC_ORIGINS.venueRentalReservation
  )
})

test("isLegacyNewDuplicatePair detects mixed legacy/new origins", () => {
  assert.equal(
    isLegacyNewDuplicatePair(
      VENUE_RENTAL_SYNC_ORIGINS.legacyVenueBooking,
      VENUE_RENTAL_SYNC_ORIGINS.venueRentalReservation
    ),
    true
  )

  assert.equal(
    isLegacyNewDuplicatePair(
      VENUE_RENTAL_SYNC_ORIGINS.legacyVenueBooking,
      VENUE_RENTAL_SYNC_ORIGINS.legacyVenueBooking
    ),
    false
  )
})
