import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  formatStaffPayRate,
  parseStaffPayBasis,
} from "./staff-pay-basis"

describe("staff pay basis", () => {
  it("parses unpaid without treating it as hourly", () => {
    assert.equal(parseStaffPayBasis("unpaid"), "unpaid")
    assert.equal(parseStaffPayBasis("monthly"), "monthly")
    assert.equal(parseStaffPayBasis("hourly"), "hourly")
    assert.equal(parseStaffPayBasis(null), "hourly")
  })

  it("formats unpaid as Unpaid even when a rate is saved", () => {
    assert.equal(
      formatStaffPayRate({
        payBasis: "unpaid",
        hourlyRate: 20,
        monthlySalary: null,
      }),
      "Unpaid"
    )
  })
})
