import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  summarizeOfferingsCapacity,
  type ProgramCatalogCapacity,
} from "@/lib/programs/program-catalog-capacity"
import { ROSTER_ENROLLMENT_STATUSES } from "@/lib/programs/enrollment-process"
import {
  isCancelledOfferingStatus,
  type ProgramOffering,
} from "@/lib/programs/program-offering-types"

/** Offerings staff treat as Active (hidden cancelled; archived is already dropped). */
export function isStaffVisibleOfferingStatus(status: string | null | undefined) {
  const value = String(status || "").toLowerCase()
  return value !== "archived" && !isCancelledOfferingStatus(value)
}

export async function getDefaultOfferingForProgram(programId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return null
  }

  const { data, error } = await supabase
    .from("program_offerings")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .eq("is_default", true)
    .maybeSingle()

  if (error) {
    console.error("getDefaultOfferingForProgram:", error.message)
    return null
  }

  return data as ProgramOffering | null
}

export async function getDefaultOfferingForProgramByOrg(
  programId: string,
  organizationId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_offerings")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .eq("is_default", true)
    .maybeSingle()

  if (error) {
    console.error("getDefaultOfferingForProgramByOrg:", error.message)
    return null
  }

  return data as ProgramOffering | null
}

export async function getOfferingsForProgram(programId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("program_offerings")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    console.error("getOfferingsForProgram:", error.message)
    throw new Error("Failed to load program offerings")
  }

  return (data || []) as ProgramOffering[]
}

export async function getOfferingByIdForOrg(
  offeringId: string,
  organizationId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_offerings")
    .select("*")
    .eq("id", offeringId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    console.error("getOfferingByIdForOrg:", error.message)
    return null
  }

  return data as ProgramOffering | null
}

export async function getCustomerOfferingsForProgram(
  programId: string,
  organizationId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_offerings")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .in("status", ["active", "closed"])
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    console.error("getCustomerOfferingsForProgram:", error.message)
    return []
  }

  return (data || []) as ProgramOffering[]
}

export async function getOfferingCountsByProgramIds(programIds: string[]) {
  if (programIds.length === 0) {
    return new Map<string, number>()
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return new Map<string, number>()
  }

  const { data, error } = await supabase
    .from("program_offerings")
    .select("program_id")
    .eq("organization_id", organizationId)
    .in("program_id", programIds)
    .neq("status", "archived")
    .neq("status", "cancelled")

  if (error) {
    console.error("getOfferingCountsByProgramIds:", error.message)
    return new Map<string, number>()
  }

  const counts = new Map<string, number>()

  for (const row of data || []) {
    const programId = row.program_id as string
    counts.set(programId, (counts.get(programId) || 0) + 1)
  }

  return counts
}

export type StaffVisibleOfferingRow = {
  id: string
  program_id: string
  capacity: number | null
  capacity_mode: string | null
}

export async function loadStaffVisibleOfferingsForPrograms(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  programIds: string[]
): Promise<StaffVisibleOfferingRow[]> {
  if (programIds.length === 0) return []
  const { data, error } = await supabase
    .from("program_offerings")
    .select("id, program_id, capacity, capacity_mode, status")
    .eq("organization_id", organizationId)
    .in("program_id", programIds)
    .neq("status", "archived")

  if (error) {
    console.error("loadStaffVisibleOfferingsForPrograms:", error.message)
    return []
  }

  return (data || [])
    .filter((row) => isStaffVisibleOfferingStatus(row.status as string | null))
    .map((row) => ({
      id: row.id as string,
      program_id: row.program_id as string,
      capacity: (row.capacity as number | null) ?? null,
      capacity_mode: (row.capacity_mode as string | null) ?? null,
    }))
}

/** Roster enrollments (enrolled / active) on staff-visible offerings only. */
export async function countRosterEnrollmentsOnVisibleOfferings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  programIds: string[],
  visibleOfferings: StaffVisibleOfferingRow[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(programIds.map((id) => [id, 0]))
  const offeringIdsByProgram = new Map<string, string[]>()
  for (const offering of visibleOfferings) {
    const current = offeringIdsByProgram.get(offering.program_id) || []
    current.push(offering.id)
    offeringIdsByProgram.set(offering.program_id, current)
  }

  const results = await Promise.all(
    programIds.map(async (programId) => {
      const offeringIds = offeringIdsByProgram.get(programId) || []
      if (offeringIds.length === 0) return [programId, 0] as const
      const { count, error } = await supabase
        .from("program_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("program_id", programId)
        .in("offering_id", offeringIds)
        .in("status", [...ROSTER_ENROLLMENT_STATUSES])
      if (error) {
        console.error("countRosterEnrollmentsOnVisibleOfferings:", error.message)
        return [programId, 0] as const
      }
      return [programId, count ?? 0] as const
    })
  )

  for (const [id, n] of results) counts.set(id, n)
  return counts
}

/** Exact enrollment totals per program. Avoids the PostgREST 1,000-row select cap. */
export async function countEnrollmentsByProgramIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  programIds: string[],
  statuses: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(programIds.map((id) => [id, 0]))
  if (programIds.length === 0) return counts

  const results = await Promise.all(
    programIds.map(async (programId) => {
      const { count, error } = await supabase
        .from("program_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("program_id", programId)
        .in("status", statuses)
      if (error) {
        console.error("countEnrollmentsByProgramIds:", error.message)
        return [programId, 0] as const
      }
      return [programId, count ?? 0] as const
    })
  )

  for (const [id, n] of results) counts.set(id, n)
  return counts
}

export type ProgramListStats = {
  offeringCount: number
  enrolled: number
}

/** Offering count and live enrollment totals for Programs Home list cards. */
export async function getProgramListStatsByProgramIds(
  programIds: string[]
): Promise<Map<string, ProgramListStats>> {
  const emptyStats = { offeringCount: 0, enrolled: 0 }
  const result = new Map<string, ProgramListStats>(
    programIds.map((id) => [id, emptyStats])
  )

  if (programIds.length === 0) {
    return result
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return result
  }

  const visibleOfferings = await loadStaffVisibleOfferingsForPrograms(
    supabase,
    organizationId,
    programIds
  )
  const offeringCountByProgram = new Map<string, number>()
  for (const row of visibleOfferings) {
    offeringCountByProgram.set(
      row.program_id,
      (offeringCountByProgram.get(row.program_id) || 0) + 1
    )
  }

  const enrolledByProgram = await countRosterEnrollmentsOnVisibleOfferings(
    supabase,
    organizationId,
    programIds,
    visibleOfferings
  )

  for (const programId of programIds) {
    result.set(programId, {
      offeringCount: offeringCountByProgram.get(programId) || 0,
      enrolled: enrolledByProgram.get(programId) || 0,
    })
  }

  return result
}

/** Catalog capacity per program: sum of limited offerings (S6). */
export async function getCatalogCapacityByProgramIds(programIds: string[]) {
  const empty = new Map<string, ProgramCatalogCapacity>()
  if (programIds.length === 0) {
    return empty
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return empty
  }

  const { data, error } = await supabase
    .from("program_offerings")
    .select("program_id, capacity, capacity_mode")
    .eq("organization_id", organizationId)
    .in("program_id", programIds)
    .neq("status", "archived")
    .neq("status", "cancelled")

  if (error) {
    console.error("getCatalogCapacityByProgramIds:", error.message)
    return empty
  }

  const byProgram = new Map<
    string,
    Array<{ capacity_mode?: string | null; capacity?: number | null }>
  >()

  for (const row of data || []) {
    const programId = row.program_id as string
    const list = byProgram.get(programId) || []
    list.push({
      capacity_mode: row.capacity_mode as string | null,
      capacity: row.capacity as number | null,
    })
    byProgram.set(programId, list)
  }

  const summaries = new Map<string, ProgramCatalogCapacity>()
  for (const programId of programIds) {
    summaries.set(
      programId,
      summarizeOfferingsCapacity(byProgram.get(programId) || [])
    )
  }

  return summaries
}
