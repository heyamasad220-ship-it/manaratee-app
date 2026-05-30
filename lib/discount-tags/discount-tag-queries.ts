import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export async function getDiscountTags() {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("discount_tags")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (error) {
    console.error(error)
    throw new Error("Failed to load discount tags")
  }

  return data
}