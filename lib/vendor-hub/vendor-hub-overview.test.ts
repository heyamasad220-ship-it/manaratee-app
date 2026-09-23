import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  countBoothRequests,
  countUnpaidBooths,
  pickReturningVendors,
  pickRecentOrders,
  formatBoothOrderLabel,
  visibleBoothTypes,
  sumBoothsOpen,
  sumBoothsTotal,
  formatCalendarDate,
  formatClock,
} from "@/lib/vendor-hub/vendor-hub-overview"

describe("countBoothRequests", () => {
  it("counts applied, under review, and waitlisted rows", () => {
    assert.equal(
      countBoothRequests(["applied", "under_review", "waitlisted", "paid", "cancelled", null]),
      3
    )
  })
})

describe("booth inventory helpers", () => {
  it("sums remaining and total booths", () => {
    const rows = [
      { available: 2, total: 12, allocated: 10 },
      { available: 2, total: 3, allocated: 1 },
    ]
    assert.equal(sumBoothsOpen(rows), 4)
    assert.equal(sumBoothsTotal(rows), 15)
  })
})

describe("countUnpaidBooths", () => {
  it("counts booths whose fee is still higher than paid", () => {
    assert.equal(
      countUnpaidBooths([
        { boothFee: 160, paid: 160 },
        { boothFee: 175, paid: 0 },
        { boothFee: 150, paid: 150.004 },
        { boothFee: 300, paid: 100 },
      ]),
      2
    )
  })
})

describe("pickReturningVendors", () => {
  it("ranks vendors by bazaar count, then name", () => {
    const ranked = pickReturningVendors(
      [
        {
          contactId: "b",
          businessName: "Zara Crafts",
          eventCount: 4,
          lastEventName: "Spring",
          lastEventDate: "2026-04-01",
        },
        {
          contactId: "a",
          businessName: "Amina Jewelry",
          eventCount: 8,
          lastEventName: "Fall",
          lastEventDate: "2026-10-10",
        },
        {
          contactId: "c",
          businessName: "One-time",
          eventCount: 1,
          lastEventName: "Fall",
          lastEventDate: "2026-10-10",
        },
      ],
      2
    )
    assert.deepEqual(
      ranked.map((row) => row.vendorName),
      ["Amina Jewelry", "Zara Crafts"]
    )
    assert.equal(ranked[0].eventCount, 8)
  })
})

describe("formatCalendarDate", () => {
  it("keeps October 10 on October 10", () => {
    assert.equal(formatCalendarDate("2026-10-10"), "Oct 10, 2026")
    assert.equal(formatCalendarDate("2026-10-10", { weekday: true }), "Sat, Oct 10, 2026")
  })
})

describe("formatClock", () => {
  it("formats 24-hour stored times", () => {
    assert.equal(formatClock("11:00:00"), "11:00 AM")
    assert.equal(formatClock("19:00"), "7:00 PM")
  })
})

describe("visibleBoothTypes", () => {
  it("keeps types that have inventory or reservations", () => {
    const rows = visibleBoothTypes([
      { available: 0, total: 0, allocated: 0 },
      { available: 2, total: 3, allocated: 1 },
    ])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].total, 3)
  })
})

describe("formatBoothOrderLabel", () => {
  it("joins type and table number", () => {
    assert.equal(formatBoothOrderLabel("Regular table", "T12"), "Regular table · T12")
    assert.equal(formatBoothOrderLabel("Lobby table", null), "Lobby table")
  })
})

describe("pickRecentOrders", () => {
  it("keeps the newest payments first", () => {
    const rows = pickRecentOrders(
      [
        {
          id: "old",
          contactId: "a",
          vendorName: "Old",
          boothLabel: "Stage",
          amountPaid: 150,
          paidAt: "2026-08-01",
        },
        {
          id: "new",
          contactId: "b",
          vendorName: "New",
          boothLabel: "Regular table · T4",
          amountPaid: 160,
          paidAt: "2026-10-01",
        },
      ],
      1
    )
    assert.equal(rows[0].id, "new")
  })
})
