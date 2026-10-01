import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { computeCampaignGroupMetrics } from "./campaign-group-helpers"
import type { CampaignGroupRow } from "./campaign-group-types"

const campaignId = "campaign-1"
const groupId = "thursday"

function group(): CampaignGroupRow {
  return {
    id: groupId,
    organization_id: "org",
    campaign_id: campaignId,
    organizational_group_id: null,
    name: "Thursday Halaqa",
    lead_contact_id: null,
    goal_amount: null,
    description: null,
    public_token: "token",
    status: "active",
    public_progress_enabled: false,
    link_active: true,
  }
}

describe("campaign group competition total", () => {
  it("adds received money and unpaid pledge balances without counting a paid pledge twice", () => {
    const [metrics] = computeCampaignGroupMetrics({
      groups: [group()],
      campaignId,
      pledges: [
        {
          id: "kinda",
          campaign_id: campaignId,
          campaign_group_id: groupId,
          amount_pledged: 5000,
          balance_remaining: 5000,
          calculated_status: "open",
        },
        {
          id: "nahla",
          campaign_id: campaignId,
          campaign_group_id: groupId,
          amount_pledged: 5000,
          balance_remaining: 5000,
          calculated_status: "open",
        },
        {
          id: "rania",
          campaign_id: campaignId,
          campaign_group_id: groupId,
          amount_pledged: 1000,
          balance_remaining: 0,
          calculated_status: "fulfilled",
        },
      ],
      payments: [
        {
          id: "gift",
          campaign_id: campaignId,
          campaign_group_id: groupId,
          amount: 14400,
          status: "succeeded",
        },
        {
          id: "pledge-pay",
          campaign_id: campaignId,
          campaign_group_id: groupId,
          pledge_id: "rania",
          amount: 2000,
          status: "succeeded",
        },
      ],
    })

    assert.equal(metrics.collected, 16400)
    assert.equal(metrics.outstanding, 10000)
    assert.equal(metrics.groupTotal, 26400)
    assert.notEqual(metrics.pledged + metrics.collected, metrics.groupTotal)
  })
})
