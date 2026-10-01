import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  getVisibleWorkspaceTabs,
  resolveEventWorkspaceFeatures,
  resolveWorkspaceTabId,
} from "./event-workspace-features"

const features = {
  registration: false,
  staff: false,
  youth: false,
  vendors: false,
  finance: false,
  waitlist: false,
  plan: false,
  sponsors: false,
  volunteers: false,
  childcare: false,
}

describe("event workspace tabs", () => {
  it("hides Sign-ups until volunteers or childcare is on", () => {
    const tabs = getVisibleWorkspaceTabs({
      features,
      attendanceMode: "open_public",
      needsVolunteers: false,
    }).map((tab) => tab.value)
    assert.equal(tabs.includes("volunteers"), false)
    assert.equal(tabs.includes("staff"), false)
    assert.deepEqual(
      tabs.filter((tab) => tab === "overview" || tab === "reports" || tab === "settings"),
      ["overview", "reports", "settings"]
    )
  })

  it("shows Sign-ups for volunteers or childcare", () => {
    const volunteers = getVisibleWorkspaceTabs({
      features: { ...features, volunteers: true },
      attendanceMode: "open_public",
    }).map((tab) => tab.value)
    const childcare = getVisibleWorkspaceTabs({
      features: { ...features, childcare: true },
      attendanceMode: "open_public",
    }).map((tab) => tab.value)
    assert.equal(volunteers.includes("volunteers"), true)
    assert.equal(volunteers.includes("childcare"), false)
    assert.equal(childcare.includes("volunteers"), true)
    assert.equal(childcare.includes("childcare"), true)
  })

  it("keeps Staff for paid staff", () => {
    const tabs = getVisibleWorkspaceTabs({
      features: { ...features, staff: true },
      attendanceMode: "open_public",
    }).map((tab) => tab.value)
    assert.equal(tabs.includes("staff"), true)
    assert.equal(tabs.includes("volunteers"), false)
  })

  it("shows Plan, Ticketing, and Sponsors only when those switches are on", () => {
    const off = getVisibleWorkspaceTabs({
      features,
      attendanceMode: "open_public",
    }).map((tab) => tab.value)
    assert.equal(off.includes("plan"), false)
    assert.equal(off.includes("ticketing"), false)
    assert.equal(off.includes("sponsors"), false)
    assert.equal(off.includes("reports"), true)

    const on = getVisibleWorkspaceTabs({
      features: { ...features, plan: true, registration: true, sponsors: true },
      attendanceMode: "paid",
    }).map((tab) => tab.value)
    assert.equal(on.includes("plan"), true)
    assert.equal(on.includes("ticketing"), true)
    assert.equal(on.includes("sponsors"), true)
    assert.equal(resolveWorkspaceTabId("finance"), "reports")
    assert.equal(resolveWorkspaceTabId("reports"), "reports")
  })

  it("never shows a Youth tab", () => {
    const tabs = getVisibleWorkspaceTabs({
      features: { ...features, youth: true },
      attendanceMode: "paid",
    }).map((tab) => tab.value)
    assert.equal(tabs.includes("youth"), false)
    assert.equal(resolveWorkspaceTabId("youth"), "overview")
    assert.equal(resolveWorkspaceTabId("childcare"), "childcare")
  })

  it("infers unsaved switches from existing event data", () => {
    const inferred = resolveEventWorkspaceFeatures({
      requires_ticketing: true,
      requires_volunteers: false,
      requires_childcare: true,
      requires_vendors: false,
      hasPlanningQuote: true,
      hasSponsors: true,
    })
    assert.equal(inferred.registration, true)
    assert.equal(inferred.volunteers, false)
    assert.equal(inferred.childcare, true)
    assert.equal(inferred.plan, true)
    assert.equal(inferred.sponsors, true)
    assert.equal(inferred.staff, false)

    const saved = resolveEventWorkspaceFeatures({
      workspace_features: { plan: false, sponsors: false, registration: false },
      requires_ticketing: true,
      hasPlanningQuote: true,
      hasSponsors: true,
    })
    assert.equal(saved.plan, false)
    assert.equal(saved.sponsors, false)
    assert.equal(saved.registration, false)
  })

  it("opens Ticketing from ticket and order aliases", () => {
    assert.equal(resolveWorkspaceTabId("ticketing"), "ticketing")
    assert.equal(resolveWorkspaceTabId("tickets"), "ticketing")
    assert.equal(resolveWorkspaceTabId("orders"), "ticketing")
  })

  it("opens the Sign-ups tab from volunteers and sign-ups", () => {
    assert.equal(resolveWorkspaceTabId("volunteers"), "volunteers")
    assert.equal(resolveWorkspaceTabId("sign-ups"), "volunteers")
    assert.equal(resolveWorkspaceTabId("staff"), "staff")
  })
})
