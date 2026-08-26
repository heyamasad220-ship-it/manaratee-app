import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildEnrollmentByOffering,
  buildEnrollmentSummaryTotals,
  buildRegistrationTrends,
} from "./program-enrollment-summary"

describe("program enrollment summary", () => {
  it("counts enrolled, waitlisted, and cancelled per offering", () => {
    const { rows, hasCapacity } = buildEnrollmentByOffering(
      [
        {
          id: "off-beg",
          name: "Tajweed (Beginner)",
          teacherName: "Souzan Ayoub",
          capacity: 20,
          capacityMode: "limited",
        },
        {
          id: "off-adv",
          name: "Tajweed (Advanced)",
          teacherName: null,
          capacity: null,
          capacityMode: "unlimited",
        },
      ],
      [
        { offeringId: "off-beg", status: "enrolled", registeredAt: "2026-08-01" },
        { offeringId: "off-beg", status: "active", registeredAt: "2026-08-02" },
        { offeringId: "off-beg", status: "waitlisted", registeredAt: "2026-08-03" },
        { offeringId: "off-beg", status: "cancelled", registeredAt: "2026-08-04" },
        { offeringId: "off-adv", status: "enrolled", registeredAt: "2026-08-01" },
      ]
    )

    assert.equal(hasCapacity, true)
    const beginner = rows.find((row) => row.offeringId === "off-beg")
    const advanced = rows.find((row) => row.offeringId === "off-adv")
    assert.equal(beginner?.enrolled, 2)
    assert.equal(beginner?.waitlisted, 1)
    assert.equal(beginner?.cancelled, 1)
    assert.equal(beginner?.capacity, 20)
    assert.equal(beginner?.available, 18)
    assert.equal(advanced?.capacity, null)
    assert.equal(advanced?.available, null)
    assert.equal(advanced?.enrolled, 1)
  })

  it("hides available seats when no offering has limited capacity", () => {
    const { rows, hasCapacity } = buildEnrollmentByOffering(
      [
        {
          id: "off-1",
          name: "Al Nouraniyyeh",
          teacherName: null,
          capacity: 0,
          capacityMode: "unlimited",
        },
      ],
      [{ offeringId: "off-1", status: "enrolled", registeredAt: "2026-08-01" }]
    )
    assert.equal(hasCapacity, false)
    assert.equal(rows[0]?.available, null)
  })

  it("builds monthly registration trends", () => {
    const trends = buildRegistrationTrends([
      { offeringId: "a", status: "enrolled", registeredAt: "2026-07-15" },
      { offeringId: "a", status: "enrolled", registeredAt: "2026-08-01" },
      { offeringId: "a", status: "cancelled", registeredAt: "2026-08-20" },
    ])
    assert.equal(trends.length, 2)
    assert.equal(trends[0]?.registered, 1)
    assert.equal(trends[1]?.registered, 2)
  })

  it("summarizes program totals from the same enrollment rows", () => {
    const byOffering = buildEnrollmentByOffering(
      [
        {
          id: "off-1",
          name: "Class",
          teacherName: null,
          capacity: 10,
          capacityMode: "limited",
        },
      ],
      [
        { offeringId: "off-1", status: "enrolled", registeredAt: null },
        { offeringId: "off-1", status: "waitlisted", registeredAt: null },
        { offeringId: "off-1", status: "cancelled", registeredAt: null },
      ]
    )
    const totals = buildEnrollmentSummaryTotals(
      [
        { offeringId: "off-1", status: "enrolled", registeredAt: null },
        { offeringId: "off-1", status: "waitlisted", registeredAt: null },
        { offeringId: "off-1", status: "cancelled", registeredAt: null },
      ],
      1,
      byOffering.rows,
      byOffering.hasCapacity
    )
    assert.equal(totals.enrolled, 1)
    assert.equal(totals.waitlisted, 1)
    assert.equal(totals.cancelled, 1)
    assert.equal(totals.offerings, 1)
    assert.equal(totals.availableSeats, 9)
  })
})
