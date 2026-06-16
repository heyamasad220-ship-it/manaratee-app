import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  groupVenueRentalIdsByOrganization,
  selectExpiredHoldRentals,
  VENUE_RENTAL_HOLD_PAYMENT_STATUSES,
} from "./venue-rental-hold-expiry"
import { VENUE_RENTAL_STATUSES } from "./venue-rental-types"

describe("venue rental hold expiry", () => {
  it("only targets hold-payment workflow statuses", () => {
    assert.deepEqual(VENUE_RENTAL_HOLD_PAYMENT_STATUSES, [
      VENUE_RENTAL_STATUSES.approvedPendingPayment,
      VENUE_RENTAL_STATUSES.depositPaid,
      VENUE_RENTAL_STATUSES.securityDepositPaid,
    ])
    assert.equal(
      VENUE_RENTAL_HOLD_PAYMENT_STATUSES.includes(VENUE_RENTAL_STATUSES.confirmed),
      false
    )
  })

  it("selects only elapsed holds in hold-payment statuses", () => {
    const now = new Date("2026-06-15T12:00:00.000Z")

    const selected = selectExpiredHoldRentals(
      [
        {
          id: "expired",
          organization_id: "org-1",
          status: VENUE_RENTAL_STATUSES.approvedPendingPayment,
          hold_expires_at: "2026-06-15T11:00:00.000Z",
        },
        {
          id: "active-hold",
          organization_id: "org-1",
          status: VENUE_RENTAL_STATUSES.approvedPendingPayment,
          hold_expires_at: "2026-06-15T13:00:00.000Z",
        },
        {
          id: "confirmed",
          organization_id: "org-1",
          status: VENUE_RENTAL_STATUSES.confirmed,
          hold_expires_at: "2026-06-15T10:00:00.000Z",
        },
      ],
      now
    )

    assert.equal(selected.length, 1)
    assert.equal(selected[0]?.id, "expired")
  })

  it("groups expired rentals by organization for isolated updates", () => {
    const grouped = groupVenueRentalIdsByOrganization([
      {
        id: "a",
        organization_id: "org-1",
        status: VENUE_RENTAL_STATUSES.approvedPendingPayment,
        hold_expires_at: "2026-06-15T11:00:00.000Z",
      },
      {
        id: "b",
        organization_id: "org-2",
        status: VENUE_RENTAL_STATUSES.depositPaid,
        hold_expires_at: "2026-06-15T11:00:00.000Z",
      },
      {
        id: "c",
        organization_id: "org-1",
        status: VENUE_RENTAL_STATUSES.securityDepositPaid,
        hold_expires_at: "2026-06-15T11:00:00.000Z",
      },
    ])

    assert.deepEqual(grouped, {
      "org-1": ["a", "c"],
      "org-2": ["b"],
    })
  })
})
