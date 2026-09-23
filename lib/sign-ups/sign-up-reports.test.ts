import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  signUpReportEvent,
  signUpReportSlotAndTime,
} from "./sign-up-reports"

describe("sign-up reports", () => {
  it("reads the slot name and the saved time label", () => {
    assert.deepEqual(
      signUpReportSlotAndTime({
        volunteerRole: " Face Painting ",
        assignmentMeta: { shiftLabel: "12:00 PM – 3:00 PM", shiftId: "slot-1" },
      }),
      { slot: "Face Painting", time: "12:00 PM – 3:00 PM" }
    )
  })

  it("leaves slot and time blank when they were not set", () => {
    assert.deepEqual(
      signUpReportSlotAndTime({ volunteerRole: "  ", assignmentMeta: {} }),
      { slot: null, time: null }
    )
  })

  it("uses the bazaar name and Vendor Hub link when the event is a bazaar", () => {
    assert.deepEqual(
      signUpReportEvent({
        eventId: "event-1",
        eventName: "Hold",
        sourceModule: "vendor_hub",
        bazaarId: "bazaar-1",
        bazaarName: "Spring Bazaar",
      }),
      {
        eventName: "Spring Bazaar",
        eventHref: "/vendor-hub/events/bazaar-1",
      }
    )
  })

  it("keeps Event Management events on the event workspace", () => {
    assert.deepEqual(
      signUpReportEvent({
        eventId: "event-1",
        eventName: " Thursday Halaqa ",
        sourceModule: "event_management",
        bazaarId: null,
        bazaarName: null,
      }),
      {
        eventName: "Thursday Halaqa",
        eventHref: "/event-management/event-1",
      }
    )
  })
})
