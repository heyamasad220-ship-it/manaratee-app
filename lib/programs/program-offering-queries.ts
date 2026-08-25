import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  summarizeOfferingsCapacity,
  type ProgramCatalogCapacity,
} from "@/lib/programs/program-catalog-capacity"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"

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

  const { data: offerings, error: offeringsError } = await supabase
    .from("program_offerings")
    .select("id, program_id")
    .eq("organization_id", organizationId)
    .in("program_id", programIds)
    .neq("status", "archived")

  if (offeringsError) {
    console.error(
      "getProgramListStatsByProgramIds offerings:",
      offeringsError.message
    )
    return result
  }

  const offeringCountByProgram = new Map<string, number>()
  const offeringToProgram = new Map<string, string>()
  const offeringIds: string[] = []
  for (const row of offerings || []) {
    const programId = row.program_id as string
    const offeringId = row.id as string
    offeringCountByProgram.set(
      programId,
      (offeringCountByProgram.get(programId) || 0) + 1
    )
    offeringToProgram.set(offeringId, programId)
    offeringIds.push(offeringId)
  }

  const enrolledByProgram = new Map<string, number>()
  if (offeringIds.length > 0) {
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("program_enrollments")
      .select("offering_id")
      .eq("organization_id", organizationId)
      .in("offering_id", offeringIds)
      .in("status", ["enrolled", "active"])

    if (enrollmentsError) {
      console.error(
        "getProgramListStatsByProgramIds enrollments:",
        enrollmentsError.message
      )
    } else {
      for (const row of enrollments || []) {
        const programId = offeringToProgram.get(row.offering_id as string)
        if (!programId) continue
        enrolledByProgram.set(
          programId,
          (enrolledByProgram.get(programId) || 0) + 1
        )
      }
    }
  }

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
