import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  formatChargeFailureCard,
  formatChargeFailureKind,
  formatChargeFailureReason,
} from "./charge-failure-reason"

describe("charge failure reasons", () => {
  it("labels the bank decline codes staff need to see", () => {
    assert.equal(formatChargeFailureReason({ declineCode: "insufficient_funds" }), "Insufficient funds")
    assert.equal(formatChargeFailureReason({ declineCode: "expired_card" }), "Card expired")
    assert.equal(formatChargeFailureReason({ failureCode: "incorrect_number" }), "Incorrect card number")
    assert.equal(formatChargeFailureReason({ failureMessage: "Your card was declined." }), "Your card was declined.")
    assert.equal(formatChargeFailureReason({}), "Card declined")
  })

  it("formats the card and the charge kind", () => {
    assert.equal(formatChargeFailureCard({ brand: "visa", last4: "4242" }), "Visa •••• 4242")
    assert.equal(formatChargeFailureCard({}), null)
    assert.equal(formatChargeFailureKind("recurring"), "Recurring donation")
    assert.equal(formatChargeFailureKind("pledge"), "Pledge")
    assert.equal(formatChargeFailureKind("one_time"), "One-time donation")
  })
})
