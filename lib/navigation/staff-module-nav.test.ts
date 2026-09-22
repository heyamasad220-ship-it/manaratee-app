import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildAdministrationChildren,
  buildEventManagementChildren,
  buildProgramsChildren,
  isAdministrationNavEnabled,
  isHiddenTopLevelStaffModule,
} from "./staff-module-nav"

describe("staff module nav", () => {
  it("hides Workforce and Finance-when-Programs from the rail", () => {
    const slugs = new Set(["workforce", "programs", "finance", "event-management"])
    assert.equal(isHiddenTopLevelStaffModule("workforce", slugs), true)
    assert.equal(isHiddenTopLevelStaffModule("finance", slugs), true)
    assert.equal(isHiddenTopLevelStaffModule("programs", slugs), false)
    assert.equal(isHiddenTopLevelStaffModule("event-management", slugs), false)
    assert.equal(isHiddenTopLevelStaffModule("community-calendar", slugs), true)
  })

  it("keeps Finance when Programs is not subscribed", () => {
    const slugs = new Set(["finance"])
    assert.equal(isHiddenTopLevelStaffModule("finance", slugs), false)
  })

  it("builds a Programs flyout with Overview through Settings", () => {
    const labels = buildProgramsChildren("both").map((item) => item.label)
    assert.deepEqual(labels, [
      "Overview",
      "All programs",
      "Registrations",
      "Finance",
      "Financial Assistance",
      "Reports",
      "Settings",
    ])
    assert.deepEqual(
      buildProgramsChildren("academic").map((item) => item.label),
      labels
    )
    assert.deepEqual(
      buildProgramsChildren("seasonal").map((item) => item.label),
      labels
    )
    const overview = buildProgramsChildren("both").find(
      (item) => item.label === "Overview"
    )
    const allPrograms = buildProgramsChildren("both").find(
      (item) => item.label === "All programs"
    )
    assert.equal(overview?.href, "/programs")
    assert.equal(overview?.exact, true)
    assert.equal(allPrograms?.href, "/programs/list")
  })

  it("hides Administration unless Programs or Event Management is on", () => {
    assert.equal(isAdministrationNavEnabled(new Set(["donations"])), false)
    assert.equal(isAdministrationNavEnabled(new Set(["membership"])), false)
    assert.equal(isAdministrationNavEnabled(new Set(["workforce"])), false)
    assert.equal(isAdministrationNavEnabled(new Set(["programs"])), true)
    assert.equal(isAdministrationNavEnabled(new Set(["event-management"])), true)
  })

  it("shows Volunteers when Programs or Event Management is on", () => {
    const withPrograms = buildAdministrationChildren(new Set(["programs"])).map(
      (item) => item.label
    )
    assert.equal(withPrograms.includes("Volunteers"), true)
    assert.equal(withPrograms.includes("Child Care Providers"), true)

    const adminOnly = buildAdministrationChildren(new Set()).map((item) => item.label)
    assert.deepEqual(adminOnly, ["Departments", "Employees"])
  })

  it("shows Service Providers only when Facilities is enabled", () => {
    const withFacilities = buildAdministrationChildren(new Set(["spaces"])).map(
      (item) => item.label
    )
    assert.equal(withFacilities.includes("Service Providers"), true)
    assert.equal(
      buildAdministrationChildren(new Set(["programs"])).some(
        (item) => item.label === "Service Providers"
      ),
      false
    )
  })

  it("puts Reports on Event Management with Childcare under that prefix", () => {
    const children = buildEventManagementChildren()
    const labels = children.map((item) => item.label)
    assert.deepEqual(labels, [
      "Overview",
      "Events",
      "Master Calendar",
      "Ticketing",
      "Reports",
      "Settings",
    ])
    const ticketing = children.find((item) => item.label === "Ticketing")
    assert.equal(ticketing?.href, "/event-management/ticketing")
    assert.equal(ticketing?.matchPrefix, "/event-management/ticketing")
    const reports = children.find((item) => item.label === "Reports")
    assert.equal(reports?.href, "/event-management/reports")
    assert.equal(reports?.matchPrefix, "/event-management/reports")

    const overview = children.find((item) => item.label === "Overview")
    const events = children.find((item) => item.label === "Events")
    assert.equal(overview?.href, "/event-management")
    assert.equal(overview?.exact, true)
    assert.equal(events?.href, "/event-management/events")
    assert.equal(events?.matchPrefix, "/event-management")
  })
})
