import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_REGISTRATION_COLUMNS,
  normalizeRegistrationColumns,
  toggleRegistrationColumn,
} from "./registration-table-columns"

describe("registration table columns", () => {
  it("defaults to operational columns without demographic clutter", () => {
    assert.deepEqual(DEFAULT_REGISTRATION_COLUMNS, [
      "participant",
      "guardian",
      "offering",
      "teacher",
      "status",
      "registered",
      "actions",
    ])
    assert.equal(DEFAULT_REGISTRATION_COLUMNS.includes("dob"), false)
    assert.equal(DEFAULT_REGISTRATION_COLUMNS.includes("program"), false)
  })

  it("falls back to defaults for empty or invalid stored values", () => {
    assert.deepEqual(normalizeRegistrationColumns(null), DEFAULT_REGISTRATION_COLUMNS)
    assert.deepEqual(normalizeRegistrationColumns([]), DEFAULT_REGISTRATION_COLUMNS)
    assert.deepEqual(
      normalizeRegistrationColumns(["participant", "secret_id", "status"]),
      ["participant", "status", "actions"]
    )
  })

  it("keeps participant and actions columns locked on", () => {
    assert.deepEqual(
      toggleRegistrationColumn(["participant", "status", "actions"], "actions", false),
      ["participant", "status", "actions"]
    )
    assert.deepEqual(
      toggleRegistrationColumn(["participant", "status", "actions"], "dob", true),
      ["participant", "dob", "status", "actions"]
    )
  })
})
