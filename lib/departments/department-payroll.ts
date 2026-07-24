"use server"

import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import {
  roundMoney,
} from "@/lib/departments/department-period-helpers"
import {
  canManageDepartment,
  canViewDepartment,
} from "@/lib/departments/department-access"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type StaffPayBasis = "hourly" | "monthly"
export type PayPeriodStatus = "draft" | "pending" | "approved" | "rejected"

export type DepartmentPayPeriodRow = {
  id: string | null
  staffId: string
  fullName: string
  positionName: string | null
  isChildcareProvider: boolean
  payBasis: StaffPayBasis
  hourlyRate: number | null
  monthlySalary: number | null
  periodKey: string
  periodStart: string
  periodEnd: string
  hoursWorked: number | null
  amount: number
  status: PayPeriodStatus
}

export type PayrollStaffOption = {
  staffId: string
  fullName: string
  payBasis: StaffPayBasis
  positionName: string | null
  isChildcareProvider: boolean
  departmentId: string | null
}

export type PayrollDepartmentOption = {
  id: string
  name: string
}

export type DepartmentHourLogRow = {
  id: string
  workDate: string
  hours: number
  notes: string | null
}

function isMissingTableError(message: string | undefined) {
  if (!message) return false
  // Only treat true "relation does not exist" as missing migration — do not match
  // every error that merely mentions a table name (e.g. check constraint violations).
  return (
    /relation ["'].*["'] does not exist/i.test(message) ||
    /Could not find the table/i.test(message) ||
    /\b42P01\b/.test(message)
  )
}

function periodBounds(periodKey: string) {
  const custom = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(periodKey)
  if (custom) {
    return { periodStart: custom[1], periodEnd: custom[2] }
  }
  const start = `${periodKey}-01`
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0)
  )
  const end = endDate.toISOString().slice(0, 10)
  return { periodStart: start, periodEnd: end }
}

function periodKeyFromWorkDate(workDate: string) {
  return workDate.slice(0, 7)
}

function positionLabel(row: Record<string, unknown>) {
  const nested = row.hr_positions as { name?: string | null } | null
  return (
    nested?.name?.trim() ||
    (row.position as string | null)?.trim() ||
    null
  )
}

/** Childcare providers are paid workers who may not be assigned to the department. */
function isChildcareProviderStaff(row: Record<string, unknown>) {
  const position = (positionLabel(row) || "").toLowerCase()
  const staffType = ((row.staff_type as string | null) || "").toLowerCase()
  if (staffType === "childcare" || staffType === "childcare_provider") return true
  return /child\s*care|babysit/.test(position)
}

async function requireOrg() {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return { ok: false as const, error: "No organization selected." }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { ok: true as const, organizationId, supabase, userId: user?.id ?? null }
}

const STAFF_SELECT_FULL =
  "id, contact_id, first_name, last_name, status, staff_type, department_id, hourly_rate, pay_basis, monthly_salary, position, position_id, hr_positions:position_id (name)"
const STAFF_SELECT_BASIC =
  "id, contact_id, first_name, last_name, status, staff_type, department_id, hourly_rate, position, position_id, hr_positions:position_id (name)"

async function loadStaffRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  options?: { departmentId?: string; staffIds?: string[] }
) {
  let query = supabase
    .from("staff")
    .select(STAFF_SELECT_FULL)
    .eq("organization_id", organizationId)
    .order("last_name", { ascending: true })

  if (options?.departmentId) {
    query = query.eq("department_id", options.departmentId)
  }
  if (options?.staffIds && options.staffIds.length > 0) {
    query = query.in("id", options.staffIds)
  }

  const result = await query

  if (result.error && /pay_basis|monthly_salary/i.test(result.error.message || "")) {
    let retry = supabase
      .from("staff")
      .select(STAFF_SELECT_BASIC)
      .eq("organization_id", organizationId)
      .order("last_name", { ascending: true })
    if (options?.departmentId) {
      retry = retry.eq("department_id", options.departmentId)
    }
    if (options?.staffIds && options.staffIds.length > 0) {
      retry = retry.in("id", options.staffIds)
    }
    const fallback = await retry
    if (fallback.error) throw new Error(fallback.error.message)
    return (fallback.data || []).map((row) => ({
      ...row,
      pay_basis: "hourly",
      monthly_salary: null,
    }))
  }

  if (result.error) throw new Error(result.error.message)
  return result.data || []
}

async function loadDepartmentStaff(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  departmentId: string
) {
  return loadStaffRows(supabase, organizationId, { departmentId })
}

/**
 * Department employees plus org-wide childcare providers (who may have no department).
 * Used for create-pay-period-for-all and hour-log pickers.
 */
async function loadPayrollEligibleStaff(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  departmentId: string
) {
  const departmentStaff = await loadDepartmentStaff(
    supabase,
    organizationId,
    departmentId
  )

  const allStaff = await loadStaffRows(supabase, organizationId)
  const childcare = allStaff.filter((row) =>
    isChildcareProviderStaff(row as Record<string, unknown>)
  )

  const byId = new Map<string, (typeof departmentStaff)[number]>()
  for (const row of departmentStaff) {
    byId.set(row.id as string, row)
  }
  for (const row of childcare) {
    if (!byId.has(row.id as string)) {
      byId.set(row.id as string, row)
    }
  }
  return [...byId.values()].sort((a, b) =>
    staffDisplayName(a as Record<string, unknown>).localeCompare(
      staffDisplayName(b as Record<string, unknown>)
    )
  )
}

function toPayrollStaffOption(row: Record<string, unknown>): PayrollStaffOption {
  return {
    staffId: row.id as string,
    fullName: staffDisplayName(row),
    payBasis: (row.pay_basis as string) === "monthly" ? "monthly" : "hourly",
    positionName: positionLabel(row),
    isChildcareProvider: isChildcareProviderStaff(row),
    departmentId: (row.department_id as string | null) ?? null,
  }
}

function staffDisplayName(row: Record<string, unknown>) {
  const first = (row.first_name as string | null)?.trim() || ""
  const last = (row.last_name as string | null)?.trim() || ""
  return `${first} ${last}`.trim() || "Unnamed employee"
}

async function findStaffForAuthUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  userId: string,
  options?: { departmentId?: string }
) {
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", userId)

  const contactIds = (contacts || []).map((row) => row.id as string)
  if (contactIds.length === 0) return null

  let query = supabase
    .from("staff")
    .select(STAFF_SELECT_FULL)
    .eq("organization_id", organizationId)
    .in("contact_id", contactIds)

  if (options?.departmentId) {
    query = query.eq("department_id", options.departmentId)
  }

  const { data: staffRows, error } = await query
  if (error && /pay_basis|monthly_salary/i.test(error.message || "")) {
    let retry = supabase
      .from("staff")
      .select(STAFF_SELECT_BASIC)
      .eq("organization_id", organizationId)
      .in("contact_id", contactIds)
    if (options?.departmentId) {
      retry = retry.eq("department_id", options.departmentId)
    }
    const fallback = await retry
    const row = (fallback.data || [])[0]
    if (!row) return null
    return {
      ...row,
      pay_basis: "hourly",
      monthly_salary: null,
    }
  }

  if (error) throw new Error(error.message)

  const rows = staffRows || []
  if (rows.length === 0) return null

  // Prefer department match when provided; otherwise first linked staff row.
  if (options?.departmentId) {
    return rows[0]
  }

  // Prefer childcare / any when logging across departments.
  const childcare = rows.find((row) =>
    isChildcareProviderStaff(row as Record<string, unknown>)
  )
  return childcare || rows[0]
}

/** Resolve the logged-in user's staff row in this department (via contact.auth_user_id). */
export async function resolveCurrentDepartmentStaffAction(departmentId: string) {
  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }
  if (!access.userId) {
    return { success: false as const, error: "Not signed in." }
  }

  const staff = await findStaffForAuthUser(
    access.supabase,
    access.organizationId,
    access.userId,
    { departmentId }
  )

  if (!staff) return { success: true as const, staff: null as null }

  return {
    success: true as const,
    staff: toPayrollStaffOption(staff as Record<string, unknown>),
  }
}

/** Resolve logged-in staff anywhere in the org (for childcare providers not assigned to a dept). */
export async function resolveCurrentOrgStaffAction() {
  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }
  if (!access.userId) {
    return { success: false as const, error: "Not signed in." }
  }

  const staff = await findStaffForAuthUser(
    access.supabase,
    access.organizationId,
    access.userId
  )

  if (!staff) return { success: true as const, staff: null as null }

  return {
    success: true as const,
    staff: toPayrollStaffOption(staff as Record<string, unknown>),
  }
}

export async function listPayrollHourLogOptionsAction(departmentId: string) {
  const canView = await canViewDepartment(departmentId)
  if (!canView) {
    return { success: false as const, error: "You do not have permission to log hours." }
  }

  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }

  const canManage = await canManageDepartment(departmentId)
  const eligible = await loadPayrollEligibleStaff(
    access.supabase,
    access.organizationId,
    departmentId
  )

  const { data: departments } = await access.supabase
    .from("departments")
    .select("id, name")
    .eq("organization_id", access.organizationId)
    .order("name", { ascending: true })

  const departmentOptions: PayrollDepartmentOption[] = (departments || []).map(
    (row) => ({
      id: row.id as string,
      name: (row.name as string) || "Department",
    })
  )

  const hourlyStaff = eligible
    .filter((row) => (row.pay_basis as string) !== "monthly")
    .map((row) => toPayrollStaffOption(row as Record<string, unknown>))

  const self = access.userId
    ? await findStaffForAuthUser(
        access.supabase,
        access.organizationId,
        access.userId
      )
    : null

  return {
    success: true as const,
    canManage,
    departments: departmentOptions,
    staffOptions: canManage
      ? hourlyStaff
      : self
        ? [toPayrollStaffOption(self as Record<string, unknown>)].filter(
            (row) => row.payBasis !== "monthly"
          )
        : [],
    selfStaffId: self ? (self.id as string) : null,
  }
}

async function syncPayPeriodFromHours(input: {
  supabase: Awaited<ReturnType<typeof createClient>>
  organizationId: string
  departmentId: string
  staffId: string
  workDate: string
  staff: Record<string, unknown>
}) {
  const payBasis: StaffPayBasis =
    (input.staff.pay_basis as string) === "monthly" ? "monthly" : "hourly"
  const hourlyRate =
    input.staff.hourly_rate == null ? null : Number(input.staff.hourly_rate)
  const monthlySalary =
    input.staff.monthly_salary == null ? null : Number(input.staff.monthly_salary)

  // Prefer an existing custom/calendar pay period that covers this work date.
  const { data: covering } = await input.supabase
    .from("department_staff_pay_entries")
    .select("id, status, period_key, period_start, period_end")
    .eq("organization_id", input.organizationId)
    .eq("department_id", input.departmentId)
    .eq("staff_id", input.staffId)
    .lte("period_start", input.workDate)
    .gte("period_end", input.workDate)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  let periodKey: string
  let periodStart: string
  let periodEnd: string
  let existingId: string | null = null
  let existingStatus: string | null = null

  if (covering?.period_start && covering?.period_end) {
    periodKey = covering.period_key as string
    periodStart = covering.period_start as string
    periodEnd = covering.period_end as string
    existingId = covering.id as string
    existingStatus = covering.status as string
  } else {
    // Fallback: calendar month containing the work date
    periodKey = periodKeyFromWorkDate(input.workDate)
    const bounds = periodBounds(periodKey)
    periodStart = bounds.periodStart
    periodEnd = bounds.periodEnd
  }

  if (existingStatus === "approved") {
    return { ok: true as const, skippedApproved: true, periodKey }
  }

  const { data: logs } = await input.supabase
    .from("department_staff_hour_logs")
    .select("hours")
    .eq("organization_id", input.organizationId)
    .eq("department_id", input.departmentId)
    .eq("staff_id", input.staffId)
    .gte("work_date", periodStart)
    .lte("work_date", periodEnd)

  const hoursWorked = roundMoney(
    (logs || []).reduce((sum, row) => sum + Number(row.hours || 0), 0)
  )

  const amount =
    payBasis === "monthly"
      ? roundMoney(monthlySalary ?? 0)
      : roundMoney(hoursWorked * (hourlyRate ?? 0))

  const payload = {
    organization_id: input.organizationId,
    department_id: input.departmentId,
    staff_id: input.staffId,
    period_key: periodKey,
    period_start: periodStart,
    period_end: periodEnd,
    hours_worked: payBasis === "monthly" ? null : hoursWorked,
    amount,
    pay_basis: payBasis,
    hourly_rate: hourlyRate,
    monthly_salary: monthlySalary,
    status: existingStatus === "pending" ? "pending" : "draft",
    updated_at: new Date().toISOString(),
  }

  if (existingId) {
    const { error } = await input.supabase
      .from("department_staff_pay_entries")
      .update(payload)
      .eq("id", existingId)
      .eq("organization_id", input.organizationId)
    if (error) return { ok: false as const, error: error.message }
  } else {
    const { error } = await input.supabase
      .from("department_staff_pay_entries")
      .upsert(payload, {
        onConflict: "organization_id,department_id,staff_id,period_key",
      })
    if (error) return { ok: false as const, error: error.message }
  }

  return { ok: true as const, skippedApproved: false, periodKey }
}

export async function logDepartmentStaffHoursAction(input: {
  departmentId: string
  staffId: string
  workDate: string
  hours: number
  notes?: string | null
}) {
  const canManage = await canManageDepartment(input.departmentId)
  const canView = await canViewDepartment(input.departmentId)
  if (!canView) {
    return { success: false as const, error: "You do not have permission to log hours." }
  }

  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.workDate)) {
    return { success: false as const, error: "Choose a valid work date." }
  }

  const hours = Number(input.hours)
  if (Number.isNaN(hours) || hours <= 0 || hours > 24) {
    return { success: false as const, error: "Enter hours between 0 and 24." }
  }

  const eligible = await loadPayrollEligibleStaff(
    access.supabase,
    access.organizationId,
    input.departmentId
  )
  const staff = eligible.find((row) => row.id === input.staffId)
  if (!staff) {
    return {
      success: false as const,
      error:
        "Staff not found. Childcare providers need a Childcare position; teachers must be in this department.",
    }
  }

  if ((staff.pay_basis as string) === "monthly") {
    return {
      success: false as const,
      error: "This employee is on a monthly salary — hours are not required.",
    }
  }

  // Teachers / providers can only log for themselves unless they can manage staff.
  if (!canManage) {
    const self = await findStaffForAuthUser(
      access.supabase,
      access.organizationId,
      access.userId!
    )
    if (!self || (self.id as string) !== input.staffId) {
      return {
        success: false as const,
        error: "You can only log hours for your own employee record.",
      }
    }
  }

  const periodKey = periodKeyFromWorkDate(input.workDate)

  const { error: logError } = await access.supabase.from("department_staff_hour_logs").upsert(
    {
      organization_id: access.organizationId,
      department_id: input.departmentId,
      staff_id: input.staffId,
      work_date: input.workDate,
      hours: roundMoney(hours),
      notes: input.notes?.trim() || null,
      created_by: access.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,department_id,staff_id,work_date" }
  )

  if (logError) {
    if (isMissingTableError(logError.message)) {
      return {
        success: false as const,
        error: "Run scripts/171_department_staff_hour_logs.sql in Supabase first.",
      }
    }
    return { success: false as const, error: logError.message }
  }

  const synced = await syncPayPeriodFromHours({
    supabase: access.supabase,
    organizationId: access.organizationId,
    departmentId: input.departmentId,
    staffId: input.staffId,
    workDate: input.workDate,
    staff: staff as Record<string, unknown>,
  })

  if (!synced.ok) {
    return { success: false as const, error: synced.error || "Could not update pay period." }
  }

  revalidatePath(workforceDepartmentDetailPath(input.departmentId))
  return { success: true as const, periodKey: synced.periodKey || periodKey }
}

/**
 * Create one pay period (custom date range) for every department employee
 * and every childcare provider (who may not be assigned to the department).
 */
export async function createPayPeriodForAllEmployeesAction(input: {
  departmentId: string
  periodStart: string
  periodEnd: string
}) {
  const allowed = await canManageDepartment(input.departmentId)
  if (!allowed) {
    return {
      success: false as const,
      error: "Only a department head / manager can create pay periods.",
    }
  }

  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd)
  ) {
    return { success: false as const, error: "Enter a valid start and end date." }
  }

  if (input.periodEnd < input.periodStart) {
    return { success: false as const, error: "End date must be on or after the start date." }
  }

  const staffRows = await loadPayrollEligibleStaff(
    access.supabase,
    access.organizationId,
    input.departmentId
  )

  if (staffRows.length === 0) {
    return {
      success: false as const,
      error: "No employees or childcare providers to create pay periods for.",
    }
  }

  const periodKey = `${input.periodStart}_${input.periodEnd}`
  let created = 0
  let skipped = 0

  for (const staff of staffRows) {
    const payBasis: StaffPayBasis =
      (staff.pay_basis as string) === "monthly" ? "monthly" : "hourly"
    const hourlyRate =
      staff.hourly_rate == null ? null : Number(staff.hourly_rate)
    const monthlySalary =
      staff.monthly_salary == null ? null : Number(staff.monthly_salary)

    const { data: existing } = await access.supabase
      .from("department_staff_pay_entries")
      .select("id, status")
      .eq("organization_id", access.organizationId)
      .eq("department_id", input.departmentId)
      .eq("staff_id", staff.id as string)
      .eq("period_key", periodKey)
      .maybeSingle()

    if (existing && (existing.status as string) === "approved") {
      skipped += 1
      continue
    }

    let hoursWorked: number | null = null
    let amount = 0

    if (payBasis === "monthly") {
      amount = roundMoney(monthlySalary ?? 0)
    } else {
      const { data: logs } = await access.supabase
        .from("department_staff_hour_logs")
        .select("hours")
        .eq("organization_id", access.organizationId)
        .eq("department_id", input.departmentId)
        .eq("staff_id", staff.id as string)
        .gte("work_date", input.periodStart)
        .lte("work_date", input.periodEnd)

      hoursWorked = roundMoney(
        (logs || []).reduce((sum, row) => sum + Number(row.hours || 0), 0)
      )
      amount = roundMoney(hoursWorked * (hourlyRate ?? 0))
    }

    const payload = {
      organization_id: access.organizationId,
      department_id: input.departmentId,
      staff_id: staff.id as string,
      period_key: periodKey,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      hours_worked: hoursWorked,
      amount,
      pay_basis: payBasis,
      hourly_rate: hourlyRate,
      monthly_salary: monthlySalary,
      status: existing?.status === "pending" ? "pending" : "draft",
      updated_at: new Date().toISOString(),
    }

    const { error } = await access.supabase
      .from("department_staff_pay_entries")
      .upsert(payload, {
        onConflict: "organization_id,department_id,staff_id,period_key",
      })

    if (error) {
      if (isMissingTableError(error.message)) {
        return {
          success: false as const,
          error: "Run scripts/170 and 171 in Supabase first.",
        }
      }
      if (/period_key_check|violates check constraint/i.test(error.message || "")) {
        return {
          success: false as const,
          error:
            "Custom date ranges need scripts/172_pay_period_custom_key.sql — run that in Supabase, then try again.",
        }
      }
      return { success: false as const, error: error.message }
    }
    created += 1
  }

  revalidatePath(workforceDepartmentDetailPath(input.departmentId))
  return { success: true as const, created, skipped, total: staffRows.length }
}

export async function submitPayPeriodAction(input: {
  departmentId: string
  payEntryId: string
}) {
  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }

  const canManage = await canManageDepartment(input.departmentId)
  const { data: entry, error } = await access.supabase
    .from("department_staff_pay_entries")
    .select("id, staff_id, status, department_id")
    .eq("organization_id", access.organizationId)
    .eq("id", input.payEntryId)
    .maybeSingle()

  if (error || !entry || entry.department_id !== input.departmentId) {
    return { success: false as const, error: "Pay period not found." }
  }

  if (!canManage) {
    const self = await findStaffForAuthUser(
      access.supabase,
      access.organizationId,
      access.userId!
    )
    if (!self || (self.id as string) !== entry.staff_id) {
      return { success: false as const, error: "You can only submit your own pay period." }
    }
  }

  if (entry.status === "approved") {
    return { success: false as const, error: "This pay period is already approved." }
  }

  const { error: updateError } = await access.supabase
    .from("department_staff_pay_entries")
    .update({
      status: "pending",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.payEntryId)
    .eq("organization_id", access.organizationId)

  if (updateError) return { success: false as const, error: updateError.message }

  revalidatePath(workforceDepartmentDetailPath(input.departmentId))
  return { success: true as const }
}

export async function approvePayPeriodAction(input: {
  departmentId: string
  payEntryId: string
  approve: boolean
}) {
  const allowed = await canManageDepartment(input.departmentId)
  if (!allowed) {
    return {
      success: false as const,
      error: "Only a department head / manager can approve payroll.",
    }
  }

  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: entry, error } = await access.supabase
    .from("department_staff_pay_entries")
    .select("id, department_id, status")
    .eq("organization_id", access.organizationId)
    .eq("id", input.payEntryId)
    .maybeSingle()

  if (error || !entry || entry.department_id !== input.departmentId) {
    return { success: false as const, error: "Pay period not found." }
  }

  const { error: updateError } = await access.supabase
    .from("department_staff_pay_entries")
    .update({
      status: input.approve ? "approved" : "rejected",
      approved_at: input.approve ? new Date().toISOString() : null,
      approved_by: input.approve ? access.userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.payEntryId)
    .eq("organization_id", access.organizationId)

  if (updateError) return { success: false as const, error: updateError.message }

  revalidatePath(workforceDepartmentDetailPath(input.departmentId))
  return { success: true as const }
}

export async function updatePayPeriodEntryAction(input: {
  departmentId: string
  payEntryId: string
  hoursWorked?: number | null
  amount?: number | null
  notes?: string | null
}) {
  const allowed = await canManageDepartment(input.departmentId)
  if (!allowed) {
    return {
      success: false as const,
      error: "Only a department head / manager can edit payroll entries.",
    }
  }

  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: entry, error } = await access.supabase
    .from("department_staff_pay_entries")
    .select(
      "id, department_id, pay_basis, hourly_rate, monthly_salary, hours_worked, amount, status"
    )
    .eq("organization_id", access.organizationId)
    .eq("id", input.payEntryId)
    .maybeSingle()

  if (error || !entry || entry.department_id !== input.departmentId) {
    return { success: false as const, error: "Pay period not found." }
  }

  const payBasis =
    (entry.pay_basis as string) === "monthly" ? "monthly" : "hourly"
  const hourlyRate =
    entry.hourly_rate == null ? null : Number(entry.hourly_rate)

  let hoursWorked =
    input.hoursWorked !== undefined
      ? input.hoursWorked
      : entry.hours_worked == null
        ? null
        : Number(entry.hours_worked)

  let amount =
    input.amount !== undefined
      ? input.amount
      : Number(entry.amount || 0)

  if (payBasis === "hourly") {
    if (hoursWorked != null && hoursWorked < 0) {
      return { success: false as const, error: "Hours cannot be negative." }
    }
    // If hours changed and amount not explicitly set, recalculate from rate.
    if (
      input.hoursWorked !== undefined &&
      input.amount === undefined &&
      hoursWorked != null &&
      hourlyRate != null
    ) {
      amount = roundMoney(hoursWorked * hourlyRate)
    }
  } else {
    hoursWorked = null
  }

  if (amount == null || !Number.isFinite(amount) || amount < 0) {
    return { success: false as const, error: "Enter a valid payment amount." }
  }

  const patch: Record<string, unknown> = {
    hours_worked: hoursWorked,
    amount: roundMoney(amount),
    updated_at: new Date().toISOString(),
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null
  }

  const { error: updateError } = await access.supabase
    .from("department_staff_pay_entries")
    .update(patch)
    .eq("id", input.payEntryId)
    .eq("organization_id", access.organizationId)

  if (updateError) return { success: false as const, error: updateError.message }

  revalidatePath(workforceDepartmentDetailPath(input.departmentId))
  return { success: true as const }
}

export async function deletePayPeriodEntryAction(input: {
  departmentId: string
  payEntryId: string
}) {
  const allowed = await canManageDepartment(input.departmentId)
  if (!allowed) {
    return {
      success: false as const,
      error: "Only a department head / manager can delete payroll entries.",
    }
  }

  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: entry, error } = await access.supabase
    .from("department_staff_pay_entries")
    .select("id, department_id, staff_id, period_key, period_start, period_end")
    .eq("organization_id", access.organizationId)
    .eq("id", input.payEntryId)
    .maybeSingle()

  if (error || !entry || entry.department_id !== input.departmentId) {
    return { success: false as const, error: "Pay period not found." }
  }

  const bounds =
    entry.period_start && entry.period_end
      ? {
          periodStart: entry.period_start as string,
          periodEnd: entry.period_end as string,
        }
      : periodBounds(entry.period_key as string)

  // Remove hour logs in this period so the line does not reappear from sync.
  await access.supabase
    .from("department_staff_hour_logs")
    .delete()
    .eq("organization_id", access.organizationId)
    .eq("department_id", input.departmentId)
    .eq("staff_id", entry.staff_id)
    .gte("work_date", bounds.periodStart)
    .lte("work_date", bounds.periodEnd)

  const { error: deleteError } = await access.supabase
    .from("department_staff_pay_entries")
    .delete()
    .eq("id", input.payEntryId)
    .eq("organization_id", access.organizationId)

  if (deleteError) return { success: false as const, error: deleteError.message }

  revalidatePath(workforceDepartmentDetailPath(input.departmentId))
  return { success: true as const }
}

export async function fetchDepartmentPayrollList(
  departmentId: string,
  options?: { scope?: "visible" | "all-approved-for-budget" }
): Promise<{
  rows: DepartmentPayPeriodRow[]
  migrationRequired: boolean
  canApprove: boolean
  selfStaffId: string | null
}> {
  const canView = await canViewDepartment(departmentId)
  if (!canView) throw new Error("You do not have permission to view payroll.")

  const canApprove = await canManageDepartment(departmentId)
  const access = await requireOrg()
  if (!access.ok) {
    return { rows: [], migrationRequired: false, canApprove: false, selfStaffId: null }
  }

  const selfRow = access.userId
    ? await findStaffForAuthUser(
        access.supabase,
        access.organizationId,
        access.userId
      )
    : null
  const selfStaffId = selfRow ? (selfRow.id as string) : null

  const eligible = await loadPayrollEligibleStaff(
    access.supabase,
    access.organizationId,
    departmentId
  )

  const { data: entries, error } = await access.supabase
    .from("department_staff_pay_entries")
    .select(
      "id, staff_id, period_key, period_start, period_end, hours_worked, amount, status, pay_basis, hourly_rate, monthly_salary"
    )
    .eq("organization_id", access.organizationId)
    .eq("department_id", departmentId)
    .order("period_key", { ascending: false })

  let migrationRequired = false
  if (error) {
    if (isMissingTableError(error.message) || /status|period_start/i.test(error.message)) {
      migrationRequired = true
      return { rows: [], migrationRequired: true, canApprove, selfStaffId }
    }
    throw new Error(error.message)
  }

  const staffById = new Map(
    eligible.map((row) => [row.id as string, row as Record<string, unknown>])
  )

  // Fill names for any pay-entry staff not already in eligible (legacy rows).
  const missingIds = [
    ...new Set(
      (entries || [])
        .map((entry) => entry.staff_id as string)
        .filter((id) => !staffById.has(id))
    ),
  ]
  if (missingIds.length > 0) {
    const extra = await loadStaffRows(access.supabase, access.organizationId, {
      staffIds: missingIds,
    })
    for (const row of extra) {
      staffById.set(row.id as string, row as Record<string, unknown>)
    }
  }

  const rows: DepartmentPayPeriodRow[] = (entries || []).map((entry) => {
    const staff = staffById.get(entry.staff_id as string)
    const bounds =
      entry.period_start && entry.period_end
        ? {
            periodStart: entry.period_start as string,
            periodEnd: entry.period_end as string,
          }
        : periodBounds(entry.period_key as string)

    const payBasis: StaffPayBasis =
      (entry.pay_basis as string) === "monthly" ||
      (staff?.pay_basis as string) === "monthly"
        ? "monthly"
        : "hourly"

    return {
      id: entry.id as string,
      staffId: entry.staff_id as string,
      fullName: staff ? staffDisplayName(staff) : "Employee",
      positionName: staff ? positionLabel(staff) : null,
      isChildcareProvider: staff ? isChildcareProviderStaff(staff) : false,
      payBasis,
      hourlyRate:
        entry.hourly_rate == null
          ? staff?.hourly_rate == null
            ? null
            : Number(staff.hourly_rate)
          : Number(entry.hourly_rate),
      monthlySalary:
        entry.monthly_salary == null
          ? staff?.monthly_salary == null
            ? null
            : Number(staff.monthly_salary)
          : Number(entry.monthly_salary),
      periodKey: entry.period_key as string,
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      hoursWorked:
        entry.hours_worked == null ? null : Number(entry.hours_worked),
      amount: roundMoney(Number(entry.amount || 0)),
      status: (entry.status as PayPeriodStatus) || "draft",
    }
  })

  // Teachers without manage permission only see their own rows (UI list).
  // Budget aggregation uses scope all-approved-for-budget (caller filters approved).
  const visible =
    options?.scope === "all-approved-for-budget" || canApprove
      ? rows
      : rows.filter((row) => row.staffId === selfStaffId)

  return {
    rows: visible,
    migrationRequired,
    canApprove,
    selfStaffId,
  }
}

export async function fetchDepartmentPayrollListAction(departmentId: string) {
  try {
    const result = await fetchDepartmentPayrollList(departmentId)
    return { success: true as const, ...result }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load payroll.",
    }
  }
}

export async function fetchStaffHourLogsAction(input: {
  departmentId: string
  staffId: string
  periodKey: string
}) {
  const access = await requireOrg()
  if (!access.ok) return { success: false as const, error: access.error }

  const canManage = await canManageDepartment(input.departmentId)
  if (!canManage) {
    const self = await findStaffForAuthUser(
      access.supabase,
      access.organizationId,
      access.userId!
    )
    if (!self || (self.id as string) !== input.staffId) {
      return { success: false as const, error: "You can only view your own hour logs." }
    }
  }

  // Prefer explicit bounds from the pay entry when available via periodKey parsing.
  let periodStart = ""
  let periodEnd = ""
  const { data: entry } = await access.supabase
    .from("department_staff_pay_entries")
    .select("period_start, period_end")
    .eq("organization_id", access.organizationId)
    .eq("department_id", input.departmentId)
    .eq("staff_id", input.staffId)
    .eq("period_key", input.periodKey)
    .maybeSingle()

  if (entry?.period_start && entry?.period_end) {
    periodStart = entry.period_start as string
    periodEnd = entry.period_end as string
  } else {
    const bounds = periodBounds(input.periodKey)
    periodStart = bounds.periodStart
    periodEnd = bounds.periodEnd
  }
  const { data, error } = await access.supabase
    .from("department_staff_hour_logs")
    .select("id, work_date, hours, notes")
    .eq("organization_id", access.organizationId)
    .eq("department_id", input.departmentId)
    .eq("staff_id", input.staffId)
    .gte("work_date", periodStart)
    .lte("work_date", periodEnd)
    .order("work_date", { ascending: false })

  if (error) {
    if (isMissingTableError(error.message)) {
      return { success: true as const, logs: [] as DepartmentHourLogRow[], migrationRequired: true }
    }
    return { success: false as const, error: error.message }
  }

  return {
    success: true as const,
    migrationRequired: false,
    logs: (data || []).map(
      (row): DepartmentHourLogRow => ({
        id: row.id as string,
        workDate: row.work_date as string,
        hours: Number(row.hours || 0),
        notes: (row.notes as string | null) ?? null,
      })
    ),
  }
}

/** Approved payroll totals by month for Budget (and legacy matrix callers). */
export async function fetchDepartmentPayrollMatrix(departmentId: string) {
  const list = await fetchDepartmentPayrollList(departmentId, {
    scope: "all-approved-for-budget",
  })
  const monthsMap = new Map<string, { periodKey: string; label: string }>()
  const byStaff = new Map<
    string,
    {
      staffId: string
      fullName: string
      payBasis: StaffPayBasis
      hourlyRate: number | null
      monthlySalary: number | null
      months: Record<
        string,
        { periodKey: string; hoursWorked: number | null; amount: number; entryId: string | null }
      >
    }
  >()

  for (const row of list.rows) {
    if (row.status !== "approved") continue
    const labelDate = /^\d{4}-\d{2}$/.test(row.periodKey)
      ? `${row.periodKey}-01`
      : row.periodStart
    const label = new Date(`${labelDate}T00:00:00Z`).toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC",
    })
    monthsMap.set(row.periodKey, { periodKey: row.periodKey, label })

    let staff = byStaff.get(row.staffId)
    if (!staff) {
      staff = {
        staffId: row.staffId,
        fullName: row.fullName,
        payBasis: row.payBasis,
        hourlyRate: row.hourlyRate,
        monthlySalary: row.monthlySalary,
        months: {},
      }
      byStaff.set(row.staffId, staff)
    }
    staff.months[row.periodKey] = {
      periodKey: row.periodKey,
      hoursWorked: row.hoursWorked,
      amount: row.amount,
      entryId: row.id,
    }
  }

  return {
    months: [...monthsMap.values()].sort((a, b) => a.periodKey.localeCompare(b.periodKey)),
    rows: [...byStaff.values()],
    migrationRequired: list.migrationRequired,
  }
}

export async function fetchDepartmentPayrollAction(departmentId: string) {
  return fetchDepartmentPayrollListAction(departmentId)
}
