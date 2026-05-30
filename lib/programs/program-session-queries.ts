import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

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

  return data
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