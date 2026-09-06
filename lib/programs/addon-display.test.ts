import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isTransactionFeeAddon,
  resolveProgramAddonType,
} from "./addon-display"

describe("program add-on type labels", () => {
  it("treats imported processing fees as transaction fees, not extras", () => {
    assert.equal(
      isTransactionFeeAddon({
        label: "Transaction fee",
        lineType: "addon",
        chargeType: "addon",
        metadata: { addon_kind: "transaction_fee" },
        quote: { type: "transaction_fee" },
      }),
      true
    )
    assert.equal(
      resolveProgramAddonType({
        label: "Transaction fee",
        lineType: "addon",
        metadata: { addon_kind: "transaction_fee" },
      }),
      "Transaction fee"
    )
  })

  it("keeps lunch and childcare as purchased add-ons", () => {
    assert.equal(isTransactionFeeAddon({ label: "Lunch" }), false)
    assert.equal(isTransactionFeeAddon({ label: "Before Care" }), false)
    assert.equal(resolveProgramAddonType({ label: "Lunch" }), "Lunch")
    assert.equal(
      resolveProgramAddonType({ label: "After Care" }),
      "Childcare"
    )
  })
})
