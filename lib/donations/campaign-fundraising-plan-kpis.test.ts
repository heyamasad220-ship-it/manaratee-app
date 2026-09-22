import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  computeCampaignFundraisingPlanKpis,
  type CampaignProspectListItem,
} from "./campaign-prospect-types"

function prospect(
  overrides: Partial<CampaignProspectListItem> & Pick<CampaignProspectListItem, "id" | "contact_id">
): CampaignProspectListItem {
  return {
    organization_id: "org",
    campaign_id: "campaign",
    ask_type: "donation",
    ask_level_id: null,
    suggested_ask_amount: null,
    event_id: null,
    sponsorship_package_id: null,
    assigned_to_contact_id: null,
    assigned_to_name: null,
    stage: "identified",
    priority: "medium",
    last_contacted_at: null,
    next_follow_up_at: null,
    notes: null,
    converted_pledge_id: null,
    converted_sponsorship_id: null,
    contactName: "Donor",
    contactEmail: null,
    assignedToName: null,
    askLevelAmount: null,
    pledgeAmount: null,
    sponsorshipAmount: null,
    eventName: null,
    packageName: null,
    ...overrides,
  }
}

describe("campaign fundraising plan kpis", () => {
  it("counts donation prospects, typed ask amounts, overdue follow-ups, and pledged totals", () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const overdueDate = yesterday.toISOString().slice(0, 10)

    const kpis = computeCampaignFundraisingPlanKpis([
      prospect({
        id: "1",
        contact_id: "a",
        suggested_ask_amount: 100000,
        next_follow_up_at: overdueDate,
      }),
      prospect({
        id: "2",
        contact_id: "b",
        ask_level_id: "level-1",
        askLevelAmount: 25000,
        converted_pledge_id: "pledge-1",
        pledgeAmount: 20000,
        stage: "pledged",
        next_follow_up_at: overdueDate,
      }),
      prospect({
        id: "3",
        contact_id: "c",
        ask_type: "sponsorship",
        suggested_ask_amount: 50000,
      }),
    ])

    assert.equal(kpis.prospectCount, 2)
    assert.equal(kpis.totalAsk, 125000)
    assert.equal(kpis.overdueCount, 1)
    assert.equal(kpis.pledgedAmount, 20000)
  })
})
