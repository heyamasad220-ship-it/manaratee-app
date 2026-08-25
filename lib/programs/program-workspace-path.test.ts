import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  parseProgramWorkspaceTab,
  programWorkspaceHref,
  programWorkspaceHrefFromDepartmentYearQuery,
} from "./program-workspace-path"

describe("program workspace paths", () => {
  it("opens overview without a query string", () => {
    assert.equal(programWorkspaceHref("abc"), "/programs/abc")
  })

  it("maps department year bookmarks into the Programs module", () => {
    assert.equal(
      programWorkspaceHrefFromDepartmentYearQuery({
        yearProgramId: "abc",
        tab: "overview",
      }),
      "/programs/abc"
    )
    assert.equal(
      programWorkspaceHrefFromDepartmentYearQuery({
        yearProgramId: "abc",
        tab: "programs",
      }),
      "/programs/abc?tab=offerings"
    )
    assert.equal(
      programWorkspaceHrefFromDepartmentYearQuery({
        yearProgramId: "abc",
        tab: "students",
        section: "review",
      }),
      "/programs/abc?tab=students&section=applications"
    )
    assert.equal(
      programWorkspaceHrefFromDepartmentYearQuery({
        yearProgramId: "abc",
        tab: "schedule",
        section: "activity-planner",
      }),
      "/programs/abc?tab=schedule&section=activity-planner"
    )
    assert.equal(
      programWorkspaceHrefFromDepartmentYearQuery({
        yearProgramId: "abc",
        tab: "settings",
        section: "year-defaults",
      }),
      "/programs/abc?tab=settings&section=defaults"
    )
    assert.equal(
      programWorkspaceHrefFromDepartmentYearQuery({
        yearProgramId: "abc",
        tab: "reports",
        section: "tuition-plans",
      }),
      "/programs/abc?tab=finance&section=payment-summary"
    )
    assert.equal(
      programWorkspaceHrefFromDepartmentYearQuery({
        yearProgramId: "abc",
        tab: "finance",
        section: "payment-summary",
      }),
      "/programs/abc?tab=finance&section=payment-summary"
    )
    assert.equal(
      programWorkspaceHrefFromDepartmentYearQuery({
        yearProgramId: "abc",
        tab: "settings",
        section: "registration",
      }),
      "/programs/abc?tab=settings&section=registration"
    )
  })

  it("opens the schedule tab", () => {
    assert.equal(
      programWorkspaceHref("abc", { tab: "schedule" }),
      "/programs/abc?tab=schedule"
    )
  })

  it("opens program settings sections", () => {
    assert.equal(
      programWorkspaceHref("abc", { tab: "settings" }),
      "/programs/abc?tab=settings"
    )
    assert.equal(
      programWorkspaceHref("abc", {
        tab: "settings",
        settingsSection: "notifications",
      }),
      "/programs/abc?tab=settings&section=notifications"
    )
  })

  it("treats programs as the offerings tab", () => {
    assert.equal(parseProgramWorkspaceTab("programs"), "offerings")
    assert.equal(parseProgramWorkspaceTab("schedule"), "schedule")
    assert.equal(parseProgramWorkspaceTab("finance"), "finance")
    assert.equal(parseProgramWorkspaceTab("reports"), "reports")
  })

  it("opens finance and reports tabs scoped to the program", () => {
    assert.equal(
      programWorkspaceHref("abc", { tab: "finance" }),
      "/programs/abc?tab=finance"
    )
    assert.equal(
      programWorkspaceHref("abc", {
        tab: "finance",
        financeSection: "payment-summary",
      }),
      "/programs/abc?tab=finance&section=payment-summary"
    )
    assert.equal(
      programWorkspaceHref("abc", { tab: "reports" }),
      "/programs/abc?tab=reports"
    )
    assert.equal(
      programWorkspaceHref("abc", {
        tab: "reports",
        reportsSection: "attendance",
      }),
      "/programs/abc?tab=reports&section=attendance"
    )
  })
})
