"use server"

import { getDepartments } from "@/lib/departments/department-queries"
import { canViewDepartment } from "@/lib/departments/department-access"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { ROSTER_ENROLLMENT_STATUSES } from "@/lib/programs/enrollment-status-helpers"
import { getOpenPrograms } from "@/lib/programs/program-queries"
import { createClient } from "@/lib/supabase/server"
import {
  makeSeriesKey,
  parseProgramSeriesAndYear,
  type YearComparisonFact,
} from "@/lib/programs/year-comparison"

type EnrollmentRow = {
  program_id: string | null
  department_id: string | null
  child_name: string | null
  child_person_id: string | null
  participant_contact_id: string | null
  registrant_contact_id: string | null
}

function normalizeName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

async function fetchRosterEnrollments(
  organizationId: string,
  programIds?: string[]
): Promise<EnrollmentRow[]> {
  if (programIds && programIds.length === 0) return []

  const supabase = await createClient()
  const pageSize = 1000
  const rows: EnrollmentRow[] = []
  let from = 0
  for (;;) {
    let query = supabase
      .from("program_enrollments")
      .select(
        `
        program_id,
        department_id,
        child_name,
        child_person_id,
        participant_contact_id,
        registrant_contact_id
      `
      )
      .eq("organization_id", organizationId)
      .in("status", [...ROSTER_ENROLLMENT_STATUSES])

    if (programIds) {
      query = query.in("program_id", programIds)
    }

    const { data, error } = await query.range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const page = (data || []) as EnrollmentRow[]
    rows.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }
  return rows
}

export async function getYearComparisonFacts(options?: {
  departmentId?: string
}): Promise<
  | { success: true; facts: YearComparisonFact[] }
  | { success: false; error: string }
> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const departmentId = options?.departmentId
  if (departmentId) {
    const canView = await canViewDepartment(departmentId)
    if (!canView) {
      return {
        success: false,
        error: "You do not have permission to view this department.",
      }
    }
  }

  try {
    const [allPrograms, departments] = await Promise.all([
      getOpenPrograms(),
      getDepartments(),
    ])
    const programs = departmentId
      ? allPrograms.filter((program) => program.department_id === departmentId)
      : allPrograms
    const enrollments = await fetchRosterEnrollments(
      organizationId,
      departmentId ? programs.map((program) => program.id) : undefined
    )

    const departmentNameById = new Map(
      departments.map((department) => [department.id, department.name])
    )
    const programById = new Map(programs.map((program) => [program.id, program]))

    const facts: YearComparisonFact[] = []
    for (const enrollment of enrollments) {
      const programId = enrollment.program_id
      if (!programId) continue
      const program = programById.get(programId)
      if (!program) continue

      const familyId =
        enrollment.registrant_contact_id || enrollment.participant_contact_id
      if (!familyId) continue

      const kidId =
        enrollment.child_person_id ||
        enrollment.participant_contact_id ||
        `name:${familyId}:${normalizeName(enrollment.child_name)}`

      const departmentId =
        program.department_id || enrollment.department_id || ""
      const parsed = parseProgramSeriesAndYear(program.name, program.start_date)
      facts.push({
        departmentId,
        departmentName: departmentNameById.get(departmentId) || "No department",
        seriesKey: makeSeriesKey(departmentId, parsed.seriesRaw),
        seriesLabel: parsed.seriesLabel,
        yearKey: parsed.yearKey,
        yearLabel: parsed.yearLabel,
        sortYear: parsed.sortYear,
        programId,
        programKind: program.program_kind,
        familyId,
        kidId,
      })
    }

    return { success: true, facts }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not load year comparison data.",
    }
  }
}
