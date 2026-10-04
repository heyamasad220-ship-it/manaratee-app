import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  computeCampaignMetrics,
  formatCampaignLargestGiftLabel,
  selectCampaignLargestGift,
} from "./campaign-analytics"

const campaignId = "campaign-1"

describe("selectCampaignLargestGift", () => {
  it("uses an unpaid pledge when it is larger than any payment", () => {
    const selected = selectCampaignLargestGift({
      pledges: [
        {
          id: "marwan",
          campaign_id: campaignId,
          donor_id: "donor-marwan",
          donor_name: "Marwan Nafal",
          amount_pledged: 25000,
          balance_remaining: 25000,
          calculated_status: "open",
        },
        {
          id: "paid",
          campaign_id: campaignId,
          donor_id: "donor-paid",
          donor_name: "Paid Donor",
          amount_pledged: 20000,
          balance_remaining: 0,
          calculated_status: "fulfilled",
        },
      ],
      payments: [
        {
          id: "pay-20",
          campaign_id: campaignId,
          pledge_id: "paid",
          donor_id: "donor-paid",
          sender_name: "Paid Donor",
          amount: 20000,
          status: "succeeded",
        },
      ],
    })

    assert.equal(selected.amount, 25000)
    assert.equal(selected.gift?.displayName, "Marwan Nafal")
    assert.equal(selected.gift?.matchCount, 1)
    assert.equal(formatCampaignLargestGiftLabel(selected.gift), "From Marwan Nafal")
  })

  it("names every donor who shares the largest pledge", () => {
    const selected = selectCampaignLargestGift({
      pledges: [
        {
          id: "marwan",
          campaign_id: campaignId,
          donor_name: "Marwan Nafal",
          amount_pledged: 25000,
          calculated_status: "open",
        },
        {
          id: "amr",
          campaign_id: campaignId,
          donor_name: "Amr Morsy",
          amount_pledged: 25000,
          calculated_status: "open",
        },
        {
          id: "iru",
          campaign_id: campaignId,
          donor_name: "Islamic Relief USA",
          amount_pledged: 25000,
          calculated_status: "open",
        },
      ],
      payments: [],
    })

    assert.equal(selected.amount, 25000)
    assert.equal(selected.gift?.matchCount, 3)
    assert.equal(selected.gift?.displayName, "Amr Morsy and 2 others")
    assert.equal(selected.gift?.donorId, null)
  })

  it("counts a gift with no pledge when it is larger than every pledge", () => {
    const metrics = computeCampaignMetrics(
      campaignId,
      100000,
      [
        {
          id: "small",
          campaign_id: campaignId,
          donor_name: "Small Pledge",
          amount_pledged: 1000,
          calculated_status: "open",
        },
      ],
      [
        {
          id: "gift",
          campaign_id: campaignId,
          sender_name: "Large Gift",
          amount: 4000,
          status: "succeeded",
        },
      ],
      new Map()
    )

    assert.equal(metrics.largestGift, 4000)
    assert.equal(metrics.donationRaised, 4000)
    assert.equal(metrics.largestPayment, 4000)
    assert.equal(metrics.raised, 4000)
  })

  it("keeps pledge payments in collected and the largest payment, not in total raised", () => {
    const metrics = computeCampaignMetrics(
      campaignId,
      100000,
      [
        {
          id: "pledge",
          campaign_id: campaignId,
          donor_id: "donor-1",
          donor_name: "Pledge Donor",
          amount_pledged: 5000,
          balance_remaining: 4000,
          calculated_status: "open",
        },
      ],
      [
        {
          id: "pledge-pay",
          campaign_id: campaignId,
          pledge_id: "pledge",
          donor_id: "donor-1",
          sender_name: "Pledge Donor",
          amount: 1000,
          source: "zelle",
          status: "unallocated",
        },
        {
          id: "square-gift",
          campaign_id: campaignId,
          donor_id: "donor-2",
          sender_name: "Square Donor",
          amount: 500,
          source: "square",
          status: "unallocated",
        },
        {
          id: "recurring",
          campaign_id: campaignId,
          donor_id: "donor-2",
          recurring_donation_plan_id: "plan-1",
          sender_name: "Square Donor",
          amount: 25,
          source: "stripe",
          status: "unallocated",
        },
      ],
      new Map()
    )

    assert.equal(metrics.donationRaised, 525)
    assert.equal(metrics.raised, 1525)
    assert.equal(metrics.largestPayment, 1000)
    assert.equal(metrics.outstanding, 4000)
    assert.equal(metrics.donorCount, 2)
  })
})
