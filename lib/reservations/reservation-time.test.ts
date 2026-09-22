import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  CALENDAR_LIST_MAX_DAYS,
  CALENDAR_LIST_RANGE_DAYS,
  calendarDayCountInclusive,
  defaultListEndDate,
  getListRange,
  toDateParam,
} from "./reservation-time"

describe("getListRange", () => {
  it("starts at midnight of the anchor date and spans 30 inclusive days", () => {
    const { start, end } = getListRange(new Date(2026, 8, 19, 15, 30))
    assert.equal(start.getFullYear(), 2026)
    assert.equal(start.getMonth(), 8)
    assert.equal(start.getDate(), 19)
    assert.equal(start.getHours(), 0)
    assert.equal(CALENDAR_LIST_RANGE_DAYS, 30)
    assert.equal(toDateParam(end), "2026-10-18")
    assert.equal(end.getHours(), 23)
    assert.equal(calendarDayCountInclusive(start, end), 30)
  })

  it("uses a custom inclusive end date", () => {
    const { start, end } = getListRange(
      new Date(2026, 8, 30, 12),
      new Date(2026, 9, 5, 12)
    )
    assert.equal(toDateParam(start), "2026-09-30")
    assert.equal(toDateParam(end), "2026-10-05")
    assert.equal(calendarDayCountInclusive(start, end), 6)
  })

  it("swaps inverted dates and caps the range", () => {
    const inverted = getListRange(
      new Date(2026, 9, 10),
      new Date(2026, 9, 1)
    )
    assert.equal(toDateParam(inverted.start), "2026-10-01")
    assert.equal(toDateParam(inverted.end), "2026-10-10")

    const capped = getListRange(
      new Date(2026, 0, 1),
      new Date(2028, 0, 1)
    )
    assert.equal(calendarDayCountInclusive(capped.start, capped.end), CALENDAR_LIST_MAX_DAYS)
    assert.equal(toDateParam(defaultListEndDate(new Date(2026, 8, 30))), "2026-10-29")
  })
})
