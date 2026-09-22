import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { eventHasNotStarted } from "./internal-event-format"

describe("eventHasNotStarted", () => {
  it("counts events whose start is still in the future", () => {
    const now = new Date("2026-09-19T14:00:00.000Z")
    assert.equal(
      eventHasNotStarted({ start_at: "2026-09-20T00:00:00.000Z" }, now),
      true
    )
  })

  it("excludes events that have already started", () => {
    const now = new Date("2026-09-19T14:00:00.000Z")
    assert.equal(
      eventHasNotStarted({ start_at: "2026-09-19T13:00:00.000Z" }, now),
      false
    )
  })

  it("includes an event that starts at the current instant", () => {
    const now = new Date("2026-09-19T18:00:00.000Z")
    assert.equal(
      eventHasNotStarted({ start_at: "2026-09-19T18:00:00.000Z" }, now),
      true
    )
  })

  it("excludes events with no start time", () => {
    assert.equal(eventHasNotStarted({ start_at: null }), false)
  })
})
