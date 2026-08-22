import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  directoryRoleExtraColumns,
  directoryRolePath,
  getDirectoryAssignableRoles,
  isDirectoryDynamicRoleKey,
  populatedDirectoryRoles,
} from "./directory-roles"

describe("directory roles", () => {
  it("hides empty role views and keeps a stable order", () => {
    const populated = populatedDirectoryRoles({
      employees: 48,
      volunteers: 120,
      donors: 1930,
      vendors: 0,
    })

    assert.deepEqual(
      populated.map((role) => role.key),
      ["employees", "volunteers", "donors", "service-providers"]
    )
  })

  it("always shows Service Providers in Directory even with no records", () => {
    const populated = populatedDirectoryRoles({})
    assert.deepEqual(
      populated.map((role) => role.key),
      ["service-providers"]
    )
  })

  it("maps role keys to directory routes", () => {
    assert.equal(isDirectoryDynamicRoleKey("vendors"), true)
    assert.equal(isDirectoryDynamicRoleKey("sponsors"), true)
    assert.equal(isDirectoryDynamicRoleKey("sponsor"), false)
    assert.equal(
      directoryRolePath("service-providers"),
      "/directory/role/service-providers"
    )
  })

  it("lets organizations hold vendor and service provider together", () => {
    const values = getDirectoryAssignableRoles("organization").map((role) => role.value)
    assert.equal(values.includes("vendor"), true)
    assert.equal(values.includes("service_provider"), true)
    assert.equal(values.includes("sponsor"), true)
  })

  it("exposes lookup columns for operational role views", () => {
    const employeeCols = directoryRoleExtraColumns("employees").map((column) => column.key)
    assert.deepEqual(employeeCols, [
      "department",
      "position",
      "employmentType",
      "roleStatus",
    ])
    assert.equal(
      directoryRoleExtraColumns("donors").some((column) => column.key === "lifetimeGiving"),
      true
    )
  })
})
