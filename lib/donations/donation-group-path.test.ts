import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  departmentGroupWorkspaceHref,
  isMovedDepartmentSettingsSection,
  parseDepartmentFinanceSection,
  parseDepartmentWorkspaceTab,
} from "./donation-group-path"

describe("parseDepartmentWorkspaceTab", () => {
  it("maps the retired Reports tab to Financial", () => {
    assert.equal(parseDepartmentWorkspaceTab("reports"), "financial")
  })

  it("maps the retired Schedule tab to Programs", () => {
    assert.equal(parseDepartmentWorkspaceTab("schedule"), "programs")
  })

  it("keeps Financial as Financial", () => {
    assert.equal(parseDepartmentWorkspaceTab("financial"), "financial")
  })

  it("keeps Employees as a top-level tab", () => {
    assert.equal(parseDepartmentWorkspaceTab("employees"), "employees")
  })
})

describe("departmentGroupWorkspaceHref", () => {
  it("emits ?tab=employees for the Employees tab", () => {
    assert.match(
      departmentGroupWorkspaceHref("dept-1", { tab: "employees" }),
      /tab=employees/
    )
  })

  it("rewrites leftover Financial → Employees to the Employees tab", () => {
    assert.match(
      departmentGroupWorkspaceHref("dept-1", {
        tab: "financial",
        finance: "employees",
      }),
      /tab=employees/
    )
  })
})

describe("parseDepartmentFinanceSection", () => {
  it("defaults Financial to Payroll", () => {
    assert.equal(parseDepartmentFinanceSection("financial", null), "payroll")
  })

  it("still reads leftover Financial → Employees section", () => {
    assert.equal(
      parseDepartmentFinanceSection("financial", "employees"),
      "employees"
    )
  })
})

describe("moved department settings sections", () => {
  it("recognizes leftover program-policy bookmarks", () => {
    assert.equal(isMovedDepartmentSettingsSection("registration"), true)
    assert.equal(isMovedDepartmentSettingsSection("notifications"), true)
    assert.equal(isMovedDepartmentSettingsSection("promo-codes"), true)
    assert.equal(isMovedDepartmentSettingsSection("year-defaults"), true)
    assert.equal(isMovedDepartmentSettingsSection("service-needs"), true)
    assert.equal(isMovedDepartmentSettingsSection("general"), false)
  })
})
