import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isoToClock, isoToDateKey, isSameYearMonth, wallTimeToIso } from "./event-datetime"

describe("event wall-clock conversion", () => {
  it("maps 5pm Chicago in May to 22:00 UTC (CDT)", () => {
    assert.equal(wallTimeToIso("2025-05-03", "17:00:00"), "2025-05-03T22:00:00.000Z")
  })

  it("maps noon Chicago in January to 18:00 UTC (CST)", () => {
    assert.equal(wallTimeToIso("2024-01-15", "12:00:00"), "2024-01-15T18:00:00.000Z")
  })

  it("accepts HH:MM clocks", () => {
    assert.equal(wallTimeToIso("2025-05-03", "17:00"), "2025-05-03T22:00:00.000Z")
  })

  it("returns null without a date", () => {
    assert.equal(wallTimeToIso(null, "17:00:00"), null)
  })

  it("round-trips Chicago date and clock", () => {
    const iso = wallTimeToIso("2025-05-03", "17:00:00")
    assert.equal(isoToDateKey(iso), "2025-05-03")
    assert.equal(isoToClock(iso), "17:00:00")
  })
})

describe("isSameYearMonth", () => {
  it("matches an event in the same Chicago month", () => {
    const now = new Date("2026-09-19T18:00:00.000Z")
    assert.equal(isSameYearMonth("2026-09-30T23:00:00.000Z", now), true)
  })

  it("rejects an event in the next month", () => {
    const now = new Date("2026-09-19T18:00:00.000Z")
    assert.equal(isSameYearMonth("2026-10-01T17:00:00.000Z", now), false)
  })
})
