import assert from "node:assert/strict"
import { test } from "node:test"

import {
  assertNoReservationConflicts,
  findConflictingReservations,
  reservationStatusBlocksBooking,
  reservationsConflict,
} from "./reservation-conflict-rules"

test("reservationStatusBlocksBooking respects blocking and non-blocking statuses", () => {
  assert.equal(reservationStatusBlocksBooking("temporary_hold"), true)
  assert.equal(reservationStatusBlocksBooking("confirmed"), true)
  assert.equal(reservationStatusBlocksBooking("blocked"), true)
  assert.equal(reservationStatusBlocksBooking("cancelled"), false)
  assert.equal(reservationStatusBlocksBooking("expired"), false)
})

test("reservationsConflict detects same-venue overlap", () => {
  const a = {
    id: "a",
    venueId: "space-1",
    startAt: "2026-06-01T14:00:00.000Z",
    endAt: "2026-06-01T16:00:00.000Z",
    status: "temporary_hold",
  }
  const b = {
    id: "b",
    venueId: "space-1",
    startAt: "2026-06-01T15:00:00.000Z",
    endAt: "2026-06-01T17:00:00.000Z",
    status: "confirmed",
  }

  assert.equal(reservationsConflict(a, b), true)
})

test("reservationsConflict ignores different venues", () => {
  const a = {
    id: "a",
    venueId: "space-1",
    startAt: "2026-06-01T14:00:00.000Z",
    endAt: "2026-06-01T16:00:00.000Z",
    status: "confirmed",
  }
  const b = {
    id: "b",
    venueId: "space-2",
    startAt: "2026-06-01T14:00:00.000Z",
    endAt: "2026-06-01T16:00:00.000Z",
    status: "confirmed",
  }

  assert.equal(reservationsConflict(a, b), false)
})

test("assertNoReservationConflicts throws on overlap", () => {
  const candidate = {
    id: "new",
    venueId: "space-1",
    startAt: "2026-06-01T14:00:00.000Z",
    endAt: "2026-06-01T16:00:00.000Z",
    status: "temporary_hold",
  }

  assert.throws(() =>
    assertNoReservationConflicts([candidate], [
      {
        id: "existing",
        venueId: "space-1",
        startAt: "2026-06-01T15:00:00.000Z",
        endAt: "2026-06-01T17:00:00.000Z",
        status: "confirmed",
      },
    ])
  )
})

test("findConflictingReservations returns matches only", () => {
  const matches = findConflictingReservations(
    {
      id: "new",
      venueId: "space-1",
      startAt: "2026-06-01T14:00:00.000Z",
      endAt: "2026-06-01T16:00:00.000Z",
      status: "temporary_hold",
    },
    [
      {
        id: "blocked",
        venueId: "space-1",
        startAt: "2026-06-01T15:00:00.000Z",
        endAt: "2026-06-01T17:00:00.000Z",
        status: "cancelled",
      },
      {
        id: "hit",
        venueId: "space-1",
        startAt: "2026-06-01T15:00:00.000Z",
        endAt: "2026-06-01T17:00:00.000Z",
        status: "confirmed",
      },
    ]
  )

  assert.equal(matches.length, 1)
  assert.equal(matches[0]?.id, "hit")
})
