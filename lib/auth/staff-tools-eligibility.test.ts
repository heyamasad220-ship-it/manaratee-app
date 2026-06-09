import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { STAFF_TOOLS_CONTACT_ROLES } from "./staff-tools-eligibility"

describe("staff tools eligibility", () => {
  it("targets employee contacts for member-portal staff tools", () => {
    assert.deepEqual(STAFF_TOOLS_CONTACT_ROLES, ["employee"])
  })
})
