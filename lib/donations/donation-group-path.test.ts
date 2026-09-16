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

  it("maps leftover Employees bookmarks to Financial", () => {
    assert.equal(parseDepartmentWorkspaceTab("employees"), "financial")
  })
})

describe("departmentGroupWorkspaceHref", () => {
  it("emits Financial → Employees for the Employees sub-tab", () => {
    assert.match(
      departmentGroupWorkspaceHref("dept-1", { tab: "employees" }),
      /tab=financial/
    )
    assert.match(
      departmentGroupWorkspaceHref("dept-1", { tab: "employees" }),
      /section=employees/
    )
  })

  it("keeps Financial → Employees on the Financial tab", () => {
    const href = departmentGroupWorkspaceHref("dept-1", {
      tab: "financial",
      finance: "employees",
    })
    assert.match(href, /tab=financial/)
    assert.match(href, /section=employees/)
  })
})

describe("parseDepartmentFinanceSection", () => {
  it("defaults Financial to Payroll", () => {
    assert.equal(parseDepartmentFinanceSection("financial", null), "payroll")
  })

  it("reads leftover ?tab=employees as Financial → Employees", () => {
    assert.equal(parseDepartmentFinanceSection("employees", null), "employees")
  })

  it("reads Financial → Employees from the section query", () => {
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
