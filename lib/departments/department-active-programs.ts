import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

/** Programs still open for the department workspace (not year-closed). */
export const DEPARTMENT_OPEN_PROGRAM_STATUSES = ["draft", "active", "paused"] as const

export type DepartmentOpenProgramStatus =
  (typeof DEPARTMENT_OPEN_PROGRAM_STATUSES)[number]

export type DepartmentYearProgramRow = {
  id: string
  name: string
  status: string
  startDate: string | null
  endDate: string | null
  flyerUrl: string | null
  offeringCount: number
  enrolled: number
  capacity: number
  gender: string | null
}

/**
 * Load department programs that are not archived (active academic years).
 */
export async function loadDepartmentOpenPrograms(
  organizationId: string,
  departmentId: string
): Promise<Array<{ id: string; name: string; status: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, status")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .in("status", [...DEPARTMENT_OPEN_PROGRAM_STATUSES])
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })

  if (error) throw new Error(error.message || "Could not load department programs.")
  return (data || []).map((row) => ({
    id: row.id as string,
    name: (row.name as string) || "Program",
    status: (row.status as string) || "active",
  }))
}

export async function loadDepartmentOpenProgramIds(
  departmentId: string
): Promise<string[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []
  const programs = await loadDepartmentOpenPrograms(organizationId, departmentId)
  return programs.map((p) => p.id)
}
