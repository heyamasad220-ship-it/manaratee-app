import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  DEPARTMENT_OPEN_PROGRAM_STATUSES,
  DEPARTMENT_WORKSPACE_PROGRAM_STATUSES,
} from "@/lib/departments/department-program-statuses"
import { autoCloseExpiredYearPrograms } from "@/lib/departments/department-year-auto-close"

export {
  DEPARTMENT_OPEN_PROGRAM_STATUSES,
  DEPARTMENT_WORKSPACE_PROGRAM_STATUSES,
  type DepartmentOpenProgramStatus,
  type DepartmentWorkspaceProgramStatus,
} from "@/lib/departments/department-program-statuses"

export type DepartmentOpenProgram = {
  id: string
  name: string
  status: string
  startDate: string | null
  endDate: string | null
}

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

function periodsOverlap(
  periodStart: string | null,
  periodEnd: string | null,
  rangeStart: string | null,
  rangeEnd: string | null
) {
  if (!rangeStart && !rangeEnd) return true
  if (!periodStart || !periodEnd) return true
  const start = rangeStart || "0000-01-01"
  const end = rangeEnd || "9999-12-31"
  return periodStart <= end && periodEnd >= start
}

/**
 * True when a pay/budget period belongs to any open year/season.
 * If open years have no dates, rows are kept (cannot date-filter).
 * If there are no open years, returns false.
 */
export function periodOverlapsOpenPrograms(
  periodStart: string | null,
  periodEnd: string | null,
  programs: Array<{ startDate: string | null; endDate: string | null }>
): boolean {
  if (programs.length === 0) return false
  const dated = programs.filter((program) => program.startDate || program.endDate)
  if (dated.length === 0) return true
  return dated.some((program) =>
    periodsOverlap(periodStart, periodEnd, program.startDate, program.endDate)
  )
}

/** True when a calendar date falls within any open year/season. */
export function dateWithinOpenPrograms(
  date: string | null,
  programs: Array<{ startDate: string | null; endDate: string | null }>
): boolean {
  if (programs.length === 0) return false
  const dated = programs.filter((program) => program.startDate || program.endDate)
  if (dated.length === 0) return true
  if (!date) return true
  return dated.some((program) => {
    if (program.startDate && date < program.startDate) return false
    if (program.endDate && date > program.endDate) return false
    return true
  })
}

async function loadDepartmentProgramsByStatuses(
  organizationId: string,
  departmentId: string,
  statuses: readonly string[]
): Promise<DepartmentOpenProgram[]> {
  try {
    await autoCloseExpiredYearPrograms({ organizationId, departmentId })
  } catch (error) {
    console.error("autoCloseExpiredYearPrograms:", error)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, status, start_date, end_date")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .in("status", [...statuses])
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true })

  if (error) throw new Error(error.message || "Could not load department programs.")
  return (data || []).map((row) => ({
    id: row.id as string,
    name: (row.name as string) || "Program",
    status: (row.status as string) || "active",
    startDate: (row.start_date as string | null) ?? null,
    endDate: (row.end_date as string | null) ?? null,
  }))
}

/**
 * Operating years only (draft / active / paused) — Financial, catalog, new enrollment.
 */
export async function loadDepartmentOpenPrograms(
  organizationId: string,
  departmentId: string
): Promise<DepartmentOpenProgram[]> {
  return loadDepartmentProgramsByStatuses(
    organizationId,
    departmentId,
    DEPARTMENT_OPEN_PROGRAM_STATUSES
  )
}

/**
 * Workspace years including closed — Offerings / Registrations / Reports compare.
 */
export async function loadDepartmentWorkspacePrograms(
  organizationId: string,
  departmentId: string
): Promise<DepartmentOpenProgram[]> {
  return loadDepartmentProgramsByStatuses(
    organizationId,
    departmentId,
    DEPARTMENT_WORKSPACE_PROGRAM_STATUSES
  )
}

export async function loadDepartmentOpenProgramIds(
  departmentId: string
): Promise<string[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []
  const programs = await loadDepartmentOpenPrograms(organizationId, departmentId)
  return programs.map((p) => p.id)
}
