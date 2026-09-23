import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  addHoursToTime,
  formatVolunteerHourOption,
  formatVolunteerWindowLabel,
  nextVolunteerWindowTimes,
  storedWindowsFromForm,
  volunteerHourOptions,
  volunteerOpeningsFromConfig,
  volunteerWindowsFromStored,
} from "./volunteer-windows"

describe("volunteer windows", () => {
  it("adds two hours and wraps past midnight", () => {
    assert.equal(addHoursToTime("12:00", 2), "14:00")
    assert.equal(addHoursToTime("22:30", 2), "00:30")
    assert.equal(addHoursToTime("", 2), "")
  })

  it("starts the next window when the previous one ends", () => {
    assert.deepEqual(
      nextVolunteerWindowTimes([
        { start: "12:00", end: "15:00" },
        { start: "15:00", end: "18:00" },
      ]),
      { start: "18:00", end: "20:00" }
    )
  })

  it("offers one label per hour", () => {
    const options = volunteerHourOptions()
    assert.equal(options.length, 24)
    assert.equal(options[0], "00:00")
    assert.equal(options[11], "11:00")
    assert.equal(options[12], "12:00")
    assert.equal(options[13], "13:00")
    assert.equal(formatVolunteerHourOption("11:00"), "11 AM")
    assert.equal(formatVolunteerHourOption("12:00"), "12 PM")
    assert.equal(formatVolunteerHourOption("13:00"), "1 PM")
    assert.equal(formatVolunteerHourOption("00:00"), "12 AM")
    const withSaved = volunteerHourOptions("07:30")
    assert.equal(withSaved.includes("07:30"), true)
    assert.equal(formatVolunteerHourOption("07:30"), "7:30 AM")
  })

  it("labels a window without using the event date", () => {
    assert.equal(formatVolunteerWindowLabel("12:00", "15:00"), "12:00 PM – 3:00 PM")
    assert.equal(formatVolunteerWindowLabel("18:00", "20:00"), "6:00 PM – 8:00 PM")
    assert.equal(formatVolunteerWindowLabel("", ""), "Time not set")
  })

  it("keeps a different headcount for the same job in each time", () => {
    const windows = storedWindowsFromForm([
      {
        id: "win-1",
        start: "12:00",
        end: "15:00",
        slots: [
          { id: "slot-a", name: "Face Painting", openings: "1" },
          { id: "slot-b", name: "Registration", openings: "1" },
        ],
      },
      {
        id: "win-2",
        start: "15:00",
        end: "18:00",
        slots: [{ id: "slot-c", name: "Face Painting", openings: "4" }],
      },
    ])

    assert.equal(windows[0].slots[0].openings, 1)
    assert.equal(windows[1].slots[0].openings, 4)
    assert.equal(
      volunteerOpeningsFromConfig({ windows }),
      6
    )
  })

  it("reads older role-and-shift rows as time windows", () => {
    const windows = volunteerWindowsFromStored({
      roles: [
        {
          name: "Registration",
          slots: 2,
          shifts: [{ id: "shift-1", start: "12:00", end: "14:00" }],
        },
      ],
    })
    assert.equal(windows.length, 1)
    assert.equal(windows[0].start, "12:00")
    assert.equal(windows[0].slots[0].name, "Registration")
    assert.equal(windows[0].slots[0].openings, "2")
    assert.equal(windows[0].slots[0].id, "shift-1")
  })
})