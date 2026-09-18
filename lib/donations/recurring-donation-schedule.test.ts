import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildRecurringPlanSchedule,
  lastRecurringDateFromCount,
  paymentCountFromLastRecurringDate,
} from "./recurring-donation-schedule"

describe("recurring plan schedule", () => {
  it("computes the last payment from installment count", () => {
    assert.equal(lastRecurringDateFromCount("2026-09-18", "monthly", 12), "2027-08-18")
  })

  it("computes installment count from an end date", () => {
    assert.equal(paymentCountFromLastRecurringDate("2026-09-18", "monthly", "2027-08-18"), 12)
  })

  it("requires installments or an end date", () => {
    const result = buildRecurringPlanSchedule({
      frequency: "monthly",
      startDate: "2026-09-18",
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.error, /installments or an end date/i)
    }
  })

  it("writes schedule fields from installment count", () => {
    const result = buildRecurringPlanSchedule({
      frequency: "monthly",
      startDate: "2026-09-18",
      numberOfPayments: 12,
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.totalPayments, 12)
      assert.equal(result.endDate, "2027-08-18")
    }
  })
})
