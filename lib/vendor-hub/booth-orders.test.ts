import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  BOOTH_ORDER_COLUMN_IDS,
  boothOrdersToCsv,
  defaultBoothOrderColumns,
  resolveBoothOrderStatus,
  resolveVendorTypeName,
  toggleBoothOrderColumn,
} from "./booth-orders"
import { canonicalBoothTypeName } from "./booth-type-names"

const catalog = [
  { name: "Coffee", slug: "coffee" },
  { name: "Hot Food", slug: "hot-food" },
  { name: "Juice / Smoothies", slug: "juice-smoothies" },
  { name: "Clothin/ Apparel", slug: "retail-merchandise" },
]

describe("booth order columns", () => {
  it("keeps Vendor, Email, Phone, Type, and Booth type as separate columns", () => {
    assert.deepEqual(
      [...BOOTH_ORDER_COLUMN_IDS],
      [
        "event",
        "vendor",
        "contact",
        "email",
        "phone",
        "type",
        "boothType",
        "booth",
        "status",
        "boothFee",
        "paid",
        "paidDate",
      ]
    )
  })

  it("hides Event by default on the event-scoped report", () => {
    assert.equal(defaultBoothOrderColumns("reports").includes("event"), true)
    assert.equal(defaultBoothOrderColumns("event").includes("event"), false)
  })

  it("keeps Vendor visible even when unchecked", () => {
    const next = toggleBoothOrderColumn(defaultBoothOrderColumns("reports"), "vendor", false)
    assert.equal(next.includes("vendor"), true)
  })

  it("hides optional columns", () => {
    const next = toggleBoothOrderColumn(defaultBoothOrderColumns("reports"), "contact", false)
    assert.equal(next.includes("contact"), false)
    assert.equal(next.includes("vendor"), true)
  })
})

describe("vendor type vs booth type", () => {
  it("uses the catalog vendor type when present", () => {
    assert.equal(
      resolveVendorTypeName({
        catalogName: "Clothin/ Apparel",
        notesCategory: "Regular Booth - Main Prayer Hall",
        catalog,
      }),
      "Clothin/ Apparel"
    )
  })

  it("maps Eventbrite coffee / hot meal tickets to selling type, not booth layout", () => {
    assert.equal(
      resolveVendorTypeName({
        notesCategory: "Coffee",
        catalog,
      }),
      "Coffee"
    )
    assert.equal(
      resolveVendorTypeName({
        notesCategory: "Food Vendors between the two buildings (Hot Meal)",
        catalog,
      }),
      "Hot Food"
    )
    assert.equal(
      resolveVendorTypeName({
        notesCategory: "Booth in the entrance (Lobby)",
        catalog,
      }),
      null
    )
  })

  it("canonicalizes Eventbrite tickets onto physical booth types", () => {
    assert.equal(
      canonicalBoothTypeName("Booth in the entrance (Lobby)"),
      "Lobby table"
    )
    assert.equal(canonicalBoothTypeName("Coffee"), "Coffee (lobby or truck)")
    assert.equal(
      canonicalBoothTypeName("Regular Booth - Main Prayer Hall"),
      "Regular table"
    )
  })
})

describe("booth order status and csv", () => {
  it("marks a fully paid booth as paid", () => {
    assert.equal(
      resolveBoothOrderStatus({
        paid: 150,
        boothFee: 150,
        assignmentStatus: "confirmed",
      }),
      "paid"
    )
  })

  it("keeps reserved when nothing is paid", () => {
    assert.equal(
      resolveBoothOrderStatus({
        paid: 0,
        boothFee: 150,
        assignmentStatus: "reserved",
      }),
      "reserved"
    )
  })

  it("escapes quotes in csv export", () => {
    const csv = boothOrdersToCsv([
      {
        id: "1",
        eventId: "e1",
        eventName: 'MAS "Fall" Bazaar',
        eventDate: "2026-10-10",
        contactId: "c1",
        vendorName: "Abranwear",
        contactName: "Faheem",
        email: "info@example.com",
        phone: "2145551212",
        vendorType: "Clothin/ Apparel",
        vendorTypeId: "t1",
        boothType: "Lobby table",
        boothNumber: "L1",
        boothId: "b1",
        assignmentId: "a1",
        participantId: null,
        status: "paid",
        boothFee: 300,
        paid: 300,
        paymentCount: 1,
        paidAt: "2026-09-01",
        notes: null,
        profileHref: "/vendor-hub/network/vendors/c1",
      },
    ])
    assert.match(csv, /"MAS ""Fall"" Bazaar"/)
    assert.match(csv, /"Vendor","Contact","Email","Phone"/)
    assert.match(csv, /"Type","Booth type"/)
  })
})
