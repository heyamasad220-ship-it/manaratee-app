import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  capacityCountingEnrollmentStatuses,
  claimApprovedApplicationsForParticipants,
  displayEnrollmentStatus,
  enrollmentStatusForSeatActivation,
  findApprovedApplicationForRegistration,
  isApplicationBasedProgram,
  isApprovedRegistrationPending,
  isRosterEnrollmentStatus,
  normalizeEnrollmentProcess,
  resolveDisplayPaymentStatus,
} from "./enrollment-process"

describe("enrollment process", () => {
  it("maps seasonal programs without a stored process to direct registration", () => {
    assert.equal(normalizeEnrollmentProcess(null, "seasonal"), "direct_registration")
    assert.equal(
      isApplicationBasedProgram({ program_kind: "academic" }),
      true
    )
    assert.equal(
      isApplicationBasedProgram({
        enrollment_process: "direct_registration",
        program_kind: "academic",
      }),
      false
    )
  })

  it("treats enrolled and active as roster seats, not pending checkout", () => {
    assert.equal(isRosterEnrollmentStatus("enrolled"), true)
    assert.equal(isRosterEnrollmentStatus("active"), true)
    assert.equal(isRosterEnrollmentStatus("pending_payment"), false)
    assert.deepEqual(capacityCountingEnrollmentStatuses(false), [
      "enrolled",
      "active",
    ])
    assert.deepEqual(capacityCountingEnrollmentStatuses(true), [
      "enrolled",
      "active",
      "pending",
      "pending_payment",
    ])
  })

  it("keeps payment independent from enrollment display", () => {
    assert.equal(displayEnrollmentStatus("enrolled"), "active")
    assert.equal(displayEnrollmentStatus("pending_payment"), "pending")
    assert.equal(
      resolveDisplayPaymentStatus({
        paymentStatus: "partial",
        totalAmount: 450,
        amountPaid: 150,
      }),
      "balance_due"
    )
    assert.equal(
      resolveDisplayPaymentStatus({
        paymentStatus: "paid",
        totalAmount: 450,
        amountPaid: 450,
      }),
      "paid"
    )
  })

  it("activates a seat on registration by default", () => {
    assert.equal(
      enrollmentStatusForSeatActivation("on_registration", true),
      "enrolled"
    )
    assert.equal(
      enrollmentStatusForSeatActivation("after_initial_payment", true),
      "pending_payment"
    )
  })

  it("treats approved-without-enrollment as registration pending", () => {
    assert.equal(
      isApprovedRegistrationPending({ status: "approved", enrollment_id: null }),
      true
    )
    assert.equal(
      isApprovedRegistrationPending({
        status: "approved",
        enrollment_id: "abc",
      }),
      false
    )
  })

  it("requires an unused approved application for the offering before register", () => {
    const applications = [
      {
        id: "app-1",
        status: "approved",
        enrollment_id: null,
        offering_id: "off-a",
        approved_offering_id: null,
        participant_contact_id: "c-1",
        application_answers: { requested_offering_ids: ["off-a"] },
      },
      {
        id: "app-2",
        status: "submitted",
        enrollment_id: null,
        offering_id: "off-a",
        approved_offering_id: null,
        participant_contact_id: "c-2",
      },
    ]
    assert.equal(
      findApprovedApplicationForRegistration(applications, {
        offeringId: "off-a",
        participantContactId: "c-1",
      })?.id,
      "app-1"
    )
    assert.equal(
      findApprovedApplicationForRegistration(applications, {
        offeringId: "off-b",
      }),
      null
    )
    const claimed = claimApprovedApplicationsForParticipants(applications, {
      offeringId: "off-a",
      participants: [{ participantContactId: "c-1" }],
    })
    assert.equal(claimed.ok, true)
    const blocked = claimApprovedApplicationsForParticipants(applications, {
      offeringId: "off-a",
      participants: [
        { participantContactId: "c-1" },
        { participantContactId: "c-2" },
      ],
    })
    assert.equal(blocked.ok, false)
  })
})
