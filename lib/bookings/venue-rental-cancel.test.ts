import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  canStaffCancelVenueRental,
  shouldCancelVenueRentalAfterPayment,
} from "./venue-rental-status"
import { VENUE_RENTAL_STATUSES } from "./venue-rental-types"

describe("venue rental cancellation helpers", () => {
  it("allows cancel for active pre- and post-payment workflow states", () => {
    assert.equal(
      canStaffCancelVenueRental(VENUE_RENTAL_STATUSES.awaitingSupervisorApproval),
      true
    )
    assert.equal(
      canStaffCancelVenueRental(VENUE_RENTAL_STATUSES.approvedPendingPayment),
      true
    )
    assert.equal(canStaffCancelVenueRental(VENUE_RENTAL_STATUSES.confirmed), true)
  })

  it("blocks cancel for terminal and refund workflow states", () => {
    assert.equal(canStaffCancelVenueRental(VENUE_RENTAL_STATUSES.declined), false)
    assert.equal(
      canStaffCancelVenueRental(VENUE_RENTAL_STATUSES.cancelledBeforePayment),
      false
    )
    assert.equal(
      canStaffCancelVenueRental(
        VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval
      ),
      false
    )
    assert.equal(
      canStaffCancelVenueRental(VENUE_RENTAL_STATUSES.securityDepositRefunded),
      false
    )
  })

  it("infers after-payment cancellation from status and recorded payments", () => {
    assert.equal(
      shouldCancelVenueRentalAfterPayment({
        status: VENUE_RENTAL_STATUSES.approvedPendingPayment,
      }),
      false
    )
    assert.equal(
      shouldCancelVenueRentalAfterPayment({
        status: VENUE_RENTAL_STATUSES.confirmed,
      }),
      true
    )
    assert.equal(
      shouldCancelVenueRentalAfterPayment({
        status: VENUE_RENTAL_STATUSES.approvedPendingPayment,
        depositPaid: true,
      }),
      true
    )
  })
})
