import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  classifyCampaignPaymentSource,
  campaignPaymentTypeLabel,
  computeCampaignDonationKpis,
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

  it("treats Square dinner monthly gifts as recurring, including remark-only commitments", () => {
    assert.equal(
      classifyCampaignPaymentSource({
        id: "m1",
        source: "import",
        memo: "FUNDRAISER_DINNER_DONATIONS_SEP2026_V1|hash|Annual Fundraiser|MONTHLY|CARD|last4:178",
      }),
      "ccRecurring"
    )
    assert.equal(
      campaignPaymentTypeLabel({
        id: "m2",
        source: "import",
        memo: "FUNDRAISER_DINNER_DONATIONS_SEP2026_V1|hash|CYP|ONE_TIME|APPLE_PAY|last4:5105|50 monthly for one year",
      }),
      "Recurring"
    )
    assert.equal(
      campaignPaymentTypeLabel({
        id: "m3",
        source: "import",
        memo: "FUNDRAISER_DINNER_DONATIONS_SEP2026_V1|hash|QIL|ONE_TIME|CARD|last4:1234",
      }),
      "One-Time"
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

describe("campaign donation kpis", () => {
  it("splits one-time totals from live recurring plans", () => {
    const kpis = computeCampaignDonationKpis(
      [
        { id: "ot-1", amount: 200, donor_id: "a", sender_name: "Ali" },
        { id: "ot-2", amount: 100, donor_id: "a", sender_name: "Ali" },
        { id: "rec-1", amount: 50, donor_id: "susan", sender_name: "Susan", recurring_donation_plan_id: "p1" },
        { id: "voided", amount: 25, status: "voided", donor_id: "z", sender_name: "Voided" },
      ],
      [
        {
          id: "p1",
          donor_id: "susan",
          contact_id: null,
          donor_name: "Susan",
          amount: 50,
          frequency: "monthly",
          status: "active",
          start_date: null,
          next_payment_date: null,
          payments_made: 1,
          total_payments: 12,
        },
        {
          id: "p2",
          donor_id: "b",
          contact_id: null,
          donor_name: "Quarterly Donor",
          amount: 120,
          frequency: "quarterly",
          status: "active",
          start_date: null,
          next_payment_date: null,
          payments_made: 0,
          total_payments: null,
        },
        {
          id: "paused",
          donor_id: "c",
          contact_id: null,
          donor_name: "Paused",
          amount: 1000,
          frequency: "monthly",
          status: "paused",
          start_date: null,
          next_payment_date: null,
          payments_made: 0,
          total_payments: null,
        },
      ]
    )

    assert.equal(kpis.oneTimeTotal, 300)
    assert.equal(kpis.oneTimeCount, 2)
    assert.equal(kpis.recurringCount, 2)
    assert.equal(kpis.monthlyRecurringAmount, 90)
    assert.equal(kpis.donorCount, 3)
  })
})
