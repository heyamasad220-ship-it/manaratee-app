import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildPledgePlanWriteFields,
  lastPaymentDateFromCount,
  paymentCountFromLastDate,
} from "./pledge-payment-plan"

describe("monthly pledge schedule", () => {
  it("computes the last payment from installment count", () => {
    assert.equal(lastPaymentDateFromCount("2026-09-18", "monthly", 12), "2027-08-18")
  })

  it("computes installment count from an end date", () => {
    assert.equal(paymentCountFromLastDate("2026-09-18", "monthly", "2027-08-18"), 12)
  })

  it("requires installments or an end date for monthly pledges", () => {
    const result = buildPledgePlanWriteFields({
      frequency: "Monthly",
      amountPledged: 1200,
      firstPaymentDate: "2026-09-18",
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.error, /installments or an end date/i)
    }
  })

  it("writes plan columns from installment count", () => {
    const result = buildPledgePlanWriteFields({
      frequency: "Monthly",
      amountPledged: 1200,
      firstPaymentDate: "2026-09-18",
      numberOfPayments: 12,
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.fields.frequency, "monthly")
      assert.equal(result.fields.total_payments, 12)
      assert.equal(result.fields.installment_amount, 100)
      assert.equal(result.fields.first_payment_date, "2026-09-18")
    }
  })

  it("writes plan columns from an end date", () => {
    const result = buildPledgePlanWriteFields({
      frequency: "Monthly",
      amountPledged: 1200,
      firstPaymentDate: "2026-09-18",
      endDate: "2027-08-18",
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.fields.total_payments, 12)
      assert.equal(result.fields.installment_amount, 100)
    }
  })

  it("clears plan columns for a one-time pledge", () => {
    const result = buildPledgePlanWriteFields({
      frequency: "One-Time",
      amountPledged: 1000,
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.fields.frequency, "one_time")
      assert.equal(result.fields.total_payments, null)
      assert.equal(result.fields.installment_amount, null)
    }
  })
})
