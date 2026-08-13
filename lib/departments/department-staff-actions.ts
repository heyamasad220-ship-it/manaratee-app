"use server"

import { revalidatePath } from "next/cache"

import { createEmployeeFromContact } from "@/lib/contacts/contact-actions"
import { canManageDepartment, canViewDepartment } from "@/lib/departments/department-access"
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

export async function listHrPositionsForDepartmentFormAction(departmentId?: string) {
  const access = await requireStaffManage(departmentId)
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

export async function listHrJobRolesForDepartmentFormAction(departmentId?: string) {
  const access = await requireStaffManage(departmentId)
  if (!access.ok) return { success: false as const, error: access.error }

  const { data, error } = await access.supabase
    .from("hr_job_roles")
    .select("id, name")
    .eq("organization_id", access.organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return { success: true as const, roles: [] as Array<{ id: string; name: string }> }
    }
    return { success: false as const, error: error.message }
  }

  return {
    success: true as const,
    roles: (data || []).map((row) => ({
      id: row.id as string,
      name: (row.name as string) || "Untitled role",
    })),
  }
}

export type DepartmentEmployeeProfile = {
  staffId: string
  contactId: string | null
  fullName: string
  email: string | null
  phone: string | null
  employmentStatus: "active" | "inactive" | "on_leave" | "pending"
  staffType: "full_time" | "part_time" | "temporary" | "contract" | "seasonal"
  positionId: string | null
  positionName: string | null
  hrJobRoleId: string | null
  hrJobRoleName: string | null
  departmentId: string | null
  departmentName: string | null
  hireDate: string | null
  payBasis: "hourly" | "monthly"
  hourlyRate: number | null
  monthlySalary: number | null
  isDepartmentHead: boolean
  canRemove: boolean
  removeBlockedReason: string | null
  recentPayEntries: Array<{
    id: string
    periodStart: string
    periodEnd: string
    hoursWorked: number | null
    amount: number
    status: string
  }>
  recentHourLogs: Array<{
    id: string
    workDate: string
    hours: number
    notes: string | null
  }>
}

async function countStaffFinancialRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  departmentId: string,
  staffId: string
) {
  const [pay, hours] = await Promise.all([
    supabase
      .from("department_staff_pay_entries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId)
      .eq("staff_id", staffId),
    supabase
      .from("department_staff_hour_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId)
      .eq("staff_id", staffId),
  ])

  // Missing tables → treat as no financial rows so remove still works until migrations run.
  const payCount = pay.error ? 0 : pay.count || 0
  const hourCount = hours.error ? 0 : hours.count || 0
  return { payCount, hourCount, total: payCount + hourCount }
}

export async function fetchDepartmentEmployeeProfileAction(input: {
  departmentId: string
  staffId: string
}) {
  const canView = await canViewDepartment(input.departmentId)
  if (!canView) {
    return { success: false as const, error: "You do not have permission to view this employee." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }
  const supabase = await createClient()
  const canEdit = await canManageDepartment(input.departmentId)

  let { data, error } = await supabase
    .from("staff")
    .select(
      `
      id,
      contact_id,
      first_name,
      last_name,
      email,
      phone,
      staff_type,
      status,
      hire_date,
      position,
      position_id,
      department_id,
      is_department_head,
      hr_job_role_id,
      hourly_rate,
      pay_basis,
      monthly_salary,
      hr_positions:position_id (name),
      hr_job_roles:hr_job_role_id (name),
      departments:department_id (name)
    `
    )
    .eq("organization_id", organizationId)
    .eq("id", input.staffId)
    .maybeSingle()

  if (error && /is_department_head|hourly_rate|pay_basis|monthly_salary/i.test(error.message || "")) {
    const retry = await supabase
      .from("staff")
      .select(
        `
        id,
        contact_id,
        first_name,
        last_name,
        email,
        phone,
        staff_type,
        status,
        hire_date,
        position,
        position_id,
        department_id,
        hr_job_role_id,
        hr_positions:position_id (name),
        hr_job_roles:hr_job_role_id (name),
        departments:department_id (name)
      `
      )
      .eq("organization_id", organizationId)
      .eq("id", input.staffId)
      .maybeSingle()
    data = retry.data as typeof data
    error = retry.error
  }

  if (error || !data) {
    return { success: false as const, error: error?.message || "Employee not found." }
  }

  if (data.department_id !== input.departmentId) {
    return {
      success: false as const,
      error: "This employee is not assigned to this department.",
    }
  }

  const financial = await countStaffFinancialRows(
    supabase,
    organizationId,
    input.departmentId,
    input.staffId
  )

  const [{ data: payRows }, { data: hourRows }] = await Promise.all([
    supabase
      .from("department_staff_pay_entries")
      .select("id, period_start, period_end, hours_worked, amount, status")
      .eq("organization_id", organizationId)
      .eq("department_id", input.departmentId)
      .eq("staff_id", input.staffId)
      .order("period_end", { ascending: false })
      .limit(8),
    supabase
      .from("department_staff_hour_logs")
      .select("id, work_date, hours, notes")
      .eq("organization_id", organizationId)
      .eq("department_id", input.departmentId)
      .eq("staff_id", input.staffId)
      .order("work_date", { ascending: false })
      .limit(12),
  ])

  const removeBlockedReason =
    financial.total > 0
      ? `Cannot remove while payroll data exists (${financial.payCount} pay entr${
          financial.payCount === 1 ? "y" : "ies"
        }, ${financial.hourCount} hour log${financial.hourCount === 1 ? "" : "s"}).`
      : null

  const profile: DepartmentEmployeeProfile = {
    staffId: data.id as string,
    contactId: (data.contact_id as string | null) ?? null,
    fullName:
      `${(data.first_name as string) || ""} ${(data.last_name as string) || ""}`.trim() ||
      "Unnamed",
    email: (data.email as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    employmentStatus: ((data.status as string) || "active") as DepartmentEmployeeProfile["employmentStatus"],
    staffType: ((data.staff_type as string) || "full_time") as DepartmentEmployeeProfile["staffType"],
    positionId: (data.position_id as string | null) ?? null,
    positionName:
      ((data as { hr_positions?: { name?: string } | null }).hr_positions?.name as
        | string
        | undefined) ||
      (data.position as string | null) ||
      null,
    hrJobRoleId: (data.hr_job_role_id as string | null) ?? null,
    hrJobRoleName:
      ((data as { hr_job_roles?: { name?: string } | null }).hr_job_roles?.name as
        | string
        | undefined) || null,
    departmentId: (data.department_id as string | null) ?? null,
    departmentName:
      ((data as { departments?: { name?: string } | null }).departments?.name as
        | string
        | undefined) || null,
    hireDate: (data.hire_date as string | null)?.slice(0, 10) || null,
    payBasis: (data.pay_basis as string) === "monthly" ? "monthly" : "hourly",
    hourlyRate:
      data.hourly_rate == null ? null : Number(data.hourly_rate),
    monthlySalary:
      data.monthly_salary == null ? null : Number(data.monthly_salary),
    isDepartmentHead: Boolean(
      (data as { is_department_head?: boolean }).is_department_head
    ),
    canRemove: canEdit && financial.total === 0,
    removeBlockedReason: canEdit ? removeBlockedReason : "You do not have permission to remove employees.",
    recentPayEntries: (payRows || []).map((row) => ({
      id: row.id as string,
      periodStart: row.period_start as string,
      periodEnd: row.period_end as string,
      hoursWorked:
        row.hours_worked == null ? null : Number(row.hours_worked),
      amount: Number(row.amount || 0),
      status: (row.status as string) || "draft",
    })),
    recentHourLogs: (hourRows || []).map((row) => ({
      id: row.id as string,
      workDate: row.work_date as string,
      hours: Number(row.hours || 0),
      notes: (row.notes as string | null) ?? null,
    })),
  }

  return { success: true as const, profile, canEdit }
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

  const financial = await countStaffFinancialRows(
    access.supabase,
    access.organizationId,
    input.departmentId,
    input.staffId
  )
  if (financial.total > 0) {
    return {
      success: false as const,
      error: `Cannot remove this employee while payroll data exists (${financial.payCount} pay entr${
        financial.payCount === 1 ? "y" : "ies"
      }, ${financial.hourCount} hour log${financial.hourCount === 1 ? "" : "s"}). Delete or reassign that financial history first.`,
    }
  }

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
  hr_job_role_id?: string | null
  hire_date?: string | null
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
  if (input.hr_job_role_id !== undefined) {
    patch.hr_job_role_id = input.hr_job_role_id || null
  }
  if (input.hire_date !== undefined) {
    patch.hire_date = input.hire_date || null
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
