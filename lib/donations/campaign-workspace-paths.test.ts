import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  CAMPAIGN_WORKSPACE_TABS,
  donationCampaignWorkspaceHref,
  parseCampaignWorkspaceTab,
} from "./campaign-workspace-paths"

describe("parseCampaignWorkspaceTab", () => {
  it("recognizes the Event tab", () => {
    assert.equal(parseCampaignWorkspaceTab("events"), "events")
  })

  it("falls back to overview for unknown tabs", () => {
    assert.equal(parseCampaignWorkspaceTab("unknown"), "overview")
  })
})

describe("campaign workspace Event tab", () => {
  it("labels the tab Event", () => {
    const eventsTab = CAMPAIGN_WORKSPACE_TABS.find((tab) => tab.id === "events")
    assert.equal(eventsTab?.label, "Event")
  })

  it("places Event after Overview", () => {
    assert.deepEqual(
      CAMPAIGN_WORKSPACE_TABS.map((tab) => tab.id),
      [
        "overview",
        "events",
        "plan",
        "pledges",
        "donations",
        "sponsors",
        "groups",
        "wishlist",
      ]
    )
  })

  it("builds the Event href", () => {
    assert.equal(
      donationCampaignWorkspaceHref("campaign-1", { tab: "events" }),
      "/donations/campaigns/campaign-1?tab=events"
    )
  })
})
