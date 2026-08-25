import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { departmentDeleteBlockedReason } from "./department-delete-blockers"

describe("departmentDeleteBlockedReason", () => {
  it("allows delete when the department is empty", () => {
    assert.equal(
      departmentDeleteBlockedReason({
        programs: 0,
        offerings: 0,
        employees: 0,
      }),
      null
    )
  })

  it("lists programs, offerings, and employees together", () => {
    assert.equal(
      departmentDeleteBlockedReason({
        programs: 2,
        offerings: 26,
        employees: 11,
      }),
      "This department still has 2 programs, 26 offerings, and 11 employees. Move or remove them first."
    )
  })

  it("uses singular labels for a single leftover", () => {
    assert.equal(
      departmentDeleteBlockedReason({
        programs: 1,
        offerings: 0,
        employees: 0,
      }),
      "This department still has 1 program. Move or remove them first."
    )
  })
})
