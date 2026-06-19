import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isPledgeEligibleForReminder } from "./pledge-reminder-types"

/**
 * Mirrors scripts/119_donations_pilot_blocker_views.sql aggregation rules for offline validation.
 */
function computePledgeStatusViewRow(input: {
  amountPledged: number
  pledgeStatus: string
  payments: Array<{ amount: number; status: string }>
}) {
  const amountPaid = input.payments
    .filter((payment) => payment.status.toLowerCase() !== "voided")
    .reduce((sum, payment) => sum + payment.amount, 0)

  if (input.pledgeStatus.toLowerCase() === "cancelled") {
    return {
      amount_paid: amountPaid,
      balance_remaining: 0,
      calculated_status: "cancelled",
    }
  }

  const balanceRemaining = Math.max(input.amountPledged - amountPaid, 0)
  let calculatedStatus = "open"
  if (amountPaid >= input.amountPledged) calculatedStatus = "fulfilled"
  else if (amountPaid > 0) calculatedStatus = "partial"

  return {
    amount_paid: amountPaid,
    balance_remaining: balanceRemaining,
    calculated_status: calculatedStatus,
  }
}

function portalPledgePaymentStatus(pledgeId: string | null): string {
  return pledgeId ? "allocated" : "unallocated"
}

describe("donations pilot blocker validation", () => {
  it("scenario 1: partial pledge payment", () => {
    const row = computePledgeStatusViewRow({
      amountPledged: 10_000,
      pledgeStatus: "open",
      payments: [{ amount: 5_000, status: "allocated" }],
    })

    assert.equal(row.amount_paid, 5_000)
    assert.equal(row.balance_remaining, 5_000)
    assert.equal(row.calculated_status, "partial")
  })

  it("scenario 2: voided payment does not reduce pledge balance", () => {
    const row = computePledgeStatusViewRow({
      amountPledged: 10_000,
      pledgeStatus: "open",
      payments: [
        { amount: 5_000, status: "allocated" },
        { amount: 5_000, status: "voided" },
      ],
    })

    assert.equal(row.amount_paid, 5_000)
    assert.equal(row.balance_remaining, 5_000)
    assert.equal(row.calculated_status, "partial")
  })

  it("scenario 2b: only voided payment leaves pledge fully open", () => {
    const row = computePledgeStatusViewRow({
      amountPledged: 10_000,
      pledgeStatus: "open",
      payments: [{ amount: 5_000, status: "voided" }],
    })

    assert.equal(row.amount_paid, 0)
    assert.equal(row.balance_remaining, 10_000)
    assert.equal(row.calculated_status, "open")
  })

  it("scenario 3: cancelled pledge excluded from collection/reminders", () => {
    const row = computePledgeStatusViewRow({
      amountPledged: 10_000,
      pledgeStatus: "cancelled",
      payments: [],
    })

    assert.equal(row.calculated_status, "cancelled")
    assert.equal(row.balance_remaining, 0)
    assert.equal(
      isPledgeEligibleForReminder(row.calculated_status, row.balance_remaining),
      false
    )
  })

  it("scenario 4: portal pledge payment status is allocated", () => {
    assert.equal(portalPledgePaymentStatus("pledge-123"), "allocated")
    assert.equal(portalPledgePaymentStatus(null), "unallocated")
  })
})
