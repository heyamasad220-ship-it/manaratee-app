import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  parseCampaignOverviewMetricKeys,
  resolveAutoCampaignOverviewMetricKeys,
  resolveCampaignOverviewMetricKeys,
} from "./campaign-overview-metrics"

describe("campaign overview metrics", () => {
  const breakdown = {
    cash: 100,
    checks: 0,
    square: 4515,
    ccOneTime: 288386,
    ccRecurring: 57850,
    ticketSales: 0,
    other: 0,
    collected: 350851,
    remainingPledges: 141816,
    totalRaised: 492667,
    target: 750000,
    percentRemaining: 28.8,
  }

  it("auto mode hides zero-value source rows", () => {
    const keys = resolveAutoCampaignOverviewMetricKeys(breakdown)
    assert.deepEqual(keys, [
      "cash",
      "square",
      "one-time",
      "recurring",
      "donors",
      "largest-gift",
      "pledges",
    ])
  })

  it("saved config overrides auto mode", () => {
    const keys = resolveCampaignOverviewMetricKeys({
      savedKeys: ["cash", "donors", "pledges"],
      breakdown,
    })
    assert.deepEqual(keys, ["cash", "donors", "pledges"])
  })

  it("parses stored metric keys", () => {
    assert.deepEqual(parseCampaignOverviewMetricKeys(["cash", "invalid", "donors"]), [
      "cash",
      "donors",
    ])
    assert.equal(parseCampaignOverviewMetricKeys(null), null)
  })
})
