import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
  countUpcomingEventsByRecurrence,
  filterEventManagementEvents,
  getEventManagementSearchSeriesSummary,
  listEventManagementRecurringSeries,
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
      { q: "", department: "all", status: "active", ticketed: "all", category: "all", recurrence: "one_time" },
      now
    )
    assert.deepEqual(
      active.map((item) => item.id),
      ["upcoming"]
    )

    const drafts = filterEventManagementEvents(
      events,
      { q: "", department: "all", status: "draft", ticketed: "all", category: "all", recurrence: "one_time" },
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
      { q: "iftar", department: "all", status: "active", ticketed: "all", category: "all", recurrence: "one_time" },
      now
    )
    assert.deepEqual(
      byName.map((item) => item.id),
      ["a"]
    )

    const byDept = filterEventManagementEvents(
      events,
      { q: "", department: "dept-2", status: "active", ticketed: "all", category: "all", recurrence: "one_time" },
      now
    )
    assert.deepEqual(
      byDept.map((item) => item.id),
      ["b"]
    )
  })

  it("sorts upcoming events soonest first", () => {
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
      { q: "", department: "all", status: "all", ticketed: "all", category: "all", recurrence: "one_time" },
      now
    )
    assert.deepEqual(
      all.map((item) => item.id),
      ["older", "newer"]
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
        recurrence: "one_time",
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
        recurrence: "one_time",
      },
      now
    )
    assert.deepEqual(
      byCategory.map((item) => item.id),
      ["ticketed"]
    )
  })

  it("filters one-time vs recurring events", () => {
    const now = new Date("2026-08-27T12:00:00.000Z")
    const events = [
      event({
        id: "once",
        name: "Board Meeting",
        start_at: "2026-08-29T18:00:00.000Z",
        end_at: "2026-08-29T20:00:00.000Z",
      }),
      event({
        id: "series",
        name: "Tuesday Night Live",
        recurrence_config: {
          enabled: true,
          frequency: "weekly",
          interval: 1,
          weekdays: [2],
          endType: "date",
          endDate: "2027-05-25",
        },
        start_at: "2026-08-29T18:00:00.000Z",
        end_at: "2026-08-29T20:00:00.000Z",
      }),
    ]

    const oneTime = filterEventManagementEvents(
      events,
      {
        ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
        recurrence: "one_time",
      },
      now
    )
    assert.deepEqual(
      oneTime.map((item) => item.id),
      ["once"]
    )

    const recurring = filterEventManagementEvents(
      events,
      {
        ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
        recurrence: "recurring",
      },
      now
    )
    assert.deepEqual(
      recurring.map((item) => item.id),
      ["series"]
    )
  })

  it("searches requester name, phone, and email", () => {
    const now = new Date("2026-08-27T12:00:00.000Z")
    const events = [
      event({
        id: "aya",
        name: "Sabiqoon",
        coordinator: {
          id: "c1",
          full_name: "Aya Mustafa",
          email: "syc@masdfw.org",
          phone: "4142499048",
        },
        start_at: "2026-08-29T18:00:00.000Z",
        end_at: "2026-08-29T20:00:00.000Z",
      }),
      event({
        id: "other",
        name: "Staff Meeting",
        start_at: "2026-08-29T18:00:00.000Z",
        end_at: "2026-08-29T20:00:00.000Z",
      }),
    ]

    const byEmail = filterEventManagementEvents(
      events,
      { ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS, q: "syc@masdfw.org" },
      now
    )
    assert.deepEqual(
      byEmail.map((item) => item.id),
      ["aya"]
    )
  })

  it("summarizes a searched recurring series", () => {
    const now = new Date("2026-09-19T12:00:00.000Z")
    const recurrence = {
      enabled: true,
      frequency: "weekly",
      interval: 1,
      weekdays: [2],
      endType: "date",
      endDate: "2026-10-06",
      seriesId: "tnl",
    }
    const events = [
      event({
        id: "past",
        name: "Tuesday Night Live",
        recurrence_config: recurrence,
        start_at: "2026-09-15T00:00:00.000Z",
        end_at: "2026-09-15T01:30:00.000Z",
      }),
      event({
        id: "next",
        name: "Tuesday Night Live",
        recurrence_config: recurrence,
        start_at: "2026-09-22T00:00:00.000Z",
        end_at: "2026-09-22T01:30:00.000Z",
      }),
      event({
        id: "later",
        name: "Tuesday Night Live",
        recurrence_config: recurrence,
        start_at: "2026-09-29T00:00:00.000Z",
        end_at: "2026-09-29T01:30:00.000Z",
      }),
      event({
        id: "other",
        name: "Board Meeting",
        start_at: "2026-09-22T00:00:00.000Z",
        end_at: "2026-09-22T01:00:00.000Z",
      }),
    ]

    const summary = getEventManagementSearchSeriesSummary(
      events,
      {
        ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
        recurrence: "recurring",
        q: "tue",
      },
      now
    )
    assert.equal(summary?.name, "Tuesday Night Live")
    assert.equal(summary?.remainingCount, 2)
    assert.equal(summary?.totalCount, 3)
    assert.equal(summary?.schedule, "Every Tuesday")
    assert.equal(summary?.time.includes(" – "), true)
  })

  it("parses recurring from the URL and treats All as One-time", () => {
    assert.equal(
      parseEventManagementEventsFilters({ recurrence: "recurring" }).recurrence,
      "recurring"
    )
    assert.equal(
      parseEventManagementEventsFilters({ recurrence: "all" }).recurrence,
      "one_time"
    )
  })

  it("treats same-name meetings as a recurring series even without recurrence config", () => {
    const now = new Date("2026-09-19T12:00:00.000Z")
    const events = [
      event({
        id: "past",
        name: "Tuesday Night Live",
        start_at: "2026-09-16T00:00:00.000Z",
        end_at: "2026-09-16T01:30:00.000Z",
      }),
      event({
        id: "next",
        name: "Tuesday Night Live",
        start_at: "2026-09-23T00:00:00.000Z",
        end_at: "2026-09-23T01:30:00.000Z",
      }),
      event({
        id: "once",
        name: "Safwa Social",
        start_at: "2026-09-19T23:30:00.000Z",
        end_at: "2026-09-20T02:00:00.000Z",
      }),
    ]

    const oneTime = filterEventManagementEvents(
      events,
      { ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS, recurrence: "one_time" },
      now
    )
    assert.deepEqual(
      oneTime.map((item) => item.id),
      ["once"]
    )

    const recurring = filterEventManagementEvents(
      events,
      { ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS, recurrence: "recurring" },
      now
    )
    assert.deepEqual(
      recurring.map((item) => item.id),
      ["next"]
    )
  })

  it("collapses a series to the next upcoming meeting", () => {
    const now = new Date("2026-09-19T12:00:00.000Z")
    const events = [
      event({
        id: "tnl-past",
        name: "Tuesday Night Live",
        start_at: "2026-09-16T00:00:00.000Z",
        end_at: "2026-09-16T01:30:00.000Z",
      }),
      event({
        id: "tnl-next",
        name: "Tuesday Night Live",
        start_at: "2026-09-23T00:00:00.000Z",
        end_at: "2026-09-23T01:30:00.000Z",
      }),
      event({
        id: "tnl-later",
        name: "Tuesday Night Live",
        start_at: "2026-09-30T00:00:00.000Z",
        end_at: "2026-09-30T01:30:00.000Z",
      }),
      event({
        id: "quran-next",
        name: "Learn, Love, Live the Quran",
        start_at: "2026-09-23T14:00:00.000Z",
        end_at: "2026-09-23T15:00:00.000Z",
      }),
      event({
        id: "quran-later",
        name: "Learn, Love, Live the Quran",
        start_at: "2026-10-07T14:00:00.000Z",
        end_at: "2026-10-07T15:00:00.000Z",
      }),
      event({
        id: "potluck-next",
        name: "Learn, Love, Live the Quran (monthly potluck)",
        start_at: "2026-09-30T14:00:00.000Z",
        end_at: "2026-09-30T16:00:00.000Z",
      }),
      event({
        id: "potluck-later",
        name: "Learn, Love, Live the Quran (monthly potluck)",
        start_at: "2026-10-28T14:00:00.000Z",
        end_at: "2026-10-28T16:00:00.000Z",
      }),
      event({
        id: "old-1",
        name: "Finished Series",
        start_at: "2026-08-04T00:00:00.000Z",
        end_at: "2026-08-04T01:00:00.000Z",
      }),
      event({
        id: "old-2",
        name: "Finished Series",
        start_at: "2026-08-11T00:00:00.000Z",
        end_at: "2026-08-11T01:00:00.000Z",
      }),
    ]

    const rows = listEventManagementRecurringSeries(
      events,
      { ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS, recurrence: "recurring" },
      now
    )
    assert.deepEqual(
      rows.map((row) => ({
        id: row.event.id,
        schedule: row.schedule,
        remaining: row.remainingCount,
      })),
      [
        {
          id: "tnl-next",
          schedule: "Every Tuesday",
          remaining: 2,
        },
        {
          id: "quran-next",
          schedule: "Every Wednesday",
          remaining: 2,
        },
        {
          id: "potluck-next",
          schedule: "Every Wednesday",
          remaining: 2,
        },
      ]
    )

    const pastRows = listEventManagementRecurringSeries(
      events,
      {
        ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
        status: "past",
        recurrence: "recurring",
      },
      now
    )
    assert.deepEqual(
      pastRows.map((row) => row.event.id),
      ["old-2"]
    )
  })

  it("counts upcoming one-time dates and one row per recurring series", () => {
    const now = new Date("2026-09-20T12:00:00.000Z")
    const events = [
      event({
        id: "dinner",
        name: "Board dinner",
        start_at: "2026-10-01T23:00:00.000Z",
        end_at: "2026-10-02T01:00:00.000Z",
      }),
      event({
        id: "workshop",
        name: "New parent workshop",
        start_at: "2026-10-05T16:00:00.000Z",
        end_at: "2026-10-05T18:00:00.000Z",
      }),
      event({
        id: "tnl-past",
        name: "Tuesday Night Live",
        start_at: "2026-09-15T00:00:00.000Z",
        end_at: "2026-09-15T01:30:00.000Z",
      }),
      event({
        id: "tnl-next",
        name: "Tuesday Night Live",
        start_at: "2026-09-22T00:00:00.000Z",
        end_at: "2026-09-22T01:30:00.000Z",
      }),
      event({
        id: "tnl-later",
        name: "Tuesday Night Live",
        start_at: "2026-09-29T00:00:00.000Z",
        end_at: "2026-09-29T01:30:00.000Z",
      }),
      event({
        id: "cancelled",
        name: "Cancelled picnic",
        status: "cancelled",
        start_at: "2026-10-02T17:00:00.000Z",
        end_at: "2026-10-02T19:00:00.000Z",
      }),
    ]

    assert.deepEqual(countUpcomingEventsByRecurrence(events, now), {
      oneTimeCount: 2,
      recurringCount: 1,
    })
  })
})
