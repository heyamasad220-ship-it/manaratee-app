import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  calendarDayKey,
  groupCalendarReservationsByDay,
} from "./calendar-list"
import type { CalendarReservation } from "./reservation-types"

function reservation(
  overrides: Partial<CalendarReservation> & { id: string; startAt: string }
): CalendarReservation {
  return {
    organizationId: "org",
    venueId: null,
    venueName: null,
    spaceLabel: "Youth Lounge",
    title: "Event",
    description: null,
    endAt: overrides.startAt,
    sourceType: "internal_event",
    sourceId: overrides.id,
    status: "active",
    metadata: {},
    href: null,
    ...overrides,
  }
}

describe("calendarDayKey", () => {
  it("uses the local calendar date", () => {
    const date = new Date(2026, 8, 19, 7, 0, 0)
    assert.equal(calendarDayKey(date.toISOString()), "2026-09-19")
  })
})

describe("groupCalendarReservationsByDay", () => {
  it("groups by day and keeps start order", () => {
    const first = reservation({
      id: "a",
      startAt: new Date(2026, 8, 19, 7, 0).toISOString(),
      title: "Morning",
    })
    const second = reservation({
      id: "b",
      startAt: new Date(2026, 8, 19, 19, 0).toISOString(),
      title: "Evening",
    })
    const third = reservation({
      id: "c",
      startAt: new Date(2026, 8, 20, 9, 0).toISOString(),
      title: "Next day",
    })

    const groups = groupCalendarReservationsByDay([first, second, third])
    assert.equal(groups.length, 2)
    assert.equal(groups[0]?.reservations.length, 2)
    assert.equal(groups[0]?.reservations[0]?.title, "Morning")
    assert.equal(groups[1]?.reservations[0]?.title, "Next day")
    assert.match(groups[0]?.label || "", /SATURDAY, SEPTEMBER 19, 2026/)
  })
})
