"use server"

import { revalidatePath } from "next/cache"

import { createEmployeeFromContact } from "@/lib/contacts/contact-actions"
import { canManageDepartment } from "@/lib/departments/department-access"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission } from "@/lib/permissions/permissions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { createClient } from "@/lib/supabase/server"

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

function normalizeHourlyRate(value: number | string | null | undefined) {
  if (value == null || value === "") return null
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return null
  return Math.max(0, parsed)
}

async function requireStaffManage(departmentId?: string) {
  const allowed = departmentId
    ? await canManageDepartment(departmentId)
    : await hasPermission(PERMISSIONS.STAFF_MANAGE)
  if (!allowed) {
    return { ok: false as const, error: "You do not have permission to manage employees." }
  }
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { ok: false as const, error: "No organization selected." }
  }
  const supabase = await createClient()
  return { ok: true as const, organizationId, supabase }
}

function revalidateDepartmentStaff(departmentId: string) {
  revalidatePath(workforceDepartmentDetailPath(departmentId))
  revalidatePath("/workforce/departments")
  revalidatePath("/workforce/employees")
}

export async function listHrPositionsForDepartmentFormAction() {
  const access = await requireStaffManage()
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("hr_positions")
    .select("id, name")
    .eq("organization_id", access.organizationId)
    .order("name", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return { success: true as const, positions: [] as Array<{ id: string; name: string }> }
    }
    return { success: false as const, error: error.message }
  }

  return {
    success: true as const,
    positions: (data || []).map((row) => ({
      id: row.id as string,
      name: (row.name as string) || "Untitled position",
    })),
  }
}

export async function searchStaffForDepartmentAssignAction(
  departmentId: string,
  search: string,
  limit = 30
) {
  const access = await requireStaffManage(departmentId)
  if (!access.ok) return { success: false as const, error: access.error }

  let query = access.supabase
    .from("staff")
    .select("id, contact_id, first_name, last_name, email, department_id, status")
    .eq("organization_id", access.organizationId)
    .order("last_name", { ascending: true })
    .limit(Math.min(limit, 50))

  if (search.trim()) {
    const term = `%${escapeIlike(search.trim())}%`
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`
    )
  }

  const { data, error } = await query
  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    staff: (data || [])
      .filter((row) => row.department_id !== departmentId)
      .map((row) => ({
        staffId: row.id as string,
        contactId: (row.contact_id as string | null) ?? null,
        fullName: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Unnamed",
        email: (row.email as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        currentDepartmentId: (row.department_id as string | null) ?? null,
      })),
  }
}

export async function assignStaffToDepartmentAction(input: {
  departmentId: string
  staffId: string
  position_id?: string | null
  position_name?: string | null
  hourly_rate?: number | null
}) {
  const access = await requireStaffManage(input.departmentId)
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: department, error: departmentError } = await access.supabase
    .from("departments")
    .select("id")
    .eq("organization_id", access.organizationId)
    .eq("id", input.departmentId)
    .maybeSingle()

  if (departmentError || !department) {
    return { success: false as const, error: "Department not found." }
  }

  const { data: staff, error: staffError } = await access.supabase
    .from("staff")
    .select("id, department_id")
    .eq("organization_id", access.organizationId)
    .eq("id", input.staffId)
    .maybeSingle()

  if (staffError || !staff) {
    return { success: false as const, error: "Employee not found." }
  }

  const patch: Record<string, unknown> = {
    department_id: input.departmentId,
  }

  if (input.position_id !== undefined) {
    patch.position_id = input.position_id || null
    patch.position = input.position_name || null
  }

  const hourlyRate = normalizeHourlyRate(input.hourly_rate)
  if (input.hourly_rate !== undefined) {
    patch.hourly_rate = hourlyRate
  }

  let { error } = await access.supabase
    .from("staff")
    .update(patch)
    .eq("organization_id", access.organizationId)
    .eq("id", input.staffId)

  if (error && /hourly_rate/i.test(error.message || "")) {
    delete patch.hourly_rate
    const retry = await access.supabase
      .from("staff")
      .update(patch)
      .eq("organization_id", access.organizationId)
      .eq("id", input.staffId)
    error = retry.error
  }

  if (error) {
    return { success: false as const, error: error.message || "Could not assign employee." }
  }

  revalidateDepartmentStaff(input.departmentId)
  return {
    success: true as const,
    alreadyAssigned: staff.department_id === input.departmentId,
  }
}

export async function removeStaffFromDepartmentAction(input: {
  departmentId: string
  staffId: string
}) {
  const access = await requireStaffManage(input.departmentId)
  if (!access.ok) return { success: false as const, error: access.error }

  const { error } = await access.supabase
    .from("staff")
    .update({ department_id: null })
    .eq("organization_id", access.organizationId)
    .eq("id", input.staffId)
    .eq("department_id", input.departmentId)

  if (error) {
    return { success: false as const, error: error.message || "Could not remove employee." }
  }

  revalidateDepartmentStaff(input.departmentId)
  return { success: true as const }
}

export async function updateDepartmentEmployeeAction(input: {
  departmentId: string
  staffId: string
  staff_type?: "full_time" | "part_time" | "temporary" | "contract" | "seasonal"
  status?: "active" | "inactive" | "on_leave" | "pending"
  position_id?: string | null
  position_name?: string | null
  hourly_rate?: number | null
  pay_basis?: "hourly" | "monthly"
  monthly_salary?: number | null
}) {
  const access = await requireStaffManage(input.departmentId)
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: staff, error: staffError } = await access.supabase
    .from("staff")
    .select("id, department_id")
    .eq("organization_id", access.organizationId)
    .eq("id", input.staffId)
    .maybeSingle()

  if (staffError || !staff) {
    return { success: false as const, error: "Employee not found." }
  }

  if (staff.department_id !== input.departmentId) {
    return {
      success: false as const,
      error: "This employee is not assigned to this department.",
    }
  }

  const patch: Record<string, unknown> = {}

  if (input.staff_type) patch.staff_type = input.staff_type
  if (input.status) patch.status = input.status
  if (input.position_id !== undefined) {
    patch.position_id = input.position_id || null
    patch.position = input.position_name || null
  }
  if (input.hourly_rate !== undefined) {
    patch.hourly_rate = normalizeHourlyRate(input.hourly_rate)
  }
  if (input.pay_basis) patch.pay_basis = input.pay_basis
  if (input.monthly_salary !== undefined) {
    patch.monthly_salary = normalizeHourlyRate(input.monthly_salary)
  }

  if (Object.keys(patch).length === 0) {
    return { success: true as const }
  }

  let { error } = await access.supabase
    .from("staff")
    .update(patch)
    .eq("organization_id", access.organizationId)
    .eq("id", input.staffId)

  if (error && /hourly_rate|pay_basis|monthly_salary/i.test(error.message || "")) {
    delete patch.hourly_rate
    delete patch.pay_basis
    delete patch.monthly_salary
    const retry = await access.supabase
      .from("staff")
      .update(patch)
      .eq("organization_id", access.organizationId)
      .eq("id", input.staffId)
    error = retry.error
  }

  if (error) {
    return { success: false as const, error: error.message || "Could not update employee." }
  }

  revalidateDepartmentStaff(input.departmentId)
  return { success: true as const }
}

/**
 * Add a contact to this department as an employee.
 * If they are already on staff, assigns their department (and optional position/rate).
 * If not, creates the employee record with this department.
 */
export async function addEmployeeToDepartmentAction(input: {
  departmentId: string
  contactId: string
  staff_type?: "full_time" | "part_time" | "temporary" | "contract" | "seasonal"
  status?: "active" | "inactive" | "on_leave" | "pending"
  position_id?: string | null
  position_name?: string | null
  hourly_rate?: number | null
  pay_basis?: "hourly" | "monthly"
  monthly_salary?: number | null
}) {
  const access = await requireStaffManage(input.departmentId)
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: department, error: departmentError } = await access.supabase
    .from("departments")
    .select("id")
    .eq("organization_id", access.organizationId)
    .eq("id", input.departmentId)
    .maybeSingle()

  if (departmentError || !department) {
    return { success: false as const, error: "Department not found." }
  }

  const { data: existingStaff, error: existingError } = await access.supabase
    .from("staff")
    .select("id, department_id")
    .eq("organization_id", access.organizationId)
    .eq("contact_id", input.contactId)
    .maybeSingle()

  if (existingError && existingError.code !== "42703") {
    return { success: false as const, error: existingError.message }
  }

  if (existingStaff) {
    const assigned = await assignStaffToDepartmentAction({
      departmentId: input.departmentId,
      staffId: existingStaff.id as string,
      position_id: input.position_id,
      position_name: input.position_name,
      hourly_rate: input.hourly_rate,
    })
    if (!assigned.success) return assigned

    if (input.pay_basis || input.monthly_salary !== undefined) {
      await updateDepartmentEmployeeAction({
        departmentId: input.departmentId,
        staffId: existingStaff.id as string,
        pay_basis: input.pay_basis,
        monthly_salary: input.monthly_salary,
        hourly_rate: input.hourly_rate,
      })
    }

    return {
      success: true as const,
      mode: assigned.alreadyAssigned ? ("updated" as const) : ("assigned" as const),
      staffId: existingStaff.id as string,
    }
  }

  try {
    const created = await createEmployeeFromContact({
      contactId: input.contactId,
      staff_type: input.staff_type || "full_time",
      status: input.status || "active",
      department_id: input.departmentId,
      position_id: input.position_id || null,
      position_name: input.position_name || null,
      hourly_rate: normalizeHourlyRate(input.hourly_rate),
    })

    if (input.pay_basis || input.monthly_salary !== undefined) {
      await updateDepartmentEmployeeAction({
        departmentId: input.departmentId,
        staffId: created.staffId,
        pay_basis: input.pay_basis || "hourly",
        monthly_salary: input.monthly_salary,
      })
    }

    revalidateDepartmentStaff(input.departmentId)
    return {
      success: true as const,
      mode: "created" as const,
      staffId: created.staffId,
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not add employee.",
    }
  }
}
