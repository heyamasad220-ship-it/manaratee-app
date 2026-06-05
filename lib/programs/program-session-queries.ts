import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { sortProgramSessions } from "@/lib/programs/program-session-sort"
import type { ProgramSession } from "@/lib/programs/program-session-types"

export async function getProgramSessions(programId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("program_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .order("sort_order", { ascending: true })

  if (error) {
    console.error(error)
    throw new Error("Failed to load sessions")
  }

  return sortProgramSessions((data || []) as ProgramSession[])
}

export async function getProgramSessionsForOffering(
  programId: string,
  offeringId: string,
  includeLegacyNullOffering = false
) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  let query = supabase
    .from("program_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)

  if (includeLegacyNullOffering) {
    query = query.or(`offering_id.eq.${offeringId},offering_id.is.null`)
  } else {
    query = query.eq("offering_id", offeringId)
  }

  const { data, error } = await query.order("sort_order", { ascending: true })

  if (error) {
    console.error(error)
    throw new Error("Failed to load sessions")
  }

  return sortProgramSessions((data || []) as ProgramSession[])
}

export async function getProgramSessionById(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return null
  }

  const { data, error } = await supabase
    .from("program_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .single()

  if (error) {
    console.error(error)
    return null
  }

  return data
}