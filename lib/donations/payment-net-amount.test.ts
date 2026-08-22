import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildPaymentAdminCapabilities } from "./payment-admin-capabilities"
import {
  canAllocatePayment,
  computePledgeLedgerTotals,
  paymentNetAmount,
  remainingRefundableAmount,
  resolvePaymentStatusAfterRefund,
} from "./payment-net-amount"

describe("payment net amount helpers", () => {
  it("subtracts refunded amount", () => {
    assert.equal(paymentNetAmount(100, 25), 75)
    assert.equal(paymentNetAmount(100, 150), 0)
  })

  it("resolves refund statuses", () => {
    assert.equal(resolvePaymentStatusAfterRefund(100, 100, "allocated"), "refunded")
    assert.equal(resolvePaymentStatusAfterRefund(100, 40, "allocated"), "partially_refunded")
  })

  it("allows allocate for unallocated payments", () => {
    assert.equal(
      canAllocatePayment({ status: "unallocated", amount: 100, refunded_amount: 0 }),
      true
    )
    assert.equal(
      canAllocatePayment({
        status: "allocated",
        amount: 100,
        pledge_id: "pledge-1",
      }),
      false
    )
  })

  it("blocks stripe refund for imported payments", () => {
    const capabilities = buildPaymentAdminCapabilities({
      id: "p1",
      amount: 50,
      refunded_amount: 0,
      payment_date: "2026-01-01",
      source: "stripe",
      source_type: "import",
      status: "allocated",
      import_batch_id: "batch-1",
      stripe_payment_intent_id: null,
      stripe_charge_id: null,
    })

    assert.equal(capabilities.canStripeRefund, false)
    assert.equal(capabilities.canRecordRefund, true)
    assert.match(capabilities.stripeRefundBlockedReason || "", /imported/i)
  })

  it("allows stripe refund for processor payments", () => {
    const capabilities = buildPaymentAdminCapabilities({
      id: "p2",
      amount: 50,
      refunded_amount: 0,
      payment_date: "2026-01-01",
      source: "stripe",
      source_type: "processor",
      status: "allocated",
      pledge_id: "pledge-1",
      stripe_payment_intent_id: "pi_123",
      stripe_charge_id: "ch_123",
    })

    assert.equal(capabilities.canStripeRefund, true)
    assert.equal(capabilities.canRecordRefund, false)
    assert.equal(capabilities.canAllocate, false)
    assert.equal(remainingRefundableAmount({ amount: 50, refunded_amount: 10 }), 40)
  })

  it("does not double-count an imported payment against a pledge", () => {
    const totals = computePledgeLedgerTotals({
      amountPledged: 10000,
      allocatedPayments: [{ amount: 2000, refunded_amount: 0, status: "allocated" }],
    })

    assert.equal(totals.pledged, 10000)
    assert.equal(totals.collected, 2000)
    assert.equal(totals.outstanding, 8000)
    assert.equal(totals.orgGiving, 2000)
    assert.notEqual(totals.pledged + totals.collected, totals.orgGiving)
  })

  it("counts a standalone gift only as collected giving", () => {
    const totals = computePledgeLedgerTotals({
      amountPledged: 0,
      allocatedPayments: [{ amount: 500, refunded_amount: 0, status: "unallocated" }],
    })

    assert.equal(totals.collected, 500)
    assert.equal(totals.orgGiving, 500)
    assert.equal(totals.outstanding, 0)
  })
})
