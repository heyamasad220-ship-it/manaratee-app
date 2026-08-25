export type DepartmentStaffSummaryRow = {
  department_id: string | null
  first_name: string | null
  last_name: string | null
  status: string | null
  is_department_head?: boolean | null
}

export type DepartmentStaffSummary = {
  directorName: string | null
  employeesCount: number
}

function staffDisplayName(row: DepartmentStaffSummaryRow) {
  const first = row.first_name?.trim() || ""
  const last = row.last_name?.trim() || ""
  return `${first} ${last}`.trim()
}

function isActiveStaff(status: string | null) {
  return (status || "active").toLowerCase() !== "inactive"
}

export function summarizeDepartmentStaff(
  rows: DepartmentStaffSummaryRow[]
): Map<string, DepartmentStaffSummary> {
  const summaries = new Map<
    string,
    { employeesCount: number; directorNames: string[] }
  >()

  for (const row of rows) {
    if (!row.department_id) continue

    const current = summaries.get(row.department_id) ?? {
      employeesCount: 0,
      directorNames: [],
    }
    current.employeesCount += 1

    if (row.is_department_head && isActiveStaff(row.status)) {
      const name = staffDisplayName(row)
      if (name && !current.directorNames.includes(name)) {
        current.directorNames.push(name)
      }
    }

    summaries.set(row.department_id, current)
  }

  return new Map(
    [...summaries.entries()].map(([departmentId, summary]) => [
      departmentId,
      {
        directorName:
          summary.directorNames.length > 0
            ? summary.directorNames.join(", ")
            : null,
        employeesCount: summary.employeesCount,
      },
    ])
  )
}
