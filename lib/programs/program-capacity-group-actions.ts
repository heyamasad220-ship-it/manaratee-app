"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import type { ProgramCapacityGroupInput } from "./program-capacity-group-types"
import { getTotalCapacityFromGroups } from "./program-capacity-group-types"
import {
  getPersistableCapacityGroups,
  normalizeCapacityGroups,
} from "./program-capacity-group-utils"

export async function replaceProgramCapacityGroups({
  program_id,
  groups,
}: {
  program_id: string
  groups: ProgramCapacityGroupInput[]
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const cleanGroups = getPersistableCapacityGroups(groups).map((group, index) => ({
    organization_id: organizationId,
    program_id,
    name: group.name.trim(),
    grade_levels: group.grade_levels,
    genders: group.genders,
    capacity: group.capacity,
    sort_order: index,
  }))

  const { error: deleteError } = await supabase
    .from("program_capacity_groups")
    .delete()
    .eq("organization_id", organizationId)
    .eq("program_id", program_id)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  if (cleanGroups.length > 0) {
    const { error: insertError } = await supabase
      .from("program_capacity_groups")
      .insert(cleanGroups)

    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  const totalCapacity = getTotalCapacityFromGroups(cleanGroups)

  const { error: programError } = await supabase
    .from("programs")
    .update({
      capacity: totalCapacity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", program_id)
    .eq("organization_id", organizationId)

  if (programError) {
    throw new Error(programError.message)
  }

  const { data: savedGroups, error: fetchError } = await supabase
    .from("program_capacity_groups")
    .select("*")
    .eq("program_id", program_id)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  revalidatePath("/programs")
  revalidatePath("/programs/catalog")
  revalidatePath(`/programs/${program_id}`)
  revalidatePath(`/programs/${program_id}/edit`)
  revalidatePath(`/customer/programs/${program_id}`)
  revalidatePath(`/customer/programs/${program_id}/register`)

  return normalizeCapacityGroups(savedGroups || [])
}
