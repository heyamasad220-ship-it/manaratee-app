import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  classifyCampaignPaymentSource,
  computeCampaignSourceBreakdown,
} from "./campaign-analytics"

describe("campaign source breakdown", () => {
  it("classifies MAS ledger memo buckets", () => {
    assert.equal(
      classifyCampaignPaymentSource({
        id: "1",
        memo: "MAS|cash|March 2023",
        source: "cash",
      }),
      "cash"
    )
    assert.equal(
      classifyCampaignPaymentSource({
        id: "2",
        memo: "MAS|checks|March 2023",
        source: "check",
      }),
      "checks"
    )
    assert.equal(
      classifyCampaignPaymentSource({
        id: "3",
        memo: "MAS|one-time|March 2023",
        source: "stripe",
      }),
      "ccOneTime"
    )
    assert.equal(
      classifyCampaignPaymentSource({
        id: "5",
        memo: "MAS|batch|square|September 2025",
        source: "square",
      }),
      "square"
    )
  })

  it("matches March 2023 dashboard totals shape", () => {
    const campaignId = "campaign-1"
    const pledges = [
      {
        id: "pledge-1",
        campaign_id: campaignId,
        amount_pledged: 22150,
        balance_remaining: 22150,
        calculated_status: "open",
      },
    ]
    const payments = [
      { id: "p1", campaign_id: campaignId, amount: 2500, source: "cash", memo: "MAS|cash|x" },
      { id: "p2", campaign_id: campaignId, amount: 28000, source: "check", memo: "MAS|checks|x" },
      {
        id: "p3",
        campaign_id: campaignId,
        amount: 41950,
        source: "stripe",
        memo: "MAS|one-time|x",
      },
      {
        id: "p4",
        campaign_id: campaignId,
        amount: 3500,
        source: "stripe",
        memo: "MAS|recurring|x",
      },
    ]

    const breakdown = computeCampaignSourceBreakdown(
      campaignId,
      200000,
      pledges,
      payments,
      new Map()
    )

    assert.equal(breakdown.cash, 2500)
    assert.equal(breakdown.checks, 28000)
    assert.equal(breakdown.ccOneTime, 41950)
    assert.equal(breakdown.ccRecurring, 3500)
    assert.equal(breakdown.collected, 75950)
    assert.equal(breakdown.remainingPledges, 22150)
    assert.equal(breakdown.totalRaised, 98100)
    assert.equal(breakdown.target, 200000)
    assert.equal(Number(breakdown.percentRemaining?.toFixed(1)), 22.6)
  })
})
