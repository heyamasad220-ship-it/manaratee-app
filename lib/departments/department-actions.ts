"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getDepartments } from "@/lib/departments/department-queries"

type CreateDepartmentInput = {
  name: string
  description?: string
  color?: string
}

type UpdateDepartmentInput = {
  id: string
  name: string
  description?: string
  color?: string
}

export type DepartmentWithProgramCount = {
  id: string
  name: string
  description: string | null
  color: string
  programs_count: number
}

export async function createDepartment(input: CreateDepartmentInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase.from("departments").insert({
    organization_id: organizationId,
    name: input.name,
    description: input.description || null,
    color: input.color || "bg-blue-500",
  })

  if (error) {
    console.error(error)
    throw new Error("Failed to create department")
  }

  revalidatePath("/programs")
  revalidatePath("/programs/catalog")
  revalidatePath("/programs/settings")
}

export async function updateDepartment(input: UpdateDepartmentInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("departments")
    .update({
      name: input.name,
      description: input.description || null,
      color: input.color || "bg-blue-500",
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to update department")
  }

  revalidatePath("/programs")
  revalidatePath("/programs/catalog")
  revalidatePath("/programs/settings")
}

export async function deleteDepartment(id: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to delete department")
  }

  revalidatePath("/programs")
  revalidatePath("/programs/catalog")
  revalidatePath("/programs/settings")
}

export async function fetchDepartmentsWithProgramCounts(): Promise<
  DepartmentWithProgramCount[]
> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const departments = await getDepartments()

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("department_id")
    .eq("organization_id", organizationId)

  if (programsError) {
    console.error(programsError)
    throw new Error("Failed to load program counts for departments")
  }

  const programCounts = new Map<string, number>()

  for (const program of programs || []) {
    if (!program.department_id) {
      continue
    }

    programCounts.set(
      program.department_id,
      (programCounts.get(program.department_id) || 0) + 1
    )
  }

  return departments.map((department) => ({
    id: department.id,
    name: department.name,
    description: department.description,
    color: department.color,
    programs_count: programCounts.get(department.id) || 0,
  }))
}
