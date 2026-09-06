"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getDepartments } from "@/lib/departments/department-queries"
import { summarizeDepartmentStaff } from "@/lib/departments/department-list-summary"
import { canManageDepartment, canViewDepartment } from "@/lib/departments/department-access"
import {
  departmentDeleteBlockedReason,
  type DepartmentDeleteUsage,
} from "@/lib/departments/department-delete-blockers"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { isRichTextEmpty, sanitizeRichTextHtml } from "@/lib/ui/rich-text"

function normalizeDepartmentDescription(value?: string | null) {
  const sanitized = sanitizeRichTextHtml(value)
  return isRichTextEmpty(sanitized) ? null : sanitized
}

type CreateDepartmentInput = {
  name: string
  description?: string
  color?: string
  flyerUrl?: string | null
}

type UpdateDepartmentInput = {
  id: string
  name: string
  description?: string
  color?: string
  flyerUrl?: string | null
}

export type DepartmentWithProgramCount = {
  id: string
  name: string
  description: string | null
  color: string
  flyer_url: string | null
  programs_count: number
  director_name: string | null
  employees_count: number
}

function revalidateDepartmentPaths(departmentId?: string) {
  revalidatePath("/programs")
  revalidatePath("/programs/catalog")
  revalidatePath("/workforce?tab=departments")
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

async function requireDepartmentWriteAccess(departmentId?: string) {
  const canWriteOrgWide =
    (await hasPermission(PERMISSIONS.STAFF_MANAGE)) ||
    (await hasPermission(PERMISSIONS.STAFF_VIEW))
  const canWriteThisDepartment = departmentId
    ? await canManageDepartment(departmentId)
    : false

  if (!canWriteOrgWide && !canWriteThisDepartment) {
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

async function loadDepartmentDeleteUsage(
  supabase: ReturnType<typeof createServiceRoleClient>,
  organizationId: string,
  departmentId: string
): Promise<DepartmentDeleteUsage> {
  const [programsResult, staffResult] = await Promise.all([
    supabase
      .from("programs")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId),
    supabase
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId),
  ])

  const programIds = (programsResult.data || []).map((row) => row.id as string)
  let offerings = 0
  if (programIds.length > 0) {
    const offeringsResult = await supabase
      .from("program_offerings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("program_id", programIds)
    offerings = offeringsResult.count ?? 0
  }

  return {
    programs: programIds.length,
    offerings,
    employees: staffResult.count ?? 0,
  }
}

export async function fetchDepartmentDeleteUsage(
  departmentId: string
): Promise<DepartmentDeleteUsage> {
  const canView = await canViewDepartment(departmentId)
  if (!canView) {
    throw new Error("You do not have permission to view this department.")
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  return loadDepartmentDeleteUsage(
    createServiceRoleClient(),
    organizationId,
    departmentId
  )
}

export async function createDepartment(input: CreateDepartmentInput) {
  const name = input.name.trim()
  if (!name) {
    throw new Error("Department name is required")
  }

  const { organizationId, supabase } = await requireDepartmentWriteAccess()

  const { data, error } = await supabase
    .from("departments")
    .insert({
      organization_id: organizationId,
      name,
      description: normalizeDepartmentDescription(input.description),
      color: normalizeDepartmentColor(input.color),
      flyer_url: input.flyerUrl?.trim() || null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("createDepartment error:", error)
    throw new Error(formatDepartmentError(error, "create"))
  }

  revalidateDepartmentPaths(data?.id)
  return { id: data.id as string }
}

export async function updateDepartment(input: UpdateDepartmentInput) {
  const name = input.name.trim()
  if (!name) {
    throw new Error("Department name is required")
  }

  const { organizationId, supabase } = await requireDepartmentWriteAccess(input.id)

  const updatePayload: Record<string, unknown> = {
    name,
    color: normalizeDepartmentColor(input.color),
  }
  if (input.description !== undefined) {
    updatePayload.description = normalizeDepartmentDescription(input.description)
  }
  if (input.flyerUrl !== undefined) {
    updatePayload.flyer_url = input.flyerUrl?.trim() || null
  }

  const { error } = await supabase
    .from("departments")
    .update(updatePayload)
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("updateDepartment error:", error)
    throw new Error(formatDepartmentError(error, "update"))
  }

  revalidateDepartmentPaths(input.id)
}

export async function updateDepartmentFlyer(input: {
  id: string
  flyerUrl: string | null
}) {
  const { organizationId, supabase } = await requireDepartmentWriteAccess(input.id)

  const { error } = await supabase
    .from("departments")
    .update({
      flyer_url: input.flyerUrl?.trim() || null,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("updateDepartmentFlyer error:", error)
    throw new Error(formatDepartmentError(error, "update flyer for"))
  }

  revalidateDepartmentPaths(input.id)
}

export async function deleteDepartment(id: string) {
  const { organizationId, supabase } = await requireDepartmentWriteAccess()

  const usage = await loadDepartmentDeleteUsage(supabase, organizationId, id)
  const blockedReason = departmentDeleteBlockedReason(usage)
  if (blockedReason) {
    throw new Error(blockedReason)
  }

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

  const staffSelectWithHead =
    "department_id, first_name, last_name, status, is_department_head"
  const staffSelectBasic = "department_id, first_name, last_name, status"

  let staffRows:
    | Array<{
        department_id: string | null
        first_name: string | null
        last_name: string | null
        status: string | null
        is_department_head?: boolean | null
      }>
    | null = null

  const staffWithHead = await supabase
    .from("staff")
    .select(staffSelectWithHead)
    .eq("organization_id", organizationId)

  if (
    staffWithHead.error &&
    /is_department_head/i.test(staffWithHead.error.message || "")
  ) {
    const retry = await supabase
      .from("staff")
      .select(staffSelectBasic)
      .eq("organization_id", organizationId)
    if (retry.error && retry.error.code !== "42P01") {
      console.error(retry.error)
      throw new Error("Failed to load staff for departments")
    }
    staffRows = (retry.data || []) as typeof staffRows
  } else if (staffWithHead.error && staffWithHead.error.code !== "42P01") {
    console.error(staffWithHead.error)
    throw new Error("Failed to load staff for departments")
  } else {
    staffRows = (staffWithHead.data || []) as typeof staffRows
  }

  const staffSummaries = summarizeDepartmentStaff(staffRows || [])

  return departments.map((department) => {
    const staffSummary = staffSummaries.get(department.id)
    return {
      id: department.id,
      name: department.name,
      description: department.description,
      color: department.color,
      flyer_url: department.flyer_url ?? null,
      programs_count: programCounts.get(department.id) || 0,
      director_name: staffSummary?.directorName ?? null,
      employees_count: staffSummary?.employeesCount ?? 0,
    }
  })
}

export type DepartmentStaffMember = {
  staffId: string
  contactId: string | null
  fullName: string
  email: string | null
  phone: string | null
  employmentStatus: string | null
  staffType: string | null
  positionId: string | null
  positionName: string | null
  hourlyRate: number | null
  payBasis: "hourly" | "monthly"
  monthlySalary: number | null
  isDepartmentHead: boolean
}

export type DepartmentDetail = {
  id: string
  name: string
  description: string | null
  color: string | null
  flyer_url: string | null
  terms_html: string | null
  terms_pdf_url: string | null
  programsCount: number
  staff: DepartmentStaffMember[]
}

export async function fetchDepartmentDetail(
  departmentId: string
): Promise<DepartmentDetail | null> {
  const allowed = await canViewDepartment(departmentId)
  if (!allowed) {
    throw new Error("You do not have permission to view departments.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null

  let department: {
    id: string
    name: string
    description: string | null
    color: string | null
    flyer_url: string | null
    terms_html?: string | null
    terms_pdf_url?: string | null
  } | null = null

  const withTerms = await supabase
    .from("departments")
    .select("id, name, description, color, flyer_url, terms_html, terms_pdf_url")
    .eq("organization_id", organizationId)
    .eq("id", departmentId)
    .maybeSingle()

  if (
    withTerms.error &&
    /terms_html|terms_pdf_url/i.test(withTerms.error.message || "")
  ) {
    // Older DBs may lack terms columns until scripts/241_department_terms.sql runs.
    const retry = await supabase
      .from("departments")
      .select("id, name, description, color, flyer_url")
      .eq("organization_id", organizationId)
      .eq("id", departmentId)
      .maybeSingle()
    if (retry.error || !retry.data) return null
    department = retry.data as typeof department
  } else if (withTerms.error || !withTerms.data) {
    return null
  } else {
    department = withTerms.data as typeof department
  }

  if (!department) return null

  const staffSelectWithPay =
    "id, contact_id, first_name, last_name, email, status, staff_type, hourly_rate, pay_basis, monthly_salary, position, position_id, is_department_head, hr_positions:position_id (name)"
  const staffSelectWithRate =
    "id, contact_id, first_name, last_name, email, status, staff_type, hourly_rate, position, position_id, is_department_head, hr_positions:position_id (name)"
  const staffSelectBasic =
    "id, contact_id, first_name, last_name, email, status, staff_type, position, position_id, is_department_head, hr_positions:position_id (name)"

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

  const contactIds = [
    ...new Set(
      (staffRows || [])
        .map((row) => row.contact_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const phoneByContactId = new Map<string, string | null>()
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, phone, email")
      .eq("organization_id", organizationId)
      .in("id", contactIds)
    for (const contact of contacts || []) {
      phoneByContactId.set(contact.id as string, (contact.phone as string | null) ?? null)
    }
  }

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
    const contactId = (row.contact_id as string | null) ?? null
    return {
      staffId: row.id as string,
      contactId,
      fullName,
      email: (row.email as string | null) ?? null,
      phone: contactId ? phoneByContactId.get(contactId) ?? null : null,
      employmentStatus: (row.status as string | null) ?? null,
      staffType: (row.staff_type as string | null) ?? null,
      positionId: (row.position_id as string | null) ?? null,
      positionName,
      hourlyRate,
      payBasis: (row.pay_basis as string) === "monthly" ? "monthly" : "hourly",
      monthlySalary,
      isDepartmentHead: Boolean(row.is_department_head),
    }
  })

  return {
    id: department.id as string,
    name: (department.name as string) || "Department",
    description: (department.description as string | null) ?? null,
    color: (department.color as string | null) ?? null,
    flyer_url: (department.flyer_url as string | null) ?? null,
    terms_html: (department.terms_html as string | null) ?? null,
    terms_pdf_url: (department.terms_pdf_url as string | null) ?? null,
    programsCount: programsCount || 0,
    staff,
  }
}

export async function updateDepartmentTerms(input: {
  id: string
  termsHtml?: string | null
  termsPdfUrl?: string | null
}) {
  const { organizationId, supabase } = await requireDepartmentWriteAccess(input.id)

  const patch: Record<string, string | null> = {}
  if (input.termsHtml !== undefined) {
    patch.terms_html = normalizeDepartmentDescription(input.termsHtml)
  }
  if (input.termsPdfUrl !== undefined) {
    patch.terms_pdf_url = input.termsPdfUrl?.trim() || null
  }

  if (Object.keys(patch).length === 0) return

  const { error } = await supabase
    .from("departments")
    .update(patch)
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("updateDepartmentTerms error:", error)
    if (/terms_html|terms_pdf_url/i.test(error.message || "")) {
      throw new Error(
        "Terms columns are missing. Run scripts/241_department_terms.sql in Supabase, then try again."
      )
    }
    throw new Error(formatDepartmentError(error, "update terms for"))
  }

  revalidateDepartmentPaths(input.id)
}

