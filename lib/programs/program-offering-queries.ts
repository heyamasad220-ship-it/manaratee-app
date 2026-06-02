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
