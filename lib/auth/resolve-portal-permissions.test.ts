import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { countAvailablePortals } from "./resolve-portal-permissions"
import { getActivePortalId } from "@/components/portal/portal-switcher"

describe("countAvailablePortals", () => {
  it("returns zero when no portals are available", () => {
    assert.equal(
      countAvailablePortals({
        hasPersonalPortal: false,
        hasStaffToolsPortal: false,
        hasTeachingPortal: false,
        hasAdminPortal: false,
      }),
      0
    )
  })

  it("counts each enabled portal", () => {
    assert.equal(
      countAvailablePortals({
        hasPersonalPortal: true,
        hasStaffToolsPortal: true,
        hasTeachingPortal: false,
        hasAdminPortal: true,
      }),
      3
    )
  })
})

describe("getActivePortalId", () => {
  it("detects staff tools routes", () => {
    assert.equal(getActivePortalId("/customer/staff/events/request"), "staff")
  })

  it("detects member portal routes", () => {
    assert.equal(getActivePortalId("/customer/rentals"), "member")
  })

  it("detects teaching portal routes", () => {
    assert.equal(getActivePortalId("/my-classes/offering-1"), "teaching")
  })

  it("detects admin dashboard routes", () => {
    assert.equal(getActivePortalId("/event-management/requests"), "admin")
    assert.equal(getActivePortalId("/facilities/calendar"), "admin")
  })
})
