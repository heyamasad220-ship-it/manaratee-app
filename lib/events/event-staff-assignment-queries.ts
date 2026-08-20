"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import {
  searchDepartmentEmployeeContacts,
  searchStaffEligibleContacts,
  type StaffEligibleContact,
} from "@/lib/programs/program-staff-assignment-queries"

export type EventStaffCandidate = StaffEligibleContact & {
  kind: "staff" | "volunteer"
}

/** Staff (employees) for the event department + org volunteers for assignment. */
export async function getEventStaffCandidates(input: {
  departmentId: string | null
}): Promise<EventStaffCandidate[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const [employees, eligible] = await Promise.all([
    input.departmentId
      ? searchDepartmentEmployeeContacts(organizationId, input.departmentId, undefined, 200)
      : searchStaffEligibleContacts(organizationId, undefined, 200).then((rows) =>
          rows.filter((row) => row.roles.includes("employee"))
        ),
    searchStaffEligibleContacts(organizationId, undefined, 200),
  ])

  const byId = new Map<string, EventStaffCandidate>()

  for (const row of employees) {
    if (!row.id) continue
    byId.set(row.id, {
      ...row,
      kind: "staff",
      roles: Array.from(new Set([...row.roles, "employee"])),
    })
  }

  for (const row of eligible) {
    if (!row.id) continue
    const isVolunteer = row.roles.includes("volunteer")
    const existing = byId.get(row.id)
    if (existing) {
      if (isVolunteer && !existing.roles.includes("volunteer")) {
        existing.roles = [...existing.roles, "volunteer"]
      }
      continue
    }
    if (isVolunteer) {
      byId.set(row.id, {
        ...row,
        kind: "volunteer",
      })
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" })
  )
}
