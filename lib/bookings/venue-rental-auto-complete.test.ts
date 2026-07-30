import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  groupVenueRentalIdsByOrganization,
  selectPastEventRentals,
  VENUE_RENTAL_AUTO_COMPLETE_STATUSES,
} from "./venue-rental-auto-complete"
import { VENUE_RENTAL_STATUSES } from "./venue-rental-types"

describe("venue rental auto-complete", () => {
  it("only targets confirmed (and legacy confirmed) statuses", () => {
    assert.deepEqual(VENUE_RENTAL_AUTO_COMPLETE_STATUSES, [
      VENUE_RENTAL_STATUSES.confirmed,
      VENUE_RENTAL_STATUSES.depositPaid,
      VENUE_RENTAL_STATUSES.securityDepositPaid,
    ])
    assert.equal(
      VENUE_RENTAL_AUTO_COMPLETE_STATUSES.includes(
        VENUE_RENTAL_STATUSES.approvedPendingPayment
      ),
      false
    )
  })

  it("selects rentals whose latest slot end has passed", () => {
    const now = new Date("2026-06-15T12:00:00.000Z")

    const selected = selectPastEventRentals(
      [
        {
          id: "past",
          organization_id: "org-1",
          status: VENUE_RENTAL_STATUSES.confirmed,
          latestEndAt: "2026-06-15T11:00:00.000Z",
        },
        {
          id: "future",
          organization_id: "org-1",
          status: VENUE_RENTAL_STATUSES.confirmed,
          latestEndAt: "2026-06-15T13:00:00.000Z",
        },
        {
          id: "approved",
          organization_id: "org-1",
          status: VENUE_RENTAL_STATUSES.approvedPendingPayment,
          latestEndAt: "2026-06-15T10:00:00.000Z",
        },
        {
          id: "legacy-deposit",
          organization_id: "org-1",
          status: VENUE_RENTAL_STATUSES.depositPaid,
          latestEndAt: "2026-06-14T22:00:00.000Z",
        },
      ],
      now
    )

    assert.deepEqual(
      selected.map((row) => row.id).sort(),
      ["legacy-deposit", "past"]
    )
  })

  it("groups candidates by organization", () => {
    const grouped = groupVenueRentalIdsByOrganization([
      { id: "a", organization_id: "org-1" },
      { id: "b", organization_id: "org-2" },
      { id: "c", organization_id: "org-1" },
    ])

    assert.deepEqual(grouped, {
      "org-1": ["a", "c"],
      "org-2": ["b"],
    })
  })
})
