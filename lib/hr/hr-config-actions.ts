"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export type HrPosition = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  staff_count?: number
}

export type HrJobRole = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  staff_count?: number
}

function revalidateHrSettingsPaths() {
  revalidatePath("/workforce/settings")
  revalidatePath("/workforce/employees")
  revalidatePath("/workforce/employees")
}

export async function fetchHrPositions(): Promise<HrPosition[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const { data, error } = await supabase
    .from("hr_positions")
    .select("id, name, description, is_active, sort_order")
    .eq("organization_id", organizationId)
    .order("sort_order")
    .order("name")

  if (error) {
    if (error.code === "42P01") return []
    throw new Error(error.message || "Failed to load positions")
  }

  const { data: staffRows } = await supabase
    .from("staff")
    .select("position_id")
    .eq("organization_id", organizationId)

  const counts = new Map<string, number>()
  for (const row of staffRows || []) {
    if (!row.position_id) continue
    counts.set(row.position_id, (counts.get(row.position_id) || 0) + 1)
  }

  return (data || []).map((row) => ({
    ...row,
    staff_count: counts.get(row.id) || 0,
  }))
}

export async function createHrPosition(input: {
  name: string
  description?: string
  is_active?: boolean
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { error } = await supabase.from("hr_positions").insert({
    organization_id: organizationId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    is_active: input.is_active ?? true,
  })

  if (error) throw new Error(error.message || "Failed to create position")
  revalidateHrSettingsPaths()
}

export async function updateHrPosition(input: {
  id: string
  name: string
  description?: string
  is_active?: boolean
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { error } = await supabase
    .from("hr_positions")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) throw new Error(error.message || "Failed to update position")
  revalidateHrSettingsPaths()
}

export async function deleteHrPosition(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { count, error: countError } = await supabase
    .from("staff")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("position_id", id)

  if (countError) throw new Error(countError.message || "Could not check position usage")
  if ((count || 0) > 0) {
    throw new Error("This position is assigned to employees. Reassign them first.")
  }

  const { error } = await supabase
    .from("hr_positions")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) throw new Error(error.message || "Failed to delete position")
  revalidateHrSettingsPaths()
}

export async function fetchHrJobRoles(): Promise<HrJobRole[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const { data, error } = await supabase
    .from("hr_job_roles")
    .select("id, name, description, is_active, sort_order")
    .eq("organization_id", organizationId)
    .order("sort_order")
    .order("name")

  if (error) {
    if (error.code === "42P01") return []
    throw new Error(error.message || "Failed to load roles")
  }

  const { data: staffRows } = await supabase
    .from("staff")
    .select("hr_job_role_id")
    .eq("organization_id", organizationId)

  const counts = new Map<string, number>()
  for (const row of staffRows || []) {
    if (!row.hr_job_role_id) continue
    counts.set(row.hr_job_role_id, (counts.get(row.hr_job_role_id) || 0) + 1)
  }

  return (data || []).map((row) => ({
    ...row,
    staff_count: counts.get(row.id) || 0,
  }))
}

export async function createHrJobRole(input: {
  name: string
  description?: string
  is_active?: boolean
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { error } = await supabase.from("hr_job_roles").insert({
    organization_id: organizationId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    is_active: input.is_active ?? true,
  })

  if (error) throw new Error(error.message || "Failed to create role")
  revalidateHrSettingsPaths()
}

export async function updateHrJobRole(input: {
  id: string
  name: string
  description?: string
  is_active?: boolean
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { error } = await supabase
    .from("hr_job_roles")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) throw new Error(error.message || "Failed to update role")
  revalidateHrSettingsPaths()
}

export async function deleteHrJobRole(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const { count, error: countError } = await supabase
    .from("staff")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("hr_job_role_id", id)

  if (countError) throw new Error(countError.message || "Could not check role usage")
  if ((count || 0) > 0) {
    throw new Error("This role is assigned to employees. Reassign them first.")
  }

  const { error } = await supabase
    .from("hr_job_roles")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) throw new Error(error.message || "Failed to delete role")
  revalidateHrSettingsPaths()
}
