import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  getOfferingScheduleColor,
  NEUTRAL_SCHEDULE_COLOR,
  OFFERING_SCHEDULE_PALETTE,
} from "./offering-schedule-color"

describe("getOfferingScheduleColor", () => {
  it("returns a stable color for the same offering ID", () => {
    const first = getOfferingScheduleColor("offering-tajweed-beginner")
    const second = getOfferingScheduleColor("offering-tajweed-beginner")
    assert.equal(first.key, second.key)
    assert.equal(first.cardClassName, second.cardClassName)
  })

  it("does not depend on call order across different IDs", () => {
    const beginnerFirst = getOfferingScheduleColor("off-beginner")
    getOfferingScheduleColor("off-advanced")
    const beginnerAgain = getOfferingScheduleColor("off-beginner")
    assert.equal(beginnerFirst.key, beginnerAgain.key)
  })

  it("picks from the controlled pastel palette", () => {
    const color = getOfferingScheduleColor("offering-nouraniyyeh")
    assert.ok(OFFERING_SCHEDULE_PALETTE.some((entry) => entry.key === color.key))
  })

  it("uses a neutral color when the offering ID is missing", () => {
    assert.equal(getOfferingScheduleColor(null).key, NEUTRAL_SCHEDULE_COLOR.key)
    assert.equal(getOfferingScheduleColor("").key, NEUTRAL_SCHEDULE_COLOR.key)
  })
})
