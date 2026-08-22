import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  parseDonationRangeParam,
  resolveDonationRangeBounds,
} from "./donation-date-range"

describe("donation date range", () => {
  it("falls back when the query param is missing", () => {
    assert.equal(parseDonationRangeParam(null, "all"), "all")
    assert.equal(parseDonationRangeParam("30d", "all"), "30d")
  })

  it("resolves a closed last-30-days window", () => {
    const bounds = resolveDonationRangeBounds("30d", new Date("2026-08-21T12:00:00"))
    assert.equal(bounds.dateFrom, "2026-07-23")
    assert.equal(bounds.dateTo, "2026-08-21")
    assert.equal(bounds.label, "Last 30 days")
  })

  it("leaves all-time unbounded", () => {
    const bounds = resolveDonationRangeBounds("all")
    assert.equal(bounds.dateFrom, null)
    assert.equal(bounds.dateTo, null)
  })
})
