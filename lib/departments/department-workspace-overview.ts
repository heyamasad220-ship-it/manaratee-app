"use server"

import { fetchDepartmentDetail } from "@/lib/departments/department-actions"
import { canViewDepartment } from "@/lib/departments/department-access"
import {
  DEPARTMENT_OPEN_PROGRAM_STATUSES,
  loadDepartmentOpenPrograms,
} from "@/lib/departments/department-active-programs"
import { summarizeDepartmentStaff } from "@/lib/departments/department-list-summary"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"

export type DepartmentWorkspaceOverview = {
  studentsCount: number
  staffCount: number
  directorName: string | null
  upcomingEventsCount: number
  /** True when at least one draft/active/paused year exists. */
  hasOpenYears: boolean
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

const ACTIVE_ENROLLMENT_STATUSES = [
  "pending_payment",
  "pending",
  "enrolled",
  "active",
  "completed",
] as const

/**
 * KPI strip for the department Overview tab.
 * Participants use **open** years only (draft / active / paused).
 * Closed years stay on cards and operating tabs for reports, but do not inflate
 * the live Overview KPIs.
 */
export async function fetchDepartmentWorkspaceOverview(
  departmentId: string
): Promise<DepartmentWorkspaceOverview> {
  const canView = await canViewDepartment(departmentId)
  if (!canView) {
    throw new Error("You do not have permission to view this department.")
  }

  const organizationId = await getSelectedOrganizationId()
  const empty: DepartmentWorkspaceOverview = {
    studentsCount: 0,
    staffCount: 0,
    directorName: null,
    upcomingEventsCount: 0,
    hasOpenYears: false,
  }
  if (!organizationId) return empty

  const supabase = await createClient()

  const [detail, openPrograms] = await Promise.all([
    fetchDepartmentDetail(departmentId),
    loadDepartmentOpenPrograms(organizationId, departmentId).then((rows) =>
      rows.filter((row) =>
        (DEPARTMENT_OPEN_PROGRAM_STATUSES as readonly string[]).includes(row.status)
      )
    ),
  ])

  // Prefer counting enrollments on open years only (not closed).
  const openProgramIds = openPrograms.map((p) => p.id)
  let studentsCount = 0
  if (openProgramIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("program_enrollments")
      .select("id, child_name, participant_contact_id, child_person_id")
      .eq("organization_id", organizationId)
      .in("program_id", openProgramIds)
      .in("status", [...ACTIVE_ENROLLMENT_STATUSES])

    const keys = new Set<string>()
    for (const row of enrollments || []) {
      const personId = row.child_person_id as string | null
      const contactId = row.participant_contact_id as string | null
      const name = String(row.child_name || "")
        .trim()
        .toLowerCase()
      const key = personId
        ? `person:${personId}`
        : contactId
          ? `contact:${contactId}`
          : name
            ? `name:${name}`
            : `enrollment:${row.id}`
      keys.add(key)
    }
    studentsCount = keys.size
  }

  const staffCount = detail?.staff.length ?? 0
  const directorName = await loadDepartmentDirectorName(
    supabase,
    organizationId,
    departmentId
  )

  let upcomingEventsCount = 0
  const { data: events, error } = await supabase
    .from("internal_events")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .gte("start_at", `${todayIsoDate()}T00:00:00.000Z`)

  if (!error) {
    upcomingEventsCount = events?.length ?? 0
  }

  return {
    studentsCount,
    staffCount,
    directorName,
    upcomingEventsCount,
    hasOpenYears: openProgramIds.length > 0,
  }
}

async function loadDepartmentDirectorName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  departmentId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("staff")
    .select("first_name, last_name, status, is_department_head")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)

  if (error) return null

  return (
    summarizeDepartmentStaff(
      (data || []).map((row) => ({
        department_id: departmentId,
        first_name: row.first_name as string | null,
        last_name: row.last_name as string | null,
        status: row.status as string | null,
        is_department_head: Boolean(row.is_department_head),
      }))
    ).get(departmentId)?.directorName ?? null
  )
}

export async function fetchDepartmentWorkspaceOverviewAction(departmentId: string) {
  try {
    const overview = await fetchDepartmentWorkspaceOverview(departmentId)
    return { success: true as const, overview }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not load department overview.",
    }
  }
}
