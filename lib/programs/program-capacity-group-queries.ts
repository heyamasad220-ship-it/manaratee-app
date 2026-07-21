import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import type { ProgramCapacityGroup } from "./program-capacity-group-types"
import { normalizeCapacityGroupInput } from "./program-capacity-group-utils"

function mapGroups(
  data: ProgramCapacityGroup[] | null
): ProgramCapacityGroup[] {
  return (data || []).map((group) =>
    normalizeCapacityGroupInput(group as ProgramCapacityGroup)
  )
}

/** Capacity groups for one offering (registration / manage UI). */
export async function getOfferingCapacityGroups(
  offeringId: string
): Promise<ProgramCapacityGroup[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("program_capacity_groups")
    .select("*")
    .eq("offering_id", offeringId)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return []
    }

    console.error(error)
    throw new Error("Failed to load offering capacity groups")
  }

  return mapGroups(data as ProgramCapacityGroup[] | null)
}

/**
 * All capacity groups under a program (any offering).
 * Used for car-tag filters and program-wide tools.
 */
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

  return mapGroups(data as ProgramCapacityGroup[] | null)
}
