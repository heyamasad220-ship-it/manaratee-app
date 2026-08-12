"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { loadDepartmentWorkspacePrograms } from "@/lib/departments/department-active-programs"
import { createProgram } from "@/lib/programs/program-actions"
import { createProgramOffering } from "@/lib/programs/program-offering-actions"
import type {
  ProgramOffering,
  ProgramOfferingInput,
  ProgramOfferingStatus,
  ProgramOfferingType,
} from "@/lib/programs/program-offering-types"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"

export type DepartmentProgramOption = {
  id: string
  name: string
}

export type DepartmentOfferingRow = {
  id: string
  programId: string
  programName: string
  name: string
  offeringType: ProgramOfferingType
  status: ProgramOfferingStatus
  startDate: string | null
  endDate: string | null
  isDefault: boolean
}

async function loadDepartmentPrograms(
  organizationId: string,
  departmentId: string
): Promise<DepartmentProgramOption[]> {
  const programs = await loadDepartmentWorkspacePrograms(organizationId, departmentId)
  return programs.map((row) => ({
    id: row.id,
    name: row.name,
  }))
}

export async function fetchDepartmentOfferings(
  departmentId: string
): Promise<{
  programs: DepartmentProgramOption[]
  offerings: DepartmentOfferingRow[]
}> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return { programs: [], offerings: [] }

  const programs = await loadDepartmentPrograms(organizationId, departmentId)
  if (programs.length === 0) return { programs: [], offerings: [] }

  const supabase = await createClient()
  const programIds = programs.map((p) => p.id)
  const programNameById = new Map(programs.map((p) => [p.id, p.name]))

  const { data, error } = await supabase
    .from("program_offerings")
    .select(
      "id, program_id, name, offering_type, status, start_date, end_date, is_default"
    )
    .eq("organization_id", organizationId)
    .in("program_id", programIds)
    .neq("status", "archived")
    .order("start_date", { ascending: false })

  if (error) throw new Error(error.message || "Could not load offerings.")

  const offerings: DepartmentOfferingRow[] = (data || []).map((row) => ({
    id: row.id as string,
    programId: row.program_id as string,
    programName: programNameById.get(row.program_id as string) || "Program",
    name: (row.name as string) || "Offering",
    offeringType: (row.offering_type as ProgramOfferingType) || "standard",
    status: (row.status as ProgramOfferingStatus) || "draft",
    startDate: (row.start_date as string | null) ?? null,
    endDate: (row.end_date as string | null) ?? null,
    isDefault: Boolean(row.is_default),
  }))

  return { programs, offerings }
}

export async function fetchDepartmentOfferingsAction(departmentId: string) {
  try {
    const result = await fetchDepartmentOfferings(departmentId)
    return { success: true as const, ...result }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load offerings.",
    }
  }
}

export async function listDepartmentProgramsAction(departmentId: string) {
  try {
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: true as const, programs: [] as DepartmentProgramOption[] }
    }
    const programs = await loadDepartmentPrograms(organizationId, departmentId)
    return { success: true as const, programs }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load programs.",
    }
  }
}

/**
 * Create a lightweight program under this department (umbrella for offerings).
 */
export async function createDepartmentProgramAction(input: {
  departmentId: string
  name: string
}) {
  const name = input.name.trim()
  if (!name) {
    return { success: false as const, error: "Program name is required." }
  }

  try {
    const { programId } = await createProgram({
      name,
      department_id: input.departmentId,
      program_kind: "academic",
      status: "active",
      program_type: "adult",
    })

    revalidatePath(workforceDepartmentDetailPath(input.departmentId))
    return {
      success: true as const,
      program: { id: programId, name },
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not create program.",
    }
  }
}

export async function createDepartmentOfferingAction(input: {
  departmentId: string
  programId: string
  name: string
  offeringType?: ProgramOfferingType
  startDate?: string | null
  endDate?: string | null
  status?: ProgramOfferingStatus
  inheritDates?: boolean
  inheritEligibility?: boolean
  inheritEnrollment?: boolean
}) {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  // Ensure program belongs to this department.
  const programs = await loadDepartmentPrograms(organizationId, input.departmentId)
  if (!programs.some((p) => p.id === input.programId)) {
    return {
      success: false as const,
      error: "Choose a program that belongs to this department.",
    }
  }

  const payload: ProgramOfferingInput = {
    name: input.name,
    // Type label only (e.g. academic year); does not control capacity/pricing.
    offering_type: input.offeringType ?? "academic_year",
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    status: input.status ?? "draft",
    inherit_dates: input.inheritDates ?? true,
    inherit_eligibility: input.inheritEligibility ?? true,
    inherit_enrollment: input.inheritEnrollment ?? true,
  }

  try {
    const offering = (await createProgramOffering(
      input.programId,
      payload,
      organizationId
    )) as ProgramOffering

    revalidatePath(workforceDepartmentDetailPath(input.departmentId))
    return {
      success: true as const,
      offeringId: offering.id,
      programId: input.programId,
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not create offering.",
    }
  }
}
