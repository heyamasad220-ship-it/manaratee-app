import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { DEPARTMENT_WORKSPACE_PROGRAM_STATUSES } from "@/lib/departments/department-active-programs"
import {
  normalizeProgramKind,
  type ProgramKind,
} from "@/lib/programs/program-kind"
import type { Program } from "@/lib/programs/program-types"

function withProgramKind<T extends Record<string, unknown>>(row: T): T & {
  program_kind: ProgramKind
} {
  return {
    ...row,
    program_kind: normalizeProgramKind(
      typeof row.program_kind === "string" ? row.program_kind : null
    ),
  }
}

export async function getPrograms() {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error(error)
    throw new Error("Failed to load programs")
  }

  return (data || []).map((row) => withProgramKind(row)) as Program[]
}

async function loadPrograms(options?: { statuses?: readonly string[] }) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return [] as Program[]
  }

  try {
    const { autoCloseExpiredYearPrograms } = await import(
      "@/lib/departments/department-year-auto-close"
    )
    await autoCloseExpiredYearPrograms({ organizationId })
  } catch (error) {
    console.error("autoCloseExpiredYearPrograms:", error)
  }

  let query = supabase
    .from("programs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (options?.statuses) {
    query = query.in("status", [...options.statuses])
  }

  const { data, error } = await query

  if (error) {
    console.error(error)
    throw new Error("Failed to load programs")
  }

  return (data || []).map((row) => withProgramKind(row)) as Program[]
}

/** Workspace years/seasons (includes closed; excludes archived). */
export async function getOpenPrograms() {
  return loadPrograms({ statuses: DEPARTMENT_WORKSPACE_PROGRAM_STATUSES })
}

/** Programs Home list: every status, including archived, so Status can reach Closed/Archived. */
export async function getStaffListPrograms() {
  return loadPrograms()
}

export async function getProgramById(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return null
  }

  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single()

  if (error) {
    console.error(error)
    return null
  }

  return withProgramKind(data) as Program
}
