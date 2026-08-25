import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { summarizeDepartmentStaff } from "./department-list-summary"

describe("summarizeDepartmentStaff", () => {
  it("counts employees and names the active director", () => {
    const summaries = summarizeDepartmentStaff([
      {
        department_id: "dept-1",
        first_name: "Amina",
        last_name: "Hassan",
        status: "active",
        is_department_head: true,
      },
      {
        department_id: "dept-1",
        first_name: "Omar",
        last_name: "Ali",
        status: "active",
        is_department_head: false,
      },
      {
        department_id: "dept-1",
        first_name: "Layla",
        last_name: "Noor",
        status: "inactive",
        is_department_head: true,
      },
    ])

    assert.deepEqual(summaries.get("dept-1"), {
      directorName: "Amina Hassan",
      employeesCount: 3,
    })
  })

  it("returns no director when none is assigned", () => {
    const summaries = summarizeDepartmentStaff([
      {
        department_id: "dept-2",
        first_name: "Sara",
        last_name: "Khan",
        status: "active",
        is_department_head: false,
      },
    ])

    assert.deepEqual(summaries.get("dept-2"), {
      directorName: null,
      employeesCount: 1,
    })
  })
})
