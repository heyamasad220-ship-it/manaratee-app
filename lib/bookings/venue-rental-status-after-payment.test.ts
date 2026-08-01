import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveVenueRentalStatusAfterPayments } from "./venue-rental-status"
import { VENUE_RENTAL_STATUSES } from "./venue-rental-types"

test("resolves confirmed when deposit is paid", () => {
  assert.equal(
    resolveVenueRentalStatusAfterPayments({
      previousStatus: VENUE_RENTAL_STATUSES.approvedPendingPayment,
      paidPaymentTypes: ["deposit"],
    }),
    VENUE_RENTAL_STATUSES.confirmed
  )
})

test("resolves confirmed when final payment is paid while Approved", () => {
  assert.equal(
    resolveVenueRentalStatusAfterPayments({
      previousStatus: VENUE_RENTAL_STATUSES.approvedPendingPayment,
      paidPaymentTypes: ["remaining_balance", "discount"],
    }),
    VENUE_RENTAL_STATUSES.confirmed
  )
})

test("resolves confirmed when installment is paid while Approved", () => {
  assert.equal(
    resolveVenueRentalStatusAfterPayments({
      previousStatus: VENUE_RENTAL_STATUSES.approvedPendingPayment,
      paidPaymentTypes: ["installment"],
    }),
    VENUE_RENTAL_STATUSES.confirmed
  )
})

test("resolves confirmed when add-on or cleaning fee is paid while Approved", () => {
  assert.equal(
    resolveVenueRentalStatusAfterPayments({
      previousStatus: VENUE_RENTAL_STATUSES.approvedPendingPayment,
      paidPaymentTypes: ["addon_fee"],
    }),
    VENUE_RENTAL_STATUSES.confirmed
  )
  assert.equal(
    resolveVenueRentalStatusAfterPayments({
      previousStatus: VENUE_RENTAL_STATUSES.approvedPendingPayment,
      paidPaymentTypes: ["cleaning_fee"],
    }),
    VENUE_RENTAL_STATUSES.confirmed
  )
})

test("does not confirm on discount or credit alone", () => {
  assert.equal(
    resolveVenueRentalStatusAfterPayments({
      previousStatus: VENUE_RENTAL_STATUSES.approvedPendingPayment,
      paidPaymentTypes: ["discount", "credit"],
    }),
    VENUE_RENTAL_STATUSES.approvedPendingPayment
  )
})

test("does not confirm on security deposit alone", () => {
  assert.equal(
    resolveVenueRentalStatusAfterPayments({
      previousStatus: VENUE_RENTAL_STATUSES.approvedPendingPayment,
      paidPaymentTypes: ["security_deposit"],
    }),
    VENUE_RENTAL_STATUSES.approvedPendingPayment
  )
})

test("does not regress completed or cancelled statuses", () => {
  assert.equal(
    resolveVenueRentalStatusAfterPayments({
      previousStatus: VENUE_RENTAL_STATUSES.completed,
      paidPaymentTypes: ["deposit"],
    }),
    VENUE_RENTAL_STATUSES.completed
  )
  assert.equal(
    resolveVenueRentalStatusAfterPayments({
      previousStatus: VENUE_RENTAL_STATUSES.cancelledAfterPayment,
      paidPaymentTypes: [],
    }),
    VENUE_RENTAL_STATUSES.cancelledAfterPayment
  )
})
