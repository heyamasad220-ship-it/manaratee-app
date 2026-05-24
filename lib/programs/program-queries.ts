import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

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

  return data
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

  return data
}