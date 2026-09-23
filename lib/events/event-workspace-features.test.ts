import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  getVisibleWorkspaceTabs,
  resolveWorkspaceTabId,
} from "./event-workspace-features"

const features = {
  registration: false,
  staff: false,
  youth: false,
  vendors: false,
  finance: false,
  waitlist: false,
}

describe("event workspace tabs", () => {
  it("shows Volunteers only when the event needs volunteers", () => {
    const hidden = getVisibleWorkspaceTabs({
      features,
      attendanceMode: "open_public",
      needsVolunteers: false,
    }).map((tab) => tab.value)
    assert.equal(hidden.includes("volunteers"), false)

    const shown = getVisibleWorkspaceTabs({
      features,
      attendanceMode: "open_public",
      needsVolunteers: true,
    }).map((tab) => tab.value)
    assert.equal(shown.includes("volunteers"), true)
    assert.equal(shown.includes("staff"), false)
  })

  it("keeps Staff for paid staff without opening Volunteers", () => {
    const tabs = getVisibleWorkspaceTabs({
      features: { ...features, staff: true },
      attendanceMode: "open_public",
      needsVolunteers: false,
    }).map((tab) => tab.value)
    assert.deepEqual(
      tabs.filter((tab) => tab === "staff" || tab === "volunteers"),
      ["staff"]
    )
  })

  it("opens the Volunteers tab from ?tab=volunteers", () => {
    assert.equal(resolveWorkspaceTabId("volunteers"), "volunteers")
    assert.equal(resolveWorkspaceTabId("staff"), "staff")
  })
})
