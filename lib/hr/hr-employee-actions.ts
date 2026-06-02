"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { fetchDepartmentsWithProgramCounts } from "@/lib/departments/department-actions"

export type HrEmployeeDashboardStats = {
  totalEmployees: number
  activeStaff: number
  totalDepartments: number
  totalPositions: number
}

export type DepartmentPreview = {
  id: string
  name: string
  description: string | null
  color: string
  programs_count: number
  staff_count: number
}

export async function fetchHrEmployeeDashboardStats(): Promise<HrEmployeeDashboardStats> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return {
      totalEmployees: 0,
      activeStaff: 0,
      totalDepartments: 0,
      totalPositions: 0,
    }
  }

  const { count: employeeCount, error: employeeError } = await supabase
    .from("contact_roles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "employee")

  if (employeeError && employeeError.code !== "42P01") {
    throw new Error(employeeError.message || "Failed to load employee count")
  }

  const { data: staffRows, error: staffError } = await supabase
    .from("staff")
    .select("status")
    .eq("organization_id", organizationId)

  if (staffError && staffError.code !== "42P01") {
    throw new Error(staffError.message || "Failed to load staff count")
  }

  const { count: departmentCount, error: departmentError } = await supabase
    .from("departments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (departmentError) {
    throw new Error(departmentError.message || "Failed to load department count")
  }

  const { count: positionCount, error: positionError } = await supabase
    .from("hr_positions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (positionError && positionError.code !== "42P01") {
    throw new Error(positionError.message || "Failed to load position count")
  }

  const activeStaff = (staffRows || []).filter((row) => row.status === "active").length

  return {
    totalEmployees: employeeCount || 0,
    activeStaff,
    totalDepartments: departmentCount || 0,
    totalPositions: positionCount || 0,
  }
}

export async function fetchDepartmentPreviews(): Promise<DepartmentPreview[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const departments = await fetchDepartmentsWithProgramCounts()

  const { data: staffRows, error: staffError } = await supabase
    .from("staff")
    .select("department_id")
    .eq("organization_id", organizationId)

  if (staffError && staffError.code !== "42P01") {
    throw new Error(staffError.message || "Failed to load staff by department")
  }

  const staffCounts = new Map<string, number>()
  for (const row of staffRows || []) {
    if (!row.department_id) continue
    staffCounts.set(row.department_id, (staffCounts.get(row.department_id) || 0) + 1)
  }

  return departments.map((department) => ({
    ...department,
    staff_count: staffCounts.get(department.id) || 0,
  }))
}
