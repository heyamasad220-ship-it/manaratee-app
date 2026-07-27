import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  canStaffForceBookVenueRental,
  summarizeOutstandingRentalPayments,
} from "./venue-rental-status"
import { VENUE_RENTAL_STATUSES } from "./venue-rental-types"

describe("venue rental force-book helpers", () => {
  it("allows force-book only before confirmation", () => {
    assert.equal(
      canStaffForceBookVenueRental(VENUE_RENTAL_STATUSES.awaitingSupervisorApproval),
      true
    )
    assert.equal(
      canStaffForceBookVenueRental(VENUE_RENTAL_STATUSES.approvedPendingPayment),
      true
    )
    assert.equal(canStaffForceBookVenueRental(VENUE_RENTAL_STATUSES.depositPaid), true)
    assert.equal(
      canStaffForceBookVenueRental(VENUE_RENTAL_STATUSES.securityDepositPaid),
      true
    )
  })

  it("blocks force-book for confirmed, terminal, and refund workflow states", () => {
    assert.equal(canStaffForceBookVenueRental(VENUE_RENTAL_STATUSES.confirmed), false)
    assert.equal(canStaffForceBookVenueRental(VENUE_RENTAL_STATUSES.declined), false)
    assert.equal(
      canStaffForceBookVenueRental(VENUE_RENTAL_STATUSES.cancelledBeforePayment),
      false
    )
    assert.equal(canStaffForceBookVenueRental(VENUE_RENTAL_STATUSES.holdExpired), false)
    assert.equal(
      canStaffForceBookVenueRental(
        VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval
      ),
      false
    )
  })

  it("summarizes outstanding payments for acknowledgement", () => {
    const unpaid = summarizeOutstandingRentalPayments({
      depositPaid: false,
      securityDepositPaid: false,
    })

    assert.equal(unpaid.requiresPaymentAcknowledgement, true)
    assert.deepEqual(unpaid.outstandingLabels, [
      "Deposit (required to confirm)",
    ])

    const paid = summarizeOutstandingRentalPayments({
      depositPaid: true,
      securityDepositPaid: true,
      remainingBalanceDue: true,
      remainingPaid: false,
    })

    assert.equal(paid.requiresPaymentAcknowledgement, true)
    assert.deepEqual(paid.outstandingLabels, ["Remaining balance"])
  })
})
