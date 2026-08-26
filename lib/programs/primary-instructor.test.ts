import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { resolveClassTimeInstructorName } from "./primary-instructor"

describe("resolveClassTimeInstructorName", () => {
  it("uses the class-time instructor when the slot has one", () => {
    assert.equal(
      resolveClassTimeInstructorName("Souzan Ayoub", "Rajaa Eljaber"),
      "Souzan Ayoub"
    )
  })

  it("falls back to the offering primary instructor", () => {
    assert.equal(
      resolveClassTimeInstructorName(null, "Rajaa Eljaber"),
      "Rajaa Eljaber"
    )
    assert.equal(resolveClassTimeInstructorName("  ", "Rajaa Eljaber"), "Rajaa Eljaber")
  })

  it("stays empty when neither source has a teacher", () => {
    assert.equal(resolveClassTimeInstructorName(null, null), null)
    assert.equal(resolveClassTimeInstructorName(" ", ""), null)
  })
})
