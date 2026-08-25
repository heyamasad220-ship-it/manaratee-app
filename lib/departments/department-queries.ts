import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

async function repairLegacyDepartments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  userId: string | undefined
) {
  if (!userId) {
    return
  }

  // Early department rows stored auth.uid() in organization_id. Only rewrite
  // those rows — never other tenants' departments that RLS happens to expose
  // because the current user belongs to more than one organization.
  const { error } = await supabase
    .from("departments")
    .update({ organization_id: organizationId })
    .eq("organization_id", userId)

  if (error) {
    console.error("Failed to repair legacy departments:", error)
  }
}

export async function getDepartments() {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return []
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await repairLegacyDepartments(supabase, organizationId, user?.id)

  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (error) {
    console.error(error)
    throw new Error("Failed to load departments")
  }

  return data || []
}
