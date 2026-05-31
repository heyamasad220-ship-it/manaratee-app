import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import type { ProgramCapacityGroup } from "./program-capacity-group-types"

export async function getProgramCapacityGroups(
  programId: string
): Promise<ProgramCapacityGroup[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("program_capacity_groups")
    .select("*")
    .eq("program_id", programId)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return []
    }

    console.error(error)
    throw new Error("Failed to load program capacity groups")
  }

  return (data || []) as ProgramCapacityGroup[]
}
