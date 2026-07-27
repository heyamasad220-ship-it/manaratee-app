"use server"

import { loadDepartmentOpenPrograms } from "@/lib/departments/department-active-programs"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import { getOfferingEnrollmentCount } from "@/lib/programs/program-staff-assignment-queries"
import { createClient } from "@/lib/supabase/server"

export type DepartmentProgramsYear = {
  id: string
  name: string
  status: string
  program_kind: "academic" | "seasonal"
  start_date: string | null
  end_date: string | null
  enrollment_open_date: string | null
  enrollment_close_date: string | null
}

export type DepartmentProgramsOfferingRow = {
  offering: ProgramOffering
  enrolled: number
  yearProgramId: string
  yearProgramName: string
}

export type DepartmentProgramsBundle = {
  years: DepartmentProgramsYear[]
  offerings: DepartmentProgramsOfferingRow[]
}

async function loadOpenYearsWithEnrollmentDates(
  organizationId: string,
  departmentId: string
): Promise<DepartmentProgramsYear[]> {
  const open = await loadDepartmentOpenPrograms(organizationId, departmentId)
  if (open.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("programs")
    .select(
      "id, name, status, program_kind, start_date, end_date, enrollment_open_date, enrollment_close_date"
    )
    .eq("organization_id", organizationId)
    .in(
      "id",
      open.map((row) => row.id)
    )

  if (error) {
    throw new Error(error.message || "Could not load department years.")
  }

  const byId = new Map(
    (data || []).map((row) => [
      row.id as string,
      {
        id: row.id as string,
        name: (row.name as string) || "Year",
        status: (row.status as string) || "active",
        program_kind:
          (row.program_kind as string) === "seasonal" ? "seasonal" : "academic",
        start_date: (row.start_date as string | null) ?? null,
        end_date: (row.end_date as string | null) ?? null,
        enrollment_open_date:
          (row.enrollment_open_date as string | null) ?? null,
        enrollment_close_date:
          (row.enrollment_close_date as string | null) ?? null,
      } satisfies DepartmentProgramsYear,
    ])
  )

  // Preserve open-programs sort order (start_date desc, name).
  return open
    .map((row) => byId.get(row.id))
    .filter((row): row is DepartmentProgramsYear => Boolean(row))
}

export async function fetchDepartmentPrograms(
  departmentId: string
): Promise<DepartmentProgramsBundle> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { years: [], offerings: [] }
  }

  const years = await loadOpenYearsWithEnrollmentDates(
    organizationId,
    departmentId
  )
  if (years.length === 0) {
    return { years: [], offerings: [] }
  }

  const offerings: DepartmentProgramsOfferingRow[] = []

  for (const year of years) {
    const programOfferings = await getOfferingsForProgram(year.id)
    const counts = await Promise.all(
      programOfferings.map(async (offering) => ({
        offeringId: offering.id,
        enrolled: await getOfferingEnrollmentCount(
          offering.id,
          organizationId
        ),
      }))
    )
    const enrolledById = new Map(
      counts.map((row) => [row.offeringId, row.enrolled])
    )

    for (const offering of programOfferings) {
      offerings.push({
        offering,
        enrolled: enrolledById.get(offering.id) || 0,
        yearProgramId: year.id,
        yearProgramName: year.name,
      })
    }
  }

  return { years, offerings }
}

export async function fetchDepartmentProgramsAction(departmentId: string) {
  try {
    const result = await fetchDepartmentPrograms(departmentId)
    return { success: true as const, ...result }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Could not load department programs.",
    }
  }
}
