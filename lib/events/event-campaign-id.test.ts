import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { linkedCampaignIdFromEvent, withLinkedCampaignConfig } from "./event-campaign-id"

describe("linkedCampaignIdFromEvent", () => {
  it("prefers the campaign_id column over JSON", () => {
    assert.equal(
      linkedCampaignIdFromEvent({
        campaign_id: "column-id",
        ticketing_config: { linkedCampaignId: "json-id" },
      }),
      "column-id"
    )
  })

  it("falls back to ticketing_config JSON", () => {
    assert.equal(
      linkedCampaignIdFromEvent({
        campaign_id: null,
        ticketing_config: { linkedCampaignId: "json-id" },
      }),
      "json-id"
    )
  })

  it("writes both the column payload helper and JSON key", () => {
    const next = withLinkedCampaignConfig({ attendanceMode: "paid" }, "camp-1")
    assert.equal(next.linkedCampaignId, "camp-1")
    assert.equal(next.attendanceMode, "paid")
  })
})
