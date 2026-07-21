"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getDepartments } from "@/lib/departments/department-queries"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"

type CreateDepartmentInput = {
  name: string
  description?: string
  color?: string
}

type UpdateDepartmentInput = {
  id: string
  name: string
  description?: string
  color?: string
}

export type DepartmentWithProgramCount = {
  id: string
  name: string
  description: string | null
  color: string
  programs_count: number
}

function revalidateDepartmentPaths(departmentId?: string) {
  revalidatePath("/programs")
  revalidatePath("/programs/catalog")
  revalidatePath("/programs/settings")
  revalidatePath("/workforce/settings")
  revalidatePath("/workforce/departments")
  revalidatePath("/workforce/employees")
  if (departmentId) {
    revalidatePath(`/workforce/departments/${departmentId}`)
  }
}

function normalizeDepartmentColor(color?: string | null) {
  const value = color?.trim()
  if (!value) return "#3b82f6"
  // Support both hex pickers and legacy Tailwind class colors.
  if (value.startsWith("#") || value.startsWith("bg-")) return value
  return "#3b82f6"
}

function formatDepartmentError(error: { code?: string; message?: string }, action: string) {
  if (error.code === "23505") {
    return "A department with this name already exists."
  }
  if (error.code === "42501") {
    return "You do not have permission to manage departments for this organization."
  }
  return error.message || `Failed to ${action} department`
}

async function requireDepartmentWriteAccess() {
  const canWrite =
    (await hasPermission(PERMISSIONS.STAFF_MANAGE)) ||
    (await hasPermission(PERMISSIONS.STAFF_VIEW))

  if (!canWrite) {
    throw new Error("You do not have permission to manage departments.")
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  // Verify the signed-in user belongs to the selected org (session client),
  // then write with service role so legacy/incomplete departments RLS cannot block saves.
  const sessionClient = await createClient()
  const {
    data: { user },
  } = await sessionClient.auth.getUser()

  if (!user) {
    throw new Error("You must be signed in to manage departments.")
  }

  const { data: membership, error: membershipError } = await sessionClient
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (membershipError) {
    throw new Error(membershipError.message || "Could not verify organization membership.")
  }

  if (!membership) {
    throw new Error("You are not a member of the selected organization.")
  }

  return {
    organizationId,
    supabase: createServiceRoleClient(),
  }
}

export async function createDepartment(input: CreateDepartmentInput) {
  const name = input.name.trim()
  if (!name) {
    throw new Error("Department name is required")
  }

  const { organizationId, supabase } = await requireDepartmentWriteAccess()

  const { error } = await supabase.from("departments").insert({
    organization_id: organizationId,
    name,
    description: input.description?.trim() || null,
    color: normalizeDepartmentColor(input.color),
  })

  if (error) {
    console.error("createDepartment error:", error)
    throw new Error(formatDepartmentError(error, "create"))
  }

  revalidateDepartmentPaths()
}

export async function updateDepartment(input: UpdateDepartmentInput) {
  const name = input.name.trim()
  if (!name) {
    throw new Error("Department name is required")
  }

  const { organizationId, supabase } = await requireDepartmentWriteAccess()

  const { error } = await supabase
    .from("departments")
    .update({
      name,
      description: input.description?.trim() || null,
      color: normalizeDepartmentColor(input.color),
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("updateDepartment error:", error)
    throw new Error(formatDepartmentError(error, "update"))
  }

  revalidateDepartmentPaths(input.id)
}

export async function deleteDepartment(id: string) {
  const { organizationId, supabase } = await requireDepartmentWriteAccess()

  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("deleteDepartment error:", error)
    throw new Error(formatDepartmentError(error, "delete"))
  }

  revalidateDepartmentPaths(id)
}

export async function fetchDepartmentsWithProgramCounts(): Promise<
  DepartmentWithProgramCount[]
> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const departments = await getDepartments()

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("department_id")
    .eq("organization_id", organizationId)

  if (programsError) {
    console.error(programsError)
    throw new Error("Failed to load program counts for departments")
  }

  const programCounts = new Map<string, number>()

  for (const program of programs || []) {
    if (!program.department_id) {
      continue
    }

    programCounts.set(
      program.department_id,
      (programCounts.get(program.department_id) || 0) + 1
    )
  }

  return departments.map((department) => ({
    id: department.id,
    name: department.name,
    description: department.description,
    color: department.color,
    programs_count: programCounts.get(department.id) || 0,
  }))
}

export type DepartmentStaffMember = {
  staffId: string
  contactId: string | null
  fullName: string
  email: string | null
  employmentStatus: string | null
  staffType: string | null
  positionId: string | null
  positionName: string | null
  hourlyRate: number | null
  payBasis: "hourly" | "monthly"
  monthlySalary: number | null
}

export type DepartmentDetail = {
  id: string
  name: string
  description: string | null
  color: string | null
  programsCount: number
  staff: DepartmentStaffMember[]
}

export async function fetchDepartmentDetail(
  departmentId: string
): Promise<DepartmentDetail | null> {
  const allowed = await hasPermission(PERMISSIONS.STAFF_VIEW)
  if (!allowed) {
    throw new Error("You do not have permission to view departments.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null

  const { data: department, error } = await supabase
    .from("departments")
    .select("id, name, description, color")
    .eq("organization_id", organizationId)
    .eq("id", departmentId)
    .maybeSingle()

  if (error || !department) {
    return null
  }

  const staffSelectWithPay =
    "id, contact_id, first_name, last_name, email, status, staff_type, hourly_rate, pay_basis, monthly_salary, position, position_id, hr_positions:position_id (name)"
  const staffSelectWithRate =
    "id, contact_id, first_name, last_name, email, status, staff_type, hourly_rate, position, position_id, hr_positions:position_id (name)"
  const staffSelectBasic =
    "id, contact_id, first_name, last_name, email, status, staff_type, position, position_id, hr_positions:position_id (name)"

  let staffRows: any[] | null = null
  const staffWithPay = await supabase
    .from("staff")
    .select(staffSelectWithPay)
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .order("last_name", { ascending: true })

  if (
    staffWithPay.error &&
    /pay_basis|monthly_salary/i.test(staffWithPay.error.message || "")
  ) {
    const withRate = await supabase
      .from("staff")
      .select(staffSelectWithRate)
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId)
      .order("last_name", { ascending: true })

    if (withRate.error && /hourly_rate/i.test(withRate.error.message || "")) {
      const retry = await supabase
        .from("staff")
        .select(staffSelectBasic)
        .eq("organization_id", organizationId)
        .eq("department_id", departmentId)
        .order("last_name", { ascending: true })
      staffRows = (retry.data || []) as any[]
    } else {
      staffRows = (withRate.data || []) as any[]
    }
  } else {
    staffRows = (staffWithPay.data || []) as any[]
  }

  const [{ count: programsCount }] = await Promise.all([
    supabase
      .from("programs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId),
  ])

  const staff: DepartmentStaffMember[] = (staffRows || []).map((row) => {
    const first = (row.first_name as string | null)?.trim() || ""
    const last = (row.last_name as string | null)?.trim() || ""
    const fullName = `${first} ${last}`.trim() || "Unnamed employee"
    const positionName =
      (row.hr_positions?.name as string | null)?.trim() ||
      (row.position as string | null)?.trim() ||
      null
    const hourlyRaw = row.hourly_rate
    const hourlyRate =
      hourlyRaw == null || Number.isNaN(Number(hourlyRaw)) ? null : Number(hourlyRaw)
    const salaryRaw = row.monthly_salary
    const monthlySalary =
      salaryRaw == null || Number.isNaN(Number(salaryRaw)) ? null : Number(salaryRaw)
    return {
      staffId: row.id as string,
      contactId: (row.contact_id as string | null) ?? null,
      fullName,
      email: (row.email as string | null) ?? null,
      employmentStatus: (row.status as string | null) ?? null,
      staffType: (row.staff_type as string | null) ?? null,
      positionId: (row.position_id as string | null) ?? null,
      positionName,
      hourlyRate,
      payBasis: (row.pay_basis as string) === "monthly" ? "monthly" : "hourly",
      monthlySalary,
    }
  })

  return {
    id: department.id as string,
    name: (department.name as string) || "Department",
    description: (department.description as string | null) ?? null,
    color: (department.color as string | null) ?? null,
    programsCount: programsCount || 0,
    staff,
  }
}

