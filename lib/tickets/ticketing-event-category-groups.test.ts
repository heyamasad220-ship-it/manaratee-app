import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  summarizeTicketedEventsOverview,
  type TicketedEventOverviewRow,
} from "./ticketing-overview-types"
import {
  filterTicketedEventsByCategory,
  filterTicketedEventsByWhen,
} from "./ticketing-event-category-groups"

function event(
  id: string,
  name: string,
  startAt: string,
  categoryId: string | null = null
): TicketedEventOverviewRow {
  return {
    id,
    name,
    venueName: null,
    locationLabel: null,
    startAt,
    endAt: startAt,
    salesStatus: "published",
    ticketsIssued: 0,
    ticketsCapacity: null,
    ticketsRemaining: null,
    revenueCents: 0,
    currency: "USD",
    ticketingCategoryId: categoryId,
    ticketingCategoryName: null,
  }
}

describe("ticketing event filters", () => {
  it("filters by category id and uncategorized", () => {
    const rows = [
      event("1", "Bazaar Tickets", "2026-02-14T18:00:00Z", "cat-bazaar"),
      event("2", "Mystery Night", "2026-09-01T18:00:00Z", null),
      event("3", "Kids Workshop", "2026-08-08T18:00:00Z", "cat-kids"),
    ]

    const kids = filterTicketedEventsByCategory(rows, "cat-kids")
    assert.equal(kids.length, 1)
    assert.equal(kids[0]?.name, "Kids Workshop")

    const uncategorized = filterTicketedEventsByCategory(rows, "none")
    assert.equal(uncategorized.length, 1)
    assert.equal(uncategorized[0]?.name, "Mystery Night")

    assert.equal(filterTicketedEventsByCategory(rows, "all").length, 3)
  })

  it("filters to active events", () => {
    const rows = [
      event("past", "Eid Prayer", "2026-05-27T13:00:00Z"),
      event("future", "Annual Fundraising Dinner", "2026-09-12T23:00:00Z"),
    ]
    const active = filterTicketedEventsByWhen(
      rows,
      "active",
      new Date("2026-08-28T16:00:00Z")
    )
    assert.equal(active.length, 1)
    assert.equal(active[0]?.name, "Annual Fundraising Dinner")
  })

  it("summarizes totals for overview KPI cards", () => {
    const past = event("past", "Eid Prayer", "2026-05-27T13:00:00Z")
    past.ticketsIssued = 196
    past.revenueCents = 0
    const active = event(
      "future",
      "Annual Fundraising Dinner",
      "2026-09-12T23:00:00Z"
    )
    active.ticketsIssued = 47
    active.revenueCents = 195600

    const summary = summarizeTicketedEventsOverview(
      [past, active],
      new Date("2026-08-28T16:00:00Z")
    )
    assert.equal(summary.totalEvents, 2)
    assert.equal(summary.activeEvents, 1)
    assert.equal(summary.pastEvents, 1)
    assert.equal(summary.ticketsIssued, 243)
    assert.equal(summary.revenueCents, 195600)
  })
})
