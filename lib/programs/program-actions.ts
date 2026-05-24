"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

type CreateProgramInput = {
  name: string
  description?: string
  department_id?: string | null
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
  age_groups?: string[]
  grade_levels?: string[]
  gender?: string | null
  capacity?: number
  status?: string
}

export async function createProgram(input: CreateProgramInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase.from("programs").insert({
    organization_id: organizationId,
    name: input.name,
    description: input.description || null,
    department_id: input.department_id || null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    enrollment_open_date: input.enrollment_open_date || null,
    enrollment_close_date: input.enrollment_close_date || null,
    age_groups: input.age_groups || [],
    grade_levels: input.grade_levels || [],
    gender: input.gender || "All",
    capacity: input.capacity || 0,
    enrolled: 0,
    waitlist: 0,
    status: input.status || "draft",
  })

  if (error) {
    console.error(error)
    throw new Error("Failed to create program")
  }

  revalidatePath("/programs")
}
type UpdateProgramInput = {
  id: string
  name: string
  description?: string
  department_id?: string | null
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
  age_groups?: string[]
  grade_levels?: string[]
  gender?: string | null
  capacity?: number
  status?: string
}

export async function updateProgram(input: UpdateProgramInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("programs")
    .update({
      name: input.name,
      description: input.description || null,
      department_id: input.department_id || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      enrollment_open_date: input.enrollment_open_date || null,
      enrollment_close_date: input.enrollment_close_date || null,
      age_groups: input.age_groups || [],
      grade_levels: input.grade_levels || [],
      gender: input.gender || "All",
      capacity: input.capacity || 0,
      status: input.status || "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to update program")
  }

  revalidatePath("/programs")
  revalidatePath(`/programs/${input.id}`)
}