import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isFreeOfferingFeePlan,
  isPaymentSummaryEnrollment,
  enrollmentShowsContact,
} from "./payment-summary-report-helpers"

describe("payment summary enrollments", () => {
  it("treats free fee plans as free courses", () => {
    assert.equal(isFreeOfferingFeePlan({ planType: "free", tuition: 0 }), true)
    assert.equal(isFreeOfferingFeePlan({ planType: "installments", tuition: 0 }), true)
    assert.equal(
      isFreeOfferingFeePlan({ planType: "installments", tuition: 450 }),
      false
    )
  })

  it("omits free courses and complimentary $0 enrollments", () => {
    assert.equal(
      isPaymentSummaryEnrollment({
        offeringIsFree: true,
        paymentRequired: false,
        totalAmount: 0,
        amountPaid: 0,
      }),
      false
    )
    assert.equal(
      isPaymentSummaryEnrollment({
        offeringIsFree: false,
        paymentRequired: false,
        totalAmount: 0,
        amountPaid: 0,
        chargeTotal: 0,
      }),
      false
    )
    assert.equal(
      isPaymentSummaryEnrollment({
        offeringIsFree: false,
        paymentRequired: true,
        totalAmount: 225,
        amountPaid: 25,
        chargeTotal: 225,
      }),
      true
    )
    assert.equal(
      isPaymentSummaryEnrollment({
        offeringIsFree: false,
        paymentRequired: true,
        totalAmount: 0,
        amountPaid: 0,
        chargeTotal: 0,
      }),
      true
    )
    assert.equal(
      isPaymentSummaryEnrollment({
        offeringIsFree: true,
        paymentRequired: false,
        totalAmount: 450,
        amountPaid: 50,
        chargeTotal: 450,
      }),
      true
    )
  })
})

describe("payment summary contact column", () => {
  it("hides contact for a self-registered adult", () => {
    assert.equal(
      enrollmentShowsContact({
        childPersonId: null,
        participantContactId: "adult-1",
        registrantContactId: "adult-1",
      }),
      false
    )
  })

  it("shows contact for youth and for an adult registered by someone else", () => {
    assert.equal(
      enrollmentShowsContact({
        childPersonId: "child-1",
        participantContactId: null,
        registrantContactId: "parent-1",
      }),
      true
    )
    assert.equal(
      enrollmentShowsContact({
        childPersonId: null,
        participantContactId: "adult-1",
        registrantContactId: "payer-2",
      }),
      true
    )
  })
})
