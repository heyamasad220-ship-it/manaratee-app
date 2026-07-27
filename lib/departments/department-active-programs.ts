import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

/** Years visible in the department workspace (includes finished/closed years). */
export const DEPARTMENT_WORKSPACE_PROGRAM_STATUSES = [
  "draft",
  "active",
  "paused",
  "closed",
] as const

/**
 * Years still operating for catalog / new-enrollment surfaces.
 * Closed years stay in the department workspace but are not sold as open.
 */
export const DEPARTMENT_OPEN_PROGRAM_STATUSES = [
  "draft",
  "active",
  "paused",
] as const

export type DepartmentOpenProgramStatus =
  (typeof DEPARTMENT_OPEN_PROGRAM_STATUSES)[number]

export type DepartmentWorkspaceProgramStatus =
  (typeof DEPARTMENT_WORKSPACE_PROGRAM_STATUSES)[number]

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

/**
 * Load department year/season programs for the workspace (not archived).
 * Includes closed years so staff can report and compare across years.
 */
export async function loadDepartmentOpenPrograms(
  organizationId: string,
  departmentId: string
): Promise<DepartmentOpenProgram[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, status, start_date, end_date")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .in("status", [...DEPARTMENT_WORKSPACE_PROGRAM_STATUSES])
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

export async function loadDepartmentOpenProgramIds(
  departmentId: string
): Promise<string[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []
  const programs = await loadDepartmentOpenPrograms(organizationId, departmentId)
  return programs.map((p) => p.id)
}
