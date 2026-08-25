import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildProgramsListHref,
  DEFAULT_PROGRAMS_LIST_FILTERS,
  filterProgramsList,
  matchesProgramsListSearch,
  parseProgramsListFilters,
  type ProgramsListFilterable,
} from "./programs-list-filters"

function row(
  overrides: Partial<ProgramsListFilterable> = {}
): ProgramsListFilterable {
  return {
    id: "prog-1",
    name: "Sunday School 2026-2027",
    program_kind: "academic",
    status: "active",
    department_id: "dept-edu",
    ...overrides,
  }
}

const departments = {
  "dept-edu": "Education",
  "dept-qil": "Quran Institute for Ladies",
}

describe("programs list filters", () => {
  it("defaults status to Active and omits it from the URL", () => {
    const filters = parseProgramsListFilters({})
    assert.deepEqual(filters, DEFAULT_PROGRAMS_LIST_FILTERS)
    assert.equal(filters.status, "active")
    assert.equal(buildProgramsListHref(filters), "/programs/list")
    assert.equal(
      buildProgramsListHref({ ...filters, type: "academic" }),
      "/programs/list?type=academic"
    )
    assert.equal(
      buildProgramsListHref({ ...filters, status: "closed" }),
      "/programs/list?status=closed"
    )
    assert.equal(
      buildProgramsListHref({ ...filters, status: "all" }),
      "/programs/list?status=all"
    )
  })

  it("searches program and department names", () => {
    const sample = row()
    assert.equal(matchesProgramsListSearch(sample, "Education", "sunday"), true)
    assert.equal(matchesProgramsListSearch(sample, "Education", "educ"), true)
    assert.equal(matchesProgramsListSearch(sample, "Education", "qil"), false)
  })

  it("filters by department, type, and status", () => {
    const rows = [
      row(),
      row({
        id: "prog-2",
        name: "Summer Camp 2026",
        program_kind: "seasonal",
        department_id: "dept-qil",
        status: "closed",
      }),
    ]

    assert.equal(
      filterProgramsList(rows, departments, DEFAULT_PROGRAMS_LIST_FILTERS)
        .map((item) => item.id)
        .join(),
      "prog-1"
    )
    assert.equal(
      filterProgramsList(rows, departments, {
        ...DEFAULT_PROGRAMS_LIST_FILTERS,
        department: "dept-edu",
      })
        .map((item) => item.id)
        .join(),
      "prog-1"
    )
    assert.equal(
      filterProgramsList(rows, departments, {
        ...DEFAULT_PROGRAMS_LIST_FILTERS,
        status: "all",
        type: "seasonal",
      })
        .map((item) => item.id)
        .join(),
      "prog-2"
    )
    assert.equal(
      filterProgramsList(rows, departments, {
        ...DEFAULT_PROGRAMS_LIST_FILTERS,
        status: "closed",
      })
        .map((item) => item.id)
        .join(),
      "prog-2"
    )
  })
})
