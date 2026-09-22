import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildEventOverviewOpsKpis } from "./event-overview-ops"

describe("buildEventOverviewOpsKpis", () => {
  it("marks a single date as one-time", () => {
    const kpis = buildEventOverviewOpsKpis({
      name: "Town hall",
      start_at: "2026-09-19T14:00:00.000Z",
      end_at: "2026-09-19T16:00:00.000Z",
      timezone: "America/Chicago",
      location_label: "Main Prayer Hall (MPH)",
      requires_childcare: false,
      requires_volunteers: true,
      requires_vendors: false,
    })
    const byId = Object.fromEntries(kpis.map((kpi) => [kpi.id, kpi]))
    assert.equal(byId.type?.value, "One-time")
    assert.equal(byId.location?.value, "Main Prayer Hall (MPH)")
    assert.equal(byId.childcare?.value, "Not needed")
    assert.equal(byId.volunteers?.value, "Needed")
    assert.equal(byId.vendors?.value, "Not needed")
  })

  it("treats same-name siblings as a recurring series", () => {
    const event = {
      name: "Learn, Love, Live the Quran",
      start_at: "2026-09-30T14:00:00.000Z",
      end_at: "2026-09-30T15:00:00.000Z",
      timezone: "America/Chicago",
      venueNames: ["Main Prayer Hall (MPH)"],
    }
    const kpis = buildEventOverviewOpsKpis(event, [
      event,
      {
        ...event,
        start_at: "2026-10-07T14:00:00.000Z",
        end_at: "2026-10-07T15:00:00.000Z",
      },
    ])
    const byId = Object.fromEntries(kpis.map((kpi) => [kpi.id, kpi]))
    assert.equal(byId.type?.value, "Recurring")
    assert.equal(byId.schedule?.value, "Every Wednesday")
    assert.equal(byId.location?.value, "Main Prayer Hall (MPH)")
  })
})
