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

/** Sum limited offering capacities onto programs.capacity (catalog dual-read).
 *  0 means no limited offerings → catalog shows Unlimited (S6). */
export async function syncProgramCapacityFromOfferings(
  organizationId: string,
  programId: string
) {
  const supabase = await createClient()

  const { data: offerings, error } = await supabase
    .from("program_offerings")
    .select("capacity, capacity_mode")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .neq("status", "archived")

  if (error) {
    throw new Error(error.message)
  }

  const totalCapacity = (offerings || []).reduce((sum, offering) => {
    if (offering.capacity_mode !== "limited") return sum
    return sum + Math.max(0, Number(offering.capacity || 0))
  }, 0)

  const { error: programError } = await supabase
    .from("programs")
    .update({
      capacity: totalCapacity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", programId)
    .eq("organization_id", organizationId)

  if (programError) {
    throw new Error(programError.message)
  }
}

export async function replaceProgramCapacityGroups({
  program_id,
  offering_id,
  groups,
}: {
  program_id: string
  offering_id: string
  groups: ProgramCapacityGroupInput[]
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!offering_id) {
    throw new Error("Offering is required for capacity groups")
  }

  const { data: offering, error: offeringLookupError } = await supabase
    .from("program_offerings")
    .select("id, program_id")
    .eq("id", offering_id)
    .eq("organization_id", organizationId)
    .eq("program_id", program_id)
    .maybeSingle()

  if (offeringLookupError) {
    throw new Error(offeringLookupError.message)
  }

  if (!offering) {
    throw new Error("Offering not found for this program")
  }

  const cleanGroups = getPersistableCapacityGroups(groups).map((group, index) => ({
    organization_id: organizationId,
    program_id,
    offering_id,
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
    .eq("offering_id", offering_id)

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
  const capacityMode = totalCapacity > 0 ? "limited" : "unlimited"

  const { error: offeringUpdateError } = await supabase
    .from("program_offerings")
    .update({
      capacity_mode: capacityMode,
      capacity: capacityMode === "limited" ? totalCapacity : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", offering_id)
    .eq("organization_id", organizationId)

  if (offeringUpdateError) {
    throw new Error(offeringUpdateError.message)
  }

  await syncProgramCapacityFromOfferings(organizationId, program_id)

  const { data: savedGroups, error: fetchError } = await supabase
    .from("program_capacity_groups")
    .select("*")
    .eq("offering_id", offering_id)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  revalidatePath("/programs")
  revalidatePath("/programs/catalog")
  revalidatePath(`/programs/${program_id}`)
  revalidatePath(`/programs/${program_id}/offerings`)
  revalidatePath(`/programs/${program_id}/offerings/${offering_id}`)
  revalidatePath(`/customer/programs/${program_id}`)
  revalidatePath(`/customer/programs/${program_id}/register`)

  return normalizeCapacityGroups(savedGroups || [])
}

export async function copyOfferingCapacityGroups(input: {
  organizationId: string
  programId: string
  sourceOfferingId: string
  targetOfferingId: string
}) {
  const supabase = await createClient()

  const { data: sourceGroups, error } = await supabase
    .from("program_capacity_groups")
    .select("name, grade_levels, genders, capacity, sort_order")
    .eq("organization_id", input.organizationId)
    .eq("offering_id", input.sourceOfferingId)
    .order("sort_order", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  if (!sourceGroups || sourceGroups.length === 0) {
    return
  }

  await replaceProgramCapacityGroups({
    program_id: input.programId,
    offering_id: input.targetOfferingId,
    groups: sourceGroups.map((group) => ({
      name: group.name,
      grade_levels: group.grade_levels || [],
      genders: group.genders || [],
      capacity: Number(group.capacity || 0),
    })),
  })
}
