import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  formatTimeDisplay,
  parseTime24,
  toTime24,
} from "@/components/ui/time-picker"

describe("time picker utilities", () => {
  it("formats 24h time for display", () => {
    assert.equal(formatTimeDisplay("12:50"), "12:50 PM")
    assert.equal(formatTimeDisplay("00:05"), "12:05 AM")
    assert.equal(formatTimeDisplay("13:00"), "1:00 PM")
  })

  it("round-trips hour and minute adjustments", () => {
    const { hours24, minutes } = parseTime24("09:30")
    assert.equal(toTime24(hours24, minutes), "09:30")
  })
})
