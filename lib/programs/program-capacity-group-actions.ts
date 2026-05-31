"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import type { ProgramCapacityGroupInput } from "./program-capacity-group-types"
import { getTotalCapacityFromGroups } from "./program-capacity-group-types"

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

  const cleanGroups = groups
    .map((group, index) => ({
      organization_id: organizationId,
      program_id,
      name: group.name.trim() || `Group ${index + 1}`,
      grade_levels: group.grade_levels || [],
      genders: group.genders || [],
      capacity: Number(group.capacity || 0),
      sort_order: index,
    }))
    .filter(
      (group) =>
        (group.grade_levels.length > 0 || group.genders.length > 0) &&
        group.capacity >= 0
    )

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

  revalidatePath("/programs")
  revalidatePath(`/programs/${program_id}`)
  revalidatePath(`/programs/${program_id}/edit`)
}
