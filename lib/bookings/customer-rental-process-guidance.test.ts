import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  getCustomerContractNextStepLabel,
  getCustomerPaymentNextActionLabel,
  getCustomerPaymentNextStepLabel,
  getCustomerPaymentProcessGuidance,
  isCustomerPaymentActionType,
} from "./customer-rental-process-guidance"

describe("customer rental process guidance", () => {
  it("identifies payment action types", () => {
    assert.equal(isCustomerPaymentActionType("pay_deposit"), true)
    assert.equal(isCustomerPaymentActionType("sign_agreement"), false)
    assert.equal(isCustomerPaymentActionType(undefined), false)
  })

  it("describes staff-mediated payment without implying online checkout", () => {
    const guidance = getCustomerPaymentProcessGuidance("pay_deposit", {
      dueDateLabel: "May 10, 2026",
    })

    assert.match(guidance.title, /deposit due/i)
    assert.match(guidance.description, /email you instructions/i)
    assert.doesNotMatch(guidance.description, /pay online/i)
  })

  it("uses honest dashboard next-step labels", () => {
    assert.match(getCustomerPaymentNextStepLabel("pay_deposit"), /await/i)
    assert.match(getCustomerPaymentNextStepLabel("pay_deposit"), /instructions/i)
    assert.doesNotMatch(getCustomerPaymentNextStepLabel("pay_deposit"), /^Pay deposit$/)
  })

  it("uses honest next-action labels for payment due states", () => {
    const label = getCustomerPaymentNextActionLabel("pay_deposit", {
      holdDeadlineLabel: "May 5, 2026, 5:00 PM",
    })

    assert.match(label, /payment instructions/i)
    assert.match(label, /May 5, 2026/)
  })

  it("uses honest contract next-step labels", () => {
    assert.match(getCustomerContractNextStepLabel(), /staff/i)
    assert.doesNotMatch(getCustomerContractNextStepLabel(), /sign agreement/i)
  })
})
