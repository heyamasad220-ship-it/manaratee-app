import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
  filterEventManagementEvents,
  parseEventManagementEventsFilters,
} from "./event-management-events-filters"
import type { InternalEventWithRelations } from "./internal-event-types"

function event(
  overrides: Partial<InternalEventWithRelations> & { id: string; name: string }
): InternalEventWithRelations {
  return {
    organization_id: "org",
    department_id: "dept-1",
    event_type_id: "type-1",
    description: null,
    status: "approved",
    start_at: "2026-08-28T18:00:00.000Z",
    end_at: "2026-08-28T20:00:00.000Z",
    venue_id: null,
    location_label: "Main Hall",
    timezone: null,
    submitted_at: null,
    approved_at: null,
    declined_at: null,
    decline_reason: null,
    recurrence_config: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    departments: { id: "dept-1", name: "Education", color: "#000" },
    event_types: { id: "type-1", name: "Lecture" },
    venues: null,
    ...overrides,
  }
}

describe("event management events filters", () => {
  it("defaults status to active", () => {
    assert.deepEqual(parseEventManagementEventsFilters({}), {
      ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
    })
  })

  it("keeps upcoming published events in Active", () => {
    const now = new Date("2026-08-27T12:00:00.000Z")
    const events = [
      event({
        id: "upcoming",
        name: "Open House",
        start_at: "2026-08-29T18:00:00.000Z",
        end_at: "2026-08-29T20:00:00.000Z",
      }),
      event({
        id: "draft",
        name: "Draft Night",
        status: "draft",
        start_at: "2026-08-30T18:00:00.000Z",
        end_at: "2026-08-30T20:00:00.000Z",
      }),
      event({
        id: "past",
        name: "Last Week",
        start_at: "2026-08-20T18:00:00.000Z",
        end_at: "2026-08-20T20:00:00.000Z",
      }),
    ]

    const active = filterEventManagementEvents(
      events,
      { q: "", department: "all", status: "active", ticketed: "all", category: "all" },
      now
    )
    assert.deepEqual(
      active.map((item) => item.id),
      ["upcoming"]
    )

    const drafts = filterEventManagementEvents(
      events,
      { q: "", department: "all", status: "draft", ticketed: "all", category: "all" },
      now
    )
    assert.deepEqual(
      drafts.map((item) => item.id),
      ["draft"]
    )
  })

  it("filters by search and department", () => {
    const now = new Date("2026-08-27T12:00:00.000Z")
    const events = [
      event({
        id: "a",
        name: "Youth Iftar",
        department_id: "dept-1",
        start_at: "2026-08-29T18:00:00.000Z",
        end_at: "2026-08-29T20:00:00.000Z",
      }),
      event({
        id: "b",
        name: "Board Meeting",
        department_id: "dept-2",
        departments: { id: "dept-2", name: "Admin", color: "#111" },
        start_at: "2026-08-29T18:00:00.000Z",
        end_at: "2026-08-29T20:00:00.000Z",
      }),
    ]

    const byName = filterEventManagementEvents(
      events,
      { q: "iftar", department: "all", status: "active", ticketed: "all", category: "all" },
      now
    )
    assert.deepEqual(
      byName.map((item) => item.id),
      ["a"]
    )

    const byDept = filterEventManagementEvents(
      events,
      { q: "", department: "dept-2", status: "active", ticketed: "all", category: "all" },
      now
    )
    assert.deepEqual(
      byDept.map((item) => item.id),
      ["b"]
    )
  })

  it("sorts events newest first", () => {
    const now = new Date("2026-08-27T12:00:00.000Z")
    const events = [
      event({
        id: "older",
        name: "Older",
        start_at: "2026-08-29T18:00:00.000Z",
        end_at: "2026-08-29T20:00:00.000Z",
      }),
      event({
        id: "newer",
        name: "Newer",
        start_at: "2026-09-12T18:00:00.000Z",
        end_at: "2026-09-12T22:00:00.000Z",
      }),
    ]

    const all = filterEventManagementEvents(
      events,
      { q: "", department: "all", status: "all", ticketed: "all", category: "all" },
      now
    )
    assert.deepEqual(
      all.map((item) => item.id),
      ["newer", "older"]
    )
  })

  it("filters ticketed events and category", () => {
    const now = new Date("2026-08-27T12:00:00.000Z")
    const events = [
      event({
        id: "ticketed",
        name: "Dinner",
        requires_ticketing: true,
        ticketing_category_id: "cat-1",
        start_at: "2026-08-29T18:00:00.000Z",
        end_at: "2026-08-29T20:00:00.000Z",
      }),
      event({
        id: "plain",
        name: "Staff Meeting",
        start_at: "2026-08-29T18:00:00.000Z",
        end_at: "2026-08-29T20:00:00.000Z",
      }),
    ]

    const ticketedOnly = filterEventManagementEvents(
      events,
      {
        q: "",
        department: "all",
        status: "active",
        ticketed: "ticketed",
        category: "all",
      },
      now
    )
    assert.deepEqual(
      ticketedOnly.map((item) => item.id),
      ["ticketed"]
    )

    const byCategory = filterEventManagementEvents(
      events,
      {
        q: "",
        department: "all",
        status: "active",
        ticketed: "all",
        category: "cat-1",
      },
      now
    )
    assert.deepEqual(
      byCategory.map((item) => item.id),
      ["ticketed"]
    )
  })
})
