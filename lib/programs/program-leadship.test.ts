import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { programLeadNavEntries } from "./program-lead-nav"
import { isLeadOfProgram, type ProgramLeadship } from "./program-leadship"

const sample: ProgramLeadship[] = [
  {
    organizationId: "org-1",
    programId: "prog-sunday",
    programName: "Sunday School 2026-2027",
    departmentId: "dept-edu",
    contactId: "contact-1",
  },
]

describe("isLeadOfProgram", () => {
  it("matches the program this person leads", () => {
    assert.equal(isLeadOfProgram(sample, "prog-sunday"), true)
  })

  it("does not match another program", () => {
    assert.equal(isLeadOfProgram(sample, "prog-qlh"), false)
  })
})

describe("programLeadNavEntries", () => {
  it("uses My program when there is one lead", () => {
    const entries = programLeadNavEntries(sample)
    assert.equal(entries.length, 1)
    assert.equal(entries[0].label, "My program")
    assert.equal(entries[0].programId, "prog-sunday")
  })

  it("uses each program name when there are several", () => {
    const entries = programLeadNavEntries([
      ...sample,
      {
        organizationId: "org-1",
        programId: "prog-qlh",
        programName: "QLH 2026-2027",
        departmentId: "dept-edu",
        contactId: "contact-1",
      },
    ])
    assert.deepEqual(
      entries.map((entry) => entry.label),
      ["Sunday School 2026-2027", "QLH 2026-2027"]
    )
  })
})
