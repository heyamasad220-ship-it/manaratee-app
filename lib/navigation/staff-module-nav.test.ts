import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildAdministrationChildren,
  buildProgramsChildren,
  isHiddenTopLevelStaffModule,
} from "./staff-module-nav"

describe("staff module nav", () => {
  it("hides Workforce and Finance-when-Programs from the rail", () => {
    const slugs = new Set(["workforce", "programs", "finance", "event-management"])
    assert.equal(isHiddenTopLevelStaffModule("workforce", slugs), true)
    assert.equal(isHiddenTopLevelStaffModule("finance", slugs), true)
    assert.equal(isHiddenTopLevelStaffModule("programs", slugs), false)
    assert.equal(isHiddenTopLevelStaffModule("event-management", slugs), false)
  })

  it("keeps Finance when Programs is not subscribed", () => {
    const slugs = new Set(["finance"])
    assert.equal(isHiddenTopLevelStaffModule("finance", slugs), false)
  })

  it("nests Academic and Seasonal under Programs when both kinds are allowed", () => {
    const labels = buildProgramsChildren("both").map((item) => item.label)
    assert.deepEqual(labels.slice(0, 2), ["Academic", "Seasonal"])
    assert.equal(labels.includes("Financial Assistance"), true)
    assert.equal(labels.includes("Reports"), true)
  })

  it("omits the unused program-kind sibling", () => {
    assert.deepEqual(
      buildProgramsChildren("academic").map((item) => item.label),
      ["Academic", "Financial Assistance", "Reports"]
    )
    assert.deepEqual(
      buildProgramsChildren("seasonal").map((item) => item.label),
      ["Seasonal", "Financial Assistance", "Reports"]
    )
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
})
