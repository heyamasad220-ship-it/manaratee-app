import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { computeCampaignHeadlineTotals } from "./campaign-analytics"

describe("computeCampaignHeadlineTotals", () => {
  it("sets outstanding to committed minus all collected payments", () => {
    const headline = computeCampaignHeadlineTotals({
      pledged: 18_000,
      raised: 12_550,
    })
    assert.equal(headline.committed, 18_000)
    assert.equal(headline.collected, 12_550)
    assert.equal(headline.outstanding, 5_450)
  })

  it("does not go below zero when collected exceeds pledges", () => {
    const headline = computeCampaignHeadlineTotals({
      pledged: 1_000,
      raised: 1_500,
    })
    assert.equal(headline.outstanding, 0)
  })
})
