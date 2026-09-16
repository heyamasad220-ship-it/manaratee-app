import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_EVENT_MANAGEMENT_EVENTS_COLUMNS,
  EVENT_MANAGEMENT_EVENTS_COLUMN_IDS,
  toggleEventManagementEventsColumn,
} from "./event-management-events-columns"

describe("event management events columns", () => {
  it("uses Event, Department, Date, Time, Location, Space, Status, then Actions", () => {
    assert.deepEqual(
      [...EVENT_MANAGEMENT_EVENTS_COLUMN_IDS],
      [
        "event",
        "department",
        "date",
        "time",
        "location",
        "space",
        "status",
        "category",
        "issued",
        "remaining",
        "revenue",
        "actions",
      ]
    )
  })

  it("keeps Event visible even when unchecked", () => {
    const next = toggleEventManagementEventsColumn(
      DEFAULT_EVENT_MANAGEMENT_EVENTS_COLUMNS,
      "event",
      false
    )
    assert.equal(next.includes("event"), true)
  })

  it("hides optional columns", () => {
    const next = toggleEventManagementEventsColumn(
      DEFAULT_EVENT_MANAGEMENT_EVENTS_COLUMNS,
      "time",
      false
    )
    assert.equal(next.includes("time"), false)
    assert.equal(next.includes("event"), true)
  })
})
