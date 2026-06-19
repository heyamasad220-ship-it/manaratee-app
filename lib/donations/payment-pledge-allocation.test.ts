import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isInstallmentPledge,
  isLumpSumPledge,
  pickPledgeForImportAllocation,
  type PledgeAllocationCandidate,
} from "./payment-pledge-allocation"

function pledge(
  id: string,
  balance: number,
  frequency: string
): PledgeAllocationCandidate {
  return {
    id,
    donorId: "donor-1",
    balanceRemaining: balance,
    frequency,
    pledgeType: null,
  }
}

describe("payment pledge allocation", () => {
  it("prefers lump-sum pledge over installment pledge", () => {
    const picked = pickPledgeForImportAllocation([
      pledge("installment", 1200, "monthly"),
      pledge("lump", 5000, "one_time"),
    ])

    assert.equal(picked?.id, "lump")
  })

  it("skips installment pledges when donor has active recurring plan and lump-sum exists", () => {
    const picked = pickPledgeForImportAllocation(
      [pledge("installment", 1200, "monthly"), pledge("lump", 5000, "one_time")],
      { donorHasActiveRecurringPlan: true }
    )

    assert.equal(picked?.id, "lump")
  })

  it("does not pick when two lump-sum pledges tie on balance", () => {
    const picked = pickPledgeForImportAllocation([
      pledge("a", 5000, "one_time"),
      pledge("b", 5000, "one_time"),
    ])

    assert.equal(picked, null)
  })

  it("recognizes installment frequencies", () => {
    assert.equal(isLumpSumPledge("one_time"), true)
    assert.equal(isLumpSumPledge("One-Time"), true)
    assert.equal(isInstallmentPledge("monthly"), true)
    assert.equal(isInstallmentPledge("Yearly"), true)
  })
})
