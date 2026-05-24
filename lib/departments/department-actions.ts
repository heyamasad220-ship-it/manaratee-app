"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

type CreateDepartmentInput = {
  name: string
  description?: string
  color?: string
}

export async function createDepartment(
  input: CreateDepartmentInput
) {
  const supabase = await createClient()

  const organizationId =
    await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("departments")
    .insert({
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
}