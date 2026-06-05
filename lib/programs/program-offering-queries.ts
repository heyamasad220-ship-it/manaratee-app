import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
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
    .order("is_default", { ascending: false })
    .order("start_date", { ascending: true })

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
    .order("is_default", { ascending: false })
    .order("start_date", { ascending: true })

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
