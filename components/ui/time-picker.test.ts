import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  formatTimeDisplay,
  parseTime24,
  toTime24,
  buildTimeOptions,
} from "@/components/ui/time-picker"

describe("time picker utilities", () => {
  it("formats 24h time for display", () => {
    assert.equal(formatTimeDisplay("12:50"), "12:50 PM")
    assert.equal(formatTimeDisplay("00:05"), "12:05 AM")
    assert.equal(formatTimeDisplay("13:00"), "1:00 PM")
  })

  it("builds 30-minute options for a full day", () => {
    const options = buildTimeOptions(30)
    assert.equal(options.length, 48)
    assert.equal(options[0], "00:00")
    assert.equal(options[1], "00:30")
    assert.equal(options[options.length - 1], "23:30")
  })

  it("round-trips hour and minute adjustments", () => {
    const { hours24, minutes } = parseTime24("09:30")
    assert.equal(toTime24(hours24, minutes), "09:30")
  })
})
