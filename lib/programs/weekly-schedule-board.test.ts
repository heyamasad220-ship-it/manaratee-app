import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildWeeklyScheduleColumns,
  formatScheduleTimeRange,
  getActiveScheduleDays,
  timeToMinutes,
  type VisualScheduleItem,
} from "./weekly-schedule-board"

function item(overrides: Partial<VisualScheduleItem> = {}): VisualScheduleItem {
  return {
    id: "item-1",
    offeringId: "off-1",
    offeringName: "Tajweed — Beginner",
    dayOfWeek: "tuesday",
    startTime: "09:00:00",
    endTime: "11:00:00",
    instructorName: "Souzan Ayoub",
    spaceName: "Conference Room 1",
    href: "/programs/p1/offerings/off-1",
    ...overrides,
  }
}

describe("weekly schedule board helpers", () => {
  it("formats times with a readable range", () => {
    assert.equal(
      formatScheduleTimeRange("09:00:00", "11:00:00"),
      "9:00 AM – 11:00 AM"
    )
    assert.equal(formatScheduleTimeRange("12:00", "13:00"), "12:00 PM – 1:00 PM")
  })

  it("includes Mon–Fri when weekday classes exist, plus weekend only when scheduled", () => {
    assert.deepEqual(
      getActiveScheduleDays([{ dayOfWeek: "tuesday" }, { dayOfWeek: "thursday" }]),
      ["monday", "tuesday", "wednesday", "thursday", "friday"]
    )
    assert.deepEqual(
      getActiveScheduleDays([
        { dayOfWeek: "monday" },
        { dayOfWeek: "saturday" },
      ]),
      ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    )
    assert.deepEqual(getActiveScheduleDays([{ dayOfWeek: "sunday" }]), ["sunday"])
  })

  it("sorts same-day classes by start time then offering name", () => {
    const columns = buildWeeklyScheduleColumns(
      [
        item({
          id: "adv",
          offeringId: "off-adv",
          offeringName: "Tajweed — Advanced",
          startTime: "09:00",
          instructorName: null,
          spaceName: null,
        }),
        item({
          id: "beg",
          offeringId: "off-beg",
          offeringName: "Tajweed — Beginner",
          startTime: "09:00",
        }),
        item({
          id: "nour",
          offeringId: "off-nour",
          offeringName: "Al Nouraniyyeh",
          dayOfWeek: "monday",
          startTime: "12:00",
          endTime: "13:00",
          instructorName: null,
          spaceName: null,
        }),
      ],
      { todayDayOfWeek: "tuesday" }
    )

    assert.equal(columns.length, 5)
    assert.equal(columns[0].label, "Monday")
    assert.equal(columns[0].items[0].offeringName, "Al Nouraniyyeh")
    assert.equal(columns[1].isToday, true)
    assert.deepEqual(
      columns[1].items.map((row) => row.offeringName),
      ["Tajweed — Advanced", "Tajweed — Beginner"]
    )
    assert.equal(columns[2].items.length, 0)
  })

  it("parses 24-hour times for sorting", () => {
    assert.ok(timeToMinutes("12:00:00") > timeToMinutes("09:00:00"))
    assert.equal(timeToMinutes("13:00"), 13 * 60)
  })
})
