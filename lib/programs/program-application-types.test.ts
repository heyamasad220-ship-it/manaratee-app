import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  applicationStatusChipFor,
  canWithdrawProgramApplication,
  withdrawProgramApplicationBlockReason,
} from "./program-application-types"

describe("program application withdraw", () => {
  it("allows withdraw before registration", () => {
    assert.equal(canWithdrawProgramApplication({ status: "submitted" }), true)
    assert.equal(
      canWithdrawProgramApplication({ status: "evaluation_completed" }),
      true
    )
    assert.equal(
      canWithdrawProgramApplication({ status: "approved", enrollment_id: null }),
      true
    )
    assert.equal(canWithdrawProgramApplication({ status: "waitlisted" }), true)
  })

  it("blocks withdraw after register, decline, or an existing withdraw", () => {
    assert.equal(
      canWithdrawProgramApplication({
        status: "approved",
        enrollment_id: "enr-1",
      }),
      false
    )
    assert.equal(canWithdrawProgramApplication({ status: "declined" }), false)
    assert.equal(canWithdrawProgramApplication({ status: "withdrawn" }), false)
    assert.match(
      withdrawProgramApplicationBlockReason({
        status: "approved",
        enrollment_id: "enr-1",
      }) || "",
      /Registrations/
    )
  })

  it("maps withdrawn onto its own filter chip", () => {
    assert.equal(applicationStatusChipFor("withdrawn"), "withdrawn")
    assert.equal(applicationStatusChipFor("submitted"), "evaluation")
  })
})
