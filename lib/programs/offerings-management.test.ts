import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { formatOfferingScheduleCompact } from "./offering-schedule-summary"
import {
  buildOfferingsManagementHref,
  DEFAULT_OFFERINGS_MANAGEMENT_FILTERS,
  filterOfferingsManagementRows,
  formatManagementEnrollment,
  formatManagementFee,
  groupOfferingsByProgram,
  isOfferingFull,
  isOfferingNearlyFull,
  matchesOfferingsManagementSearch,
  parseOfferingsManagementFilters,
  sortOfferingsManagementRows,
  summarizeOfferingsManagement,
  type OfferingsManagementRow,
} from "./offerings-management"

function row(
  overrides: Partial<OfferingsManagementRow> = {}
): OfferingsManagementRow {
  return {
    id: "off-1",
    name: "Memorization (Surat Al-Baqara)",
    status: "active",
    programId: "prog-1",
    programName: "Quran Institute for Ladies 2026–2027",
    programKind: "academic",
    departmentId: "dept-1",
    departmentName: "Quran Institute for Ladies",
    primaryInstructor: "Aisha Khan",
    deliveryFormat: "in_person",
    scheduleLabel: "Sun · 10:00 AM–2:00 PM",
    feeAmount: 450,
    feeIsFree: false,
    feeAvailable: true,
    enrolled: 41,
    capacityMode: "limited",
    capacity: 42,
    waitlistCount: 0,
    registrationState: "open",
    isCurrent: true,
    offeringHref: "/programs/prog-1/offerings/off-1",
    programHref: "/programs/prog-1",
    editHref: "/programs/prog-1/offerings/off-1?edit=1",
    ...overrides,
  }
}

describe("offerings management helpers", () => {
  it("defaults status to Active and omits it from the URL", () => {
    const filters = parseOfferingsManagementFilters({})
    assert.equal(filters.status, "active")
    assert.equal(buildOfferingsManagementHref(filters), "/programs/catalog")
    assert.equal(
      buildOfferingsManagementHref({ ...filters, status: "all" }),
      "/programs/catalog?status=all"
    )
  })

  it("searches offering, program, department, and instructor names", () => {
    const sample = row()
    assert.equal(matchesOfferingsManagementSearch(sample, "baqara"), true)
    assert.equal(matchesOfferingsManagementSearch(sample, "institute"), true)
    assert.equal(matchesOfferingsManagementSearch(sample, "ladies"), true)
    assert.equal(matchesOfferingsManagementSearch(sample, "aisha"), true)
    assert.equal(matchesOfferingsManagementSearch(sample, "zzz"), false)
  })

  it("formats fees and enrollment without inventing capacity", () => {
    assert.ok(formatManagementFee(row()).includes("450"))
    assert.equal(formatManagementFee(row({ feeIsFree: true, feeAmount: 0 })), "Free")
    assert.equal(
      formatManagementFee(row({ feeAvailable: false, feeAmount: null })),
      "—"
    )
    assert.equal(formatManagementEnrollment(row()), "41 / 42")
    assert.equal(
      formatManagementEnrollment(
        row({ capacityMode: "unlimited", capacity: null, enrolled: 32 })
      ),
      "32"
    )
  })

  it("treats 80% as nearly full without marking it full", () => {
    const nearly = row({ enrolled: 16, capacity: 20 })
    assert.equal(isOfferingNearlyFull(nearly), true)
    assert.equal(isOfferingFull(nearly), false)
    assert.equal(isOfferingFull(row({ enrolled: 42, capacity: 42 })), true)
    assert.equal(
      isOfferingNearlyFull(
        row({ capacityMode: "unlimited", capacity: null, enrolled: 90 })
      ),
      false
    )
  })

  it("filters by status, registration, and waitlist without inventing waitlist rows", () => {
    const rows = [
      row(),
      row({
        id: "off-2",
        name: "Draft Class",
        status: "draft",
        registrationState: "closed",
        enrolled: 0,
        waitlistCount: 0,
      }),
      row({
        id: "off-3",
        name: "Waitlisted Class",
        enrolled: 42,
        waitlistCount: 3,
      }),
    ]
    assert.equal(
      filterOfferingsManagementRows(rows, {
        ...DEFAULT_OFFERINGS_MANAGEMENT_FILTERS,
      }).length,
      2
    )
    assert.equal(
      filterOfferingsManagementRows(rows, {
        ...DEFAULT_OFFERINGS_MANAGEMENT_FILTERS,
        status: "all",
        enrollment: "waitlisted",
      }).map((item) => item.id).join(),
      "off-3"
    )
  })

  it("summarizes live offering counts and groups by parent program", () => {
    const rows = [
      row(),
      row({
        id: "off-2",
        name: "Second",
        status: "draft",
        enrolled: 10,
        capacity: 10,
        waitlistCount: 2,
        registrationState: "closed",
      }),
    ]
    const summary = summarizeOfferingsManagement(rows)
    assert.equal(summary.total, 2)
    assert.equal(summary.active, 1)
    assert.equal(summary.registrationOpen, 1)
    assert.equal(summary.full, 1)
    assert.equal(summary.waitlisted, 1)

    const groups = groupOfferingsByProgram(rows)
    assert.equal(groups.length, 1)
    assert.equal(groups[0].enrolled, 51)
    assert.equal(groups[0].programKindLabel, "Academic")
  })

  it("sorts by offering, program, department, enrollment, and status", () => {
    const rows = [
      row({ id: "b", name: "Beta", enrolled: 10, status: "draft" }),
      row({ id: "a", name: "Alpha", enrolled: 30, status: "active" }),
    ]
    assert.equal(
      sortOfferingsManagementRows(rows, "offering", "asc")[0].name,
      "Alpha"
    )
    assert.equal(
      sortOfferingsManagementRows(rows, "enrollment", "desc")[0].enrolled,
      30
    )
    assert.equal(
      sortOfferingsManagementRows(rows, "status", "asc")[0].status,
      "active"
    )
  })
})

describe("compact offering schedule", () => {
  it("formats single and multi-day meetings", () => {
    assert.equal(
      formatOfferingScheduleCompact([
        {
          day_of_week: "sunday",
          start_time: "10:00:00",
          end_time: "14:00:00",
        },
      ]),
      "Sun · 10:00 AM–2:00 PM"
    )
    assert.equal(
      formatOfferingScheduleCompact([
        {
          day_of_week: "tuesday",
          start_time: "10:00:00",
          end_time: "12:00:00",
        },
        {
          day_of_week: "thursday",
          start_time: "10:00:00",
          end_time: "12:00:00",
        },
      ]),
      "Tue/Thu · 10:00 AM–12:00 PM"
    )
    assert.equal(formatOfferingScheduleCompact([]), null)
  })
})
