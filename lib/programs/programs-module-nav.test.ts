import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  PROGRAMS_MODULE_TABS,
  resolveProgramsModuleTab,
} from "./programs-module-nav"

describe("programs module nav", () => {
  it("lists Overview through Reports without Academic/Seasonal splits", () => {
    assert.deepEqual(
      PROGRAMS_MODULE_TABS.map((tab) => tab.label),
      [
        "Overview",
        "Programs",
        "Offerings",
        "Registrations",
        "Finance",
        "Financial Assistance",
        "Reports",
      ]
    )
  })

  it("resolves Programs Home and the combined programs list", () => {
    assert.equal(resolveProgramsModuleTab("/programs"), "overview")
    assert.equal(resolveProgramsModuleTab("/programs/list"), "programs")
    assert.equal(resolveProgramsModuleTab("/programs/catalog"), "offerings")
    assert.equal(
      resolveProgramsModuleTab("/programs/catalog?kind=academic"),
      "offerings"
    )
  })

  it("keeps finance and reports on their own tabs", () => {
    assert.equal(resolveProgramsModuleTab("/finance/transactions"), "finance")
    assert.equal(resolveProgramsModuleTab("/finance/payroll"), "finance")
    assert.equal(
      resolveProgramsModuleTab("/finance/financial-assistance"),
      "financial-assistance"
    )
    assert.equal(
      resolveProgramsModuleTab("/programs/reports/enrollments"),
      "reports"
    )
    assert.equal(
      resolveProgramsModuleTab("/programs/registrations"),
      "registrations"
    )
  })

  it("treats a program workspace as the Programs tab", () => {
    assert.equal(
      resolveProgramsModuleTab(
        "/programs/78616758-d6fc-4a48-a99c-f8ea24a34646"
      ),
      "programs"
    )
    assert.equal(
      resolveProgramsModuleTab(
        "/programs/78616758-d6fc-4a48-a99c-f8ea24a34646?tab=offerings"
      ),
      "programs"
    )
  })

  it("treats an offering workspace as the Offerings tab", () => {
    assert.equal(
      resolveProgramsModuleTab(
        "/programs/78616758-d6fc-4a48-a99c-f8ea24a34646/offerings/7a373fc2-f9b5-48ac-aa92-47249ca65330"
      ),
      "offerings"
    )
    assert.equal(
      resolveProgramsModuleTab(
        "/programs/78616758-d6fc-4a48-a99c-f8ea24a34646/offerings/7a373fc2-f9b5-48ac-aa92-47249ca65330?edit=1"
      ),
      "offerings"
    )
  })
})
